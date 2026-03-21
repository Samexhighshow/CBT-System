import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Loading, StudentAvatarDropdown } from '../components';
import FooterMinimal from '../components/FooterMinimal';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';
import { showError, showSuccess } from '../utils/alerts';
import StudentAnnouncements from './StudentAnnouncements';
import AvailableExams from './student/AvailableExams';
import MyResults from './student/MyResults';
import StudentOverview from './student/StudentOverview';
import { CurrentStudentProfile, getCurrentStudentProfile } from './student/studentData';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `h-10 px-4 rounded-full text-sm font-medium transition inline-flex items-center ${isActive
    ? 'bg-cyan-100 text-cyan-800 border border-cyan-200 shadow-sm'
    : 'text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900'
  }`;

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<CurrentStudentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [completionForm, setCompletionForm] = useState({
    other_names: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
    address: '',
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    guardian_gender: '',
    new_password: '',
    new_password_confirmation: '',
  });
  let storedUser: any = null;
  try {
    const raw = localStorage.getItem('user');
    storedUser = raw ? JSON.parse(raw) : null;
  } catch {
    storedUser = null;
  }
  const activeUser = user || storedUser;
  const roles = (activeUser?.roles || []).map((r: any) => String(r?.name || r).toLowerCase());
  const isStudent = roles.includes('student');

  const isOnboardingLocked = useMemo(() => {
    if (!profile) return false;
    return profile.registration_completed === false || profile.must_change_password === true;
  }, [profile]);

  const missingFields = useMemo(() => {
    return new Set(profile?.missing_fields || []);
  }, [profile]);

  const fetchProfileAndEnforce = useCallback(async () => {
    try {
      setLoadingProfile(true);
      const currentProfile = await getCurrentStudentProfile();
      setProfile(currentProfile);
      if (currentProfile.registration_completed === false || currentProfile.must_change_password === true) {
        return;
      }
      const res = await api.get('/preferences/student/subjects');
      const picked = Array.isArray((res as any)?.data?.student_subjects)
        ? (res as any).data.student_subjects.length
        : 0;
      if (picked === 0) {
        localStorage.removeItem('subjectsSelected');
        navigate('/select-subjects', { replace: true });
        return;
      }
      localStorage.setItem('subjectsSelected', 'true');
    } catch {
      navigate('/select-subjects', { replace: true });
    } finally {
      setLoadingProfile(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!activeUser) {
      navigate('/student-login');
      return;
    }

    if (!isStudent) return;
    fetchProfileAndEnforce();
  }, [activeUser, fetchProfileAndEnforce, isStudent, navigate]);

  const completeLabelMap: Record<string, string> = {
    date_of_birth: 'Date of Birth',
    gender: 'Gender',
    address: 'Home Address',
    guardian_first_name: 'Guardian First Name',
    guardian_last_name: 'Guardian Last Name',
    guardian_relationship: 'Guardian Relationship',
    guardian_phone: 'Guardian Phone',
    guardian_gender: 'Guardian Gender',
  };

  const handleCompleteRegistration = async () => {
    try {
      setSavingCompletion(true);
      const payload: Record<string, any> = {};

      Object.entries(completionForm).forEach(([key, value]) => {
        const trimmed = String(value || '').trim();
        if (trimmed !== '' && key !== 'new_password_confirmation') {
          payload[key] = trimmed;
        }
      });

      if (profile?.must_change_password) {
        if (!completionForm.new_password || completionForm.new_password.length < 8) {
          showError('New password must be at least 8 characters.');
          return;
        }
        if (completionForm.new_password !== completionForm.new_password_confirmation) {
          showError('Password confirmation does not match.');
          return;
        }
        payload.new_password = completionForm.new_password;
        payload.new_password_confirmation = completionForm.new_password_confirmation;
      }

      await api.post('/student/complete-registration', payload);
      showSuccess('Registration completed successfully.');
      setCompletionForm({
        other_names: '',
        phone_number: '',
        date_of_birth: '',
        gender: '',
        address: '',
        guardian_first_name: '',
        guardian_last_name: '',
        guardian_relationship: '',
        guardian_phone: '',
        guardian_gender: '',
        new_password: '',
        new_password_confirmation: '',
      });
      await fetchProfileAndEnforce();
    } catch (error: any) {
      const serverMessage = error?.response?.data?.message || 'Please complete all required fields.';
      showError(serverMessage);
      const serverMissing = error?.response?.data?.missing_fields;
      if (Array.isArray(serverMissing)) {
        setProfile((prev) => prev ? { ...prev, missing_fields: serverMissing } : prev);
      }
    } finally {
      setSavingCompletion(false);
    }
  };

  if (!activeUser || loadingProfile) {
    return <Loading fullScreen message="Loading student portal..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto w-full max-w-[1200px] px-5">
          <div className="flex h-[68px] items-center">
            <div className="flex min-w-0 items-center gap-2 md:min-w-[190px]">
              <div className="h-9 w-9 rounded-lg bg-cyan-600 text-white flex items-center justify-center">
                <i className="bx bx-graduation text-xl" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-cyan-700">Student Area</p>
                <p className="text-sm font-semibold text-slate-900 truncate">CBT Portal</p>
              </div>
            </div>

            <div className="hidden lg:flex flex-1 items-center justify-center px-4">
              <div className="flex items-center justify-center gap-2 xl:gap-3">
                {!isOnboardingLocked && <NavLink to="/student" end className={navLinkClass}>Overview</NavLink>}
                {!isOnboardingLocked && <NavLink to="/student/exams" className={navLinkClass}>Exams</NavLink>}
                {!isOnboardingLocked && <NavLink to="/student/results" className={navLinkClass}>Results</NavLink>}
                <NavLink to="/student/announcements" className={navLinkClass}>Announcements</NavLink>
              </div>
            </div>

            <div className="ml-auto flex items-center justify-end md:min-w-[190px]">
              <StudentAvatarDropdown />
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-6">
        <Routes>
          <Route index element={isOnboardingLocked ? <Navigate to="/student/announcements" replace /> : <StudentOverview />} />
          <Route path="exams" element={isOnboardingLocked ? <Navigate to="/student/announcements" replace /> : <AvailableExams />} />
          <Route path="results" element={isOnboardingLocked ? <Navigate to="/student/announcements" replace /> : <MyResults />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>
      </main>

      <div className="sticky bottom-0 z-30">
        <FooterMinimal />
      </div>

      {isOnboardingLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8">
          <div className="w-full max-w-3xl bg-white shadow-2xl border border-slate-200 rounded-xl">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Complete Your Registration</h2>
              <p className="text-sm text-slate-600 mt-1">
                Your account was created by admin. Fill the missing details below to continue using the student portal.
              </p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Middle Name</label>
                <input
                  value={completionForm.other_names}
                  onChange={(e) => setCompletionForm((prev) => ({ ...prev, other_names: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Phone Number</label>
                <input
                  value={completionForm.phone_number}
                  onChange={(e) => setCompletionForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>

              {Array.from(missingFields).map((field) => (
                <div key={field} className={field === 'address' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                    {completeLabelMap[field] || field}
                  </label>
                  {field === 'gender' || field === 'guardian_gender' ? (
                    <select
                      value={(completionForm as any)[field] || ''}
                      onChange={(e) => setCompletionForm((prev) => ({ ...prev, [field]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  ) : field === 'date_of_birth' ? (
                    <input
                      type="date"
                      value={(completionForm as any)[field] || ''}
                      onChange={(e) => setCompletionForm((prev) => ({ ...prev, [field]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  ) : field === 'address' ? (
                    <textarea
                      value={(completionForm as any)[field] || ''}
                      onChange={(e) => setCompletionForm((prev) => ({ ...prev, [field]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      rows={3}
                    />
                  ) : (
                    <input
                      value={(completionForm as any)[field] || ''}
                      onChange={(e) => setCompletionForm((prev) => ({ ...prev, [field]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  )}
                </div>
              ))}

              {profile?.must_change_password && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">New Password</label>
                    <input
                      type="password"
                      value={completionForm.new_password}
                      onChange={(e) => setCompletionForm((prev) => ({ ...prev, new_password: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={completionForm.new_password_confirmation}
                      onChange={(e) => setCompletionForm((prev) => ({ ...prev, new_password_confirmation: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-xs text-slate-500">Only announcements are available until completion.</p>
              <button
                onClick={handleCompleteRegistration}
                disabled={savingCompletion}
                className="rounded-lg bg-cyan-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-cyan-700 disabled:opacity-60"
              >
                {savingCompletion ? 'Saving...' : 'Complete Registration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
