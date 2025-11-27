import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card, Alert } from '../components';

interface LoginFormData {
  email: string;
  password: string;
}

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Temporary: simulate login with admin@cbtsystem.local
      setTimeout(() => {
        localStorage.setItem('token', 'admin_token_' + Date.now());
        localStorage.setItem('user', JSON.stringify({ 
          name: 'Administrator',
          email: formData.email,
          role: 'admin'
        }));
        navigate('/admin');
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Portal</h1>
          <p className="text-gray-600">Secure access for administrators</p>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <Input
            label="Email Address"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="admin@cbtsystem.local"
            required
            fullWidth
          />

          <Input
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter admin password"
            required
            fullWidth
          />

          <Button type="submit" fullWidth loading={loading}>
            {loading ? 'Verifying...' : 'Login as Admin'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 mb-2">
            Default: admin@cbtsystem.local / admin123456
          </p>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Home
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default AdminLogin;
