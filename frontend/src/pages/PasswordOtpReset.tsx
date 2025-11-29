import React, { useState } from 'react';
import axios from 'axios';
import { showSuccess, showError } from '../utils/alerts';

const PasswordOtpReset: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      showError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/auth/password/otp/verify`, { email, code, password, password_confirmation: confirm });
      showSuccess('Password reset successful. You can login now.');
      setEmail(''); setCode(''); setPassword(''); setConfirm('');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white shadow rounded p-6">
        <h1 className="text-xl font-semibold mb-4">Reset Password with OTP</h1>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="your.email@example.com"
            className="w-full border px-3 py-2 rounded"
          />
          <input
            type="text"
            required
            value={code}
            onChange={e=>setCode(e.target.value)}
            placeholder="OTP Code"
            className="w-full border px-3 py-2 rounded"
          />
          <input
            type="password"
            required
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="New password"
            className="w-full border px-3 py-2 rounded"
          />
          <input
            type="password"
            required
            value={confirm}
            onChange={e=>setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="w-full border px-3 py-2 rounded"
          />
          <button disabled={loading} className="w-full bg-green-600 text-white py-2 rounded">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-3">Use the OTP sent to your email. It may expire in minutes.</p>
      </div>
    </div>
  );
};

export default PasswordOtpReset;
