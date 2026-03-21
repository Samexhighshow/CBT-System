import React, { ChangeEvent, FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import { API_URL } from '../services/api';

interface LoginFormData {
  email: string;
  password: string;
}

const StudentLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        ...formData,
        login_context: 'student',
      });
      const { token, user } = res.data;
      const userRoles = (user?.roles || []).map((r: any) => String(r?.name || r).toLowerCase());
      const isStudent = userRoles.includes('student');

      if (!isStudent) {
        setError('This account is not permitted on the student portal.');
        return;
      }

      login(user, token);

      try {
        const profileRes = await axios.get(`${API_URL}/student/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const registrationCompleted = profileRes.data?.registration_completed !== false;
        const mustChangePassword = profileRes.data?.must_change_password === true;
        if (!registrationCompleted || mustChangePassword) {
          navigate('/student/announcements');
          return;
        }

        const prefRes = await axios.get(`${API_URL}/preferences/student/subjects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const picked = Array.isArray(prefRes.data?.student_subjects) ? prefRes.data.student_subjects.length : 0;
        if (picked === 0) {
          localStorage.removeItem('subjectsSelected');
          navigate('/select-subjects');
          return;
        }
        localStorage.setItem('subjectsSelected', 'true');
      } catch {
        navigate('/select-subjects');
        return;
      }

      navigate('/student');
    } catch (err: any) {
      const errorType = err?.response?.data?.error_type;
      if (errorType === 'role_not_student') {
        setError('This account is not permitted on the student portal.');
      } else if (errorType === 'email_not_found') {
        setError('Email address not found. Confirm your email or register first.');
      } else if (errorType === 'invalid_password') {
        setError('Incorrect password. Please try again.');
      } else {
        setError(err?.response?.data?.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        <div className="grid lg:grid-cols-[1.1fr_1fr]">
          <section className="p-8 md:p-10 bg-gradient-to-br from-cyan-600 to-teal-600 text-white">
            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <i className="bx bx-user-circle text-3xl" />
            </div>
            <h1 className="mt-6 text-3xl font-bold">Student Portal Login</h1>
            <p className="mt-3 text-cyan-100 leading-relaxed text-sm md:text-base">
              Sign in to access your dashboard, available exams, results, announcements, and profile settings.
            </p>

            <div className="mt-8 space-y-3 text-sm">
              <div className="flex items-center gap-2"><i className="bx bx-check-circle text-lg" /> Exam access and progress tracking</div>
              <div className="flex items-center gap-2"><i className="bx bx-check-circle text-lg" /> Results and performance insights</div>
              <div className="flex items-center gap-2"><i className="bx bx-check-circle text-lg" /> Announcements and exam updates</div>
            </div>
          </section>

          <section className="p-8 md:p-10">
            <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
            <p className="text-sm text-slate-600 mt-1">Use your registered email and password.</p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'} text-lg`} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 space-y-2 text-sm">
              <p className="text-slate-600">
                Do not have an account?{' '}
                <Link to="/register" className="font-semibold text-cyan-700 hover:text-cyan-800">Create account</Link>
              </p>
              <p className="text-slate-600">
                Forgot password?{' '}
                <Link to="/forgot-password-otp" className="font-semibold text-cyan-700 hover:text-cyan-800">Reset via OTP</Link>
              </p>
              <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700">
                <i className="bx bx-arrow-back" /> Back to Home
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
