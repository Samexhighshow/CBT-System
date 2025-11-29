import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { showSuccess, showError } from '../../utils/alerts';
import { Button, Input, Card } from '../../components';

const AdminSignup: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/admin/signup`, { name, email, password });
      await showSuccess('Application submitted successfully! Main Admin will review and assign your role.');
      navigate('/admin-login');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to submit application';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Admin Application</h1>
          <p className="text-gray-300">Request admin access to the system</p>
        </div>
        <form onSubmit={submit} className="space-y-6 mt-6">
          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder="Your full name"
            required
            fullWidth
          />
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="your.email@example.com"
            required
            fullWidth
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="Choose a strong password"
            required
            fullWidth
          />
          <Button type="submit" fullWidth loading={loading}>
            {loading ? 'Submitting...' : 'Submit Application'}
          </Button>
        </form>
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-gray-400">After submission, a Main Admin will review and assign your role.</p>
          <p className="text-sm text-gray-300">Already have an account? <Link to="/admin-login" className="text-blue-400 hover:text-blue-300">Login here</Link></p>
          <Link to="/" className="text-sm text-gray-300 hover:text-gray-100 block">← Back to Home</Link>
        </div>
      </Card>
    </div>
  );
};

export default AdminSignup;
