import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Card, Button, Input } from '../components';
import { showSuccess, showError, showConfirm } from '../utils/alerts';
import axios from 'axios';
import useAuthStore from '../store/authStore';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  two_factor_enabled: boolean;
  two_factor_type: string | null;
}

interface TwoFAStatus {
  enabled: boolean;
  type: string | null;
}

const Profile: React.FC = () => {
  const { token, user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFAStatus>({ enabled: false, type: null });

  // General tab state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string>('');

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [googleSecret, setGoogleSecret] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  useEffect(() => {
    fetchProfile();
    fetch2FAStatus();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      setName(response.data.name);
      setEmail(response.data.email);
      if (response.data.profile_picture) {
        setPicturePreview(`${API_URL.replace('/api', '')}/storage/${response.data.profile_picture}`);
      }
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to load profile');
    }
  };

  const fetch2FAStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/profile/2fa/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTwoFAStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch 2FA status');
    }
  };

  const handlePictureChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPictureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API_URL}/profile`, { name, email }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('Profile updated successfully');
      fetchProfile();
      setUser({ ...user!, name, email });
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePicture = async () => {
    if (!pictureFile) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('picture', pictureFile);
      const response = await axios.post(`${API_URL}/profile/picture`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      showSuccess('Profile picture updated');
      setPicturePreview(response.data.picture_url);
      setPictureFile(null);
      fetchProfile();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update picture');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePicture = async () => {
    const confirmed = await showConfirm('Remove profile picture?', 'This action cannot be undone');
    if (!confirmed) return;
    
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/profile/picture`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('Profile picture removed');
      setPicturePreview('');
      fetchProfile();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to remove picture');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirmation) {
      showError('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/profile/password`, {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirmation
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirmation('');
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupGoogle2FA = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/profile/2fa/google/setup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQrCodeUrl(response.data.qr_code_url);
      setGoogleSecret(response.data.secret);
      showSuccess(response.data.message);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to setup Google Authenticator');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGoogle2FA = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/profile/2fa/google/verify`, { code: twoFACode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('Google Authenticator enabled successfully');
      setTwoFACode('');
      setQrCodeUrl('');
      setGoogleSecret('');
      fetch2FAStatus();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableEmailOTP = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/profile/2fa/email/enable`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess(response.data.message);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOTP = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/profile/2fa/email/verify`, { code: twoFACode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('Email OTP 2FA enabled successfully');
      setTwoFACode('');
      fetch2FAStatus();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Invalid OTP code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      showError('Please enter your password to disable 2FA');
      return;
    }
    const confirmed = await showConfirm('Disable Two-Factor Authentication?', 'Your account will be less secure');
    if (!confirmed) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/profile/2fa/disable`, { password: disablePassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('Two-factor authentication disabled');
      setDisablePassword('');
      fetch2FAStatus();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile Settings</h1>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'security'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Security
          </button>
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  fullWidth
                />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                />
                <Button type="submit" loading={loading}>
                  Update Profile
                </Button>
              </form>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>
              <div className="flex items-center space-x-6">
                <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden">
                  {picturePreview ? (
                    <img src={picturePreview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <div className="flex space-x-3">
                    {pictureFile && (
                      <Button onClick={handleUpdatePicture} loading={loading}>
                        Upload Picture
                      </Button>
                    )}
                    {picturePreview && (
                      <Button onClick={handleRemovePicture} variant="secondary">
                        Remove Picture
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-semibold mb-4">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  fullWidth
                />
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  fullWidth
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={newPasswordConfirmation}
                  onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                  required
                  fullWidth
                />
                <Button type="submit" loading={loading}>
                  Change Password
                </Button>
              </form>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication</h2>
              
              {twoFAStatus.enabled ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800">
                      ✓ Two-factor authentication is <strong>enabled</strong> using{' '}
                      <strong>{twoFAStatus.type === 'google_authenticator' ? 'Google Authenticator' : 'Email OTP'}</strong>
                    </p>
                  </div>
                  <div>
                    <Input
                      label="Enter Password to Disable 2FA"
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      fullWidth
                    />
                    <Button onClick={handleDisable2FA} variant="secondary" loading={loading} className="mt-3">
                      Disable 2FA
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">Two-factor authentication is currently disabled</p>
                  </div>

                  {/* Google Authenticator */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Google Authenticator</h3>
                    {!qrCodeUrl ? (
                      <Button onClick={handleSetupGoogle2FA} loading={loading}>
                        Setup Google Authenticator
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-2">Scan this QR code with Google Authenticator:</p>
                          <img src={qrCodeUrl} alt="QR Code" className="mx-auto" />
                          <p className="text-xs text-gray-500 mt-2">Secret: {googleSecret}</p>
                        </div>
                        <Input
                          label="Enter 6-digit code from app"
                          value={twoFACode}
                          onChange={(e) => setTwoFACode(e.target.value)}
                          maxLength={6}
                          fullWidth
                        />
                        <Button onClick={handleVerifyGoogle2FA} loading={loading}>
                          Verify and Enable
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Email OTP */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Email OTP</h3>
                    <div className="space-y-4">
                      <Button onClick={handleEnableEmailOTP} loading={loading}>
                        Send OTP to Email
                      </Button>
                      <Input
                        label="Enter 6-digit OTP from email"
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value)}
                        maxLength={6}
                        fullWidth
                      />
                      <Button onClick={handleVerifyEmailOTP} loading={loading}>
                        Verify and Enable
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
