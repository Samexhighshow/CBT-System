import React, { useState } from 'react';
import { Card, Button, Input } from '../components';
import { api } from '../services/api';
import { showSuccess, showError } from '../utils/alerts';

const PasswordResetRequest: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/auth/password/forgot', { email });
      showSuccess('Password reset link sent to your email.');
    } catch (e) {
      showError('Failed to send password reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Forgot Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e:any) => setEmail(e.target.value)} required />
          <Button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</Button>
        </form>
      </Card>
    </div>
  );
};

export default PasswordResetRequest;
