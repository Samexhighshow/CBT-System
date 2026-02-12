import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../../components';
import { api } from '../../services/api';
import useAuthStore from '../../store/authStore';
import { showError, showSuccess } from '../../utils/alerts';
import { getCurrentStudentProfile, CurrentStudentProfile } from './studentData';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  profile_picture?: string | null;
}

interface TwoFaStatus {
  enabled: boolean;
  type?: string | null;
}

const StudentProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [student, setStudent] = useState<CurrentStudentProfile | null>(null);
  const [twoFaStatus, setTwoFaStatus] = useState<TwoFaStatus>({ enabled: false, type: null });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [picturePreview, setPicturePreview] = useState('');
  const [pictureFile, setPictureFile] = useState<File | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);

      const [profileRes, twoFaRes] = await Promise.all([
        api.get('/profile'),
        api.get('/profile/2fa/status'),
      ]);

      const profilePayload = profileRes.data || {};
      setProfile(profilePayload);
      setName(profilePayload.name || '');
      setEmail(profilePayload.email || '');

      if (profilePayload.profile_picture) {
        const base = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace('/api', '');
        const pictureUrl = String(profilePayload.profile_picture).startsWith('http')
          ? profilePayload.profile_picture
          : `${base}/storage/${profilePayload.profile_picture}`;
        setPicturePreview(pictureUrl);
      } else {
        setPicturePreview('');
      }

      setTwoFaStatus({
        enabled: !!twoFaRes.data?.enabled,
        type: twoFaRes.data?.type || null,
      });

      try {
        const studentPayload = await getCurrentStudentProfile();
        setStudent(studentPayload);
      } catch {
        setStudent(null);
      }
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to load profile settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      const response = await api.put('/profile', { name, email });
      showSuccess(response.data?.message || 'Profile updated successfully.');

      if (user) {
        setUser({ ...user, name, email });
      }
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const onPickPicture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setPictureFile(file);

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPicturePreview(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const uploadPicture = async () => {
    if (!pictureFile) {
      showError('Please choose a picture file first.');
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('picture', pictureFile);
      const response = await api.post('/profile/picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showSuccess(response.data?.message || 'Profile picture updated.');
      setPictureFile(null);
      await fetchData();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to upload profile picture.');
    } finally {
      setSaving(false);
    }
  };

  const removePicture = async () => {
    try {
      setSaving(true);
      const response = await api.delete('/profile/picture');
      showSuccess(response.data?.message || 'Profile picture removed.');
      setPicturePreview('');
      setPictureFile(null);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to remove picture.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      showError('Password confirmation does not match.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.post('/profile/password', {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmNewPassword,
      });

      showSuccess(response.data?.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const sendEmailOtp = async () => {
    try {
      setSaving(true);
      const response = await api.post('/profile/2fa/email/enable');
      showSuccess(response.data?.message || 'OTP sent to your email.');
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setSaving(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!otpCode.trim()) {
      showError('Enter the OTP code sent to your email.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.post('/profile/2fa/email/verify', { code: otpCode.trim() });
      showSuccess(response.data?.message || 'Two-factor authentication enabled.');
      setOtpCode('');
      await fetchData();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Invalid OTP code.');
    } finally {
      setSaving(false);
    }
  };

  const disableTwoFa = async () => {
    if (!disablePassword.trim()) {
      showError('Enter your password to disable 2FA.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.post('/profile/2fa/disable', { password: disablePassword });
      showSuccess(response.data?.message || 'Two-factor authentication disabled.');
      setDisablePassword('');
      await fetchData();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to disable 2FA.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-sm text-slate-600">Manage your identity, security, and account preferences.</p>
      </div>

      {loading ? (
        <Card><p className="text-sm text-slate-500">Loading profile settings...</p></Card>
      ) : (
        <>
          <Card className="border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Student Snapshot</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-slate-500">Registration Number</p>
                <p className="font-semibold text-slate-900">{student?.registration_number || 'Not set'}</p>
              </div>
              <div>
                <p className="text-slate-500">Class</p>
                <p className="font-semibold text-slate-900">{student?.class_name || student?.class_level || 'Not set'}</p>
              </div>
              <div>
                <p className="text-slate-500">Department</p>
                <p className="font-semibold text-slate-900">{student?.department || 'Not set'}</p>
              </div>
              <div>
                <p className="text-slate-500">Completed Attempts</p>
                <p className="font-semibold text-slate-900">{student?.completed_attempts ?? 0}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Basic Profile</h2>
            <form onSubmit={updateProfile} className="space-y-4">
              <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
              <Button type="submit" loading={saving}>Save Profile</Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Profile Picture</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="h-24 w-24 rounded-full overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center text-3xl text-slate-500">
                {picturePreview ? (
                  <img src={picturePreview} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  (name || profile?.name || 'S').charAt(0).toUpperCase()
                )}
              </div>
              <div className="space-y-2 w-full max-w-md">
                <input type="file" accept="image/*" onChange={onPickPicture} className="w-full text-sm" aria-label="Profile picture" />
                <div className="flex gap-2">
                  <Button onClick={uploadPicture} disabled={!pictureFile} loading={saving}>Upload</Button>
                  <Button variant="secondary" onClick={removePicture} loading={saving}>Remove</Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Security</h2>
            <form onSubmit={changePassword} className="space-y-3">
              <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required fullWidth />
              <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required fullWidth />
              <Input label="Confirm New Password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required fullWidth />
              <Button type="submit" loading={saving}>Update Password</Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Two-Factor Authentication</h2>
            <p className="text-sm text-slate-600">
              Current status: <span className="font-semibold text-slate-900">{twoFaStatus.enabled ? `Enabled (${twoFaStatus.type || 'Configured'})` : 'Disabled'}</span>
            </p>

            {!twoFaStatus.enabled ? (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <Button onClick={sendEmailOtp} loading={saving}>Send Email OTP</Button>
                  <Input label="Enter OTP" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} fullWidth maxLength={6} />
                  <Button variant="secondary" onClick={verifyEmailOtp} loading={saving}>Verify</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-col md:flex-row gap-2 md:items-end">
                <Input label="Password to Disable 2FA" type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} fullWidth />
                <Button variant="secondary" onClick={disableTwoFa} loading={saving}>Disable 2FA</Button>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Academic Preferences</h2>
            <p className="text-sm text-slate-600 mb-3">You can review and update your subject choices for current session.</p>
            <Button variant="secondary" onClick={() => navigate('/select-subjects')}>Open Subject Selection</Button>
          </Card>
        </>
      )}
    </div>
  );
};

export default StudentProfileSettings;
