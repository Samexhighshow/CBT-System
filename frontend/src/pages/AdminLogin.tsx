import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import { checkReachability } from '../services/reachability';
import offlineDB from '../services/offlineDB';
import syncService from '../services/syncService';

interface LoginFormData {
  email: string;
  password: string;
}

const hashPin = async (input: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const isAdmin = user.roles?.some((r: any) => ['Admin', 'Main Admin', 'Teacher'].includes(r.name));
        if (isAdmin) {
          console.log('Detected existing admin login, checking validity...');
        }
      } catch (e) {
        console.error('Invalid stored user data, clearing...');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('subjectsSelected');
      }
    }
  }, [navigate]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const reachability = await checkReachability();

      if (reachability.status === 'OFFLINE') {
        const identifier = formData.email.trim().toLowerCase();
        const pin = formData.password.trim();

        const offlineUser = await offlineDB.offlineUsers
          .where('identifier')
          .equals(identifier)
          .and((row) => ['admin', 'main admin', 'teacher'].includes(String(row.role || '').toLowerCase()))
          .first();

        if (!offlineUser) {
          setError('Offline login failed. Supervisor account not cached on this device.');
          return;
        }

        if (!offlineUser.isActive || !offlineUser.offlineLoginEnabled) {
          setError('Offline login is disabled for this account.');
          return;
        }

        if (!offlineUser.pinHash) {
          setError('Offline PIN is not configured for this account.');
          return;
        }

        const pinHash = await hashPin(pin);
        if (pinHash !== offlineUser.pinHash) {
          setError('Invalid offline PIN.');
          return;
        }

        const lastSyncAt = new Date(offlineUser.lastSyncAt || 0).getTime();
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
        if (!lastSyncAt || Date.now() - lastSyncAt > maxAgeMs) {
          setError('Offline login cache expired. Reconnect to refresh supervisor access.');
          return;
        }

        const roleName = offlineUser.role || 'Admin';
        const offlineAuthUser = {
          id: offlineUser.userId,
          name: offlineUser.displayName || offlineUser.identifier,
          email: offlineUser.identifier,
          roles: [{ id: offlineUser.userId, name: roleName, guard_name: 'web', created_at: '', updated_at: '' }],
          two_factor_enabled: false,
          created_at: '',
          updated_at: '',
        };

        login(offlineAuthUser as any, `offline-cbt-${offlineUser.userId}`);
        localStorage.setItem('OFFLINE_CBT_MODE', '1');
        localStorage.setItem('offline_supervisor_user', JSON.stringify({
          userId: offlineUser.userId,
          role: roleName,
          identifier: offlineUser.identifier,
          lastSyncAt: offlineUser.lastSyncAt,
        }));

        navigate('/admin/exam-access');
        return;
      }

      const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/login`, {
        ...formData,
        login_context: 'admin',
      });
      const { token, user } = res.data;
      login(user, token);
      localStorage.removeItem('OFFLINE_CBT_MODE');

      const isOnlyTeacher = user.roles?.some((r: any) => r.name?.toLowerCase() === 'teacher') &&
        !user.roles?.some((r: any) => ['admin', 'main admin'].includes(r.name?.toLowerCase()));

      syncService.runFullSync();

      if (isOnlyTeacher) {
        navigate('/admin');
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      let errorMessage = err?.response?.data?.message || 'Login failed. Please check your credentials.';
      
      // Handle specific error types
      const errorType = err?.response?.data?.error_type;
      if (errorType === 'role_not_admin') {
        errorMessage = '❌ This account is not permitted on the admin portal.';
      } else if (errorType === 'email_not_found') {
        errorMessage = '❌ Email address not found. Please check your email or sign up for an account.';
      } else if (errorType === 'invalid_password') {
        errorMessage = '❌ Incorrect password. Please try again or reset your password.';
      } else if (err?.response?.status === 403 && err?.response?.data?.email_verified === false) {
        errorMessage = `${errorMessage}\n\nPlease check your email (${err?.response?.data?.email}) for the verification link.`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center p-4">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-slate-700 rounded-full mix-blend-multiply filter blur-3xl opacity-10" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10" />
      </div>

      {/* Main Card */}
      <div className="relative w-full max-w-4xl bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
        <div className="flex flex-col lg:flex-row">

          {/* Left Panel - Branding */}
          <div className="lg:w-2/5 bg-gradient-to-br from-slate-700 to-slate-800 p-8 flex flex-col justify-center items-center text-white">
            <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-center">Admin Portal</h1>
            <p className="text-white/80 text-sm text-center mb-6">Secure access for administrators</p>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white/90">Manage Exams</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white/90">View Analytics</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white/90">Manage Students</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Form */}
          <div className="lg:w-3/5 p-8">
            <h2 className="text-xl font-semibold text-white mb-1">Welcome Back</h2>
            <p className="text-gray-400 text-sm mb-6">Sign in to your admin account</p>
            <p className="text-gray-500 text-xs mb-4">
              If network is unavailable, use your configured Offline PIN in the password field.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@example.com"
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs font-medium mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-gray-400 text-xs">
                Need an account?{' '}
                <Link to="/admin/signup" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                  Apply for admin access
                </Link>
              </p>
              <p className="text-gray-500 text-xs">
                Forgot password?{' '}
                <Link to="/forgot-password-otp" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Use OTP reset
                </Link>
              </p>
              <Link to="/" className="text-gray-500 hover:text-gray-300 text-xs block transition-colors">
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
