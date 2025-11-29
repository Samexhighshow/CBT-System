import React, { useState } from 'react';
import { Card, Button, Input } from '../components';
import { api } from '../services/api';
import { showSuccess, showError } from '../utils/alerts';
import { useSearchParams, useNavigate } from 'react-router-dom';

const PasswordReset: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [password_confirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/auth/password/reset', { email, token, password, password_confirmation });
      showSuccess('Password reset successful. Please login.');
      navigate('/login');
    } catch (e) {
      showError('Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Reset Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e:any) => setEmail(e.target.value)} required />
          <Input type="text" placeholder="Token" value={token} onChange={(e:any) => setToken(e.target.value)} required />
          <Input type="password" placeholder="New Password" value={password} onChange={(e:any) => setPassword(e.target.value)} required />
          <Input type="password" placeholder="Confirm Password" value={password_confirmation} onChange={(e:any) => setPasswordConfirmation(e.target.value)} required />
          <Button type="submit" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</Button>
        </form>
      </Card>
    </div>
  );
};

export default PasswordReset;
