import React, { useState } from 'react';
import axios from 'axios';
import { showSuccess, showError } from '../utils/alerts';

const PasswordOtpRequest: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/auth/password/otp/request`, { email });
      showSuccess('If the email exists, an OTP was sent');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Unable to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white shadow rounded p-6">
        <h1 className="text-xl font-semibold mb-4">Request Password OTP</h1>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="your.email@example.com"
            className="w-full border px-3 py-2 rounded"
          />
          <button disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded">
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-3">Check your email for the OTP code. It expires quickly.</p>
      </div>
    </div>
  );
};

export default PasswordOtpRequest;
