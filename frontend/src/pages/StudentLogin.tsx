import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Button, Input, Card, Alert } from '../components';
import useAuthStore from '../store/authStore';

interface LoginFormData {
  email: string;
  password: string;
}

const StudentLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  React.useEffect(() => {
    // Only redirect if we're coming from a direct navigation, not from a failed login
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const isStudent = user.roles?.some((r: any) => r.name === 'Student');
        
        if (isStudent) {
          // Verify token is actually valid before redirecting
          console.log('Detected existing student login, checking validity...');
          
          // Don't auto-redirect, let user click login or clear storage
          // This prevents redirect loops when token is invalid
        }
      } catch (e) {
        // Invalid user data, clear it
        console.error('Invalid stored user data, clearing...');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('subjectsSelected');
      }
    }
  }, [navigate]);

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
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/login`, formData);
      const { token, user } = res.data;
      login(user, token);
      
      // Check if student needs to select subjects
      const subjectsSelected = localStorage.getItem('subjectsSelected');
      if (!subjectsSelected && user.roles?.some((r: any) => r.name === 'Student')) {
        // Redirect to subject selection
        navigate('/select-subjects');
      } else {
        navigate('/student');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      
      // If email not verified, show specific message
      if (err?.response?.status === 403 && err?.response?.data?.email_verified === false) {
        setError(`${errorMessage}\n\nPlease check your email (${err?.response?.data?.email}) for the verification link.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Login</h1>
          <p className="text-gray-600">Access your exam dashboard</p>
        </div>
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <Input
            label="Email Address"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="your.email@example.com"
            required
            fullWidth
          />
          <Input
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
            fullWidth
          />
          <Button type="submit" fullWidth loading={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Register here
            </Link>
          </p>
          <p className="text-xs text-gray-500">
            <Link to="/exam-access" className="text-blue-600 hover:text-blue-700 font-medium">
              Have an exam access code? Login here
            </Link>
          </p>
          <p className="text-xs text-gray-500">Forgot password? <Link to="/forgot-password-otp" className="text-blue-600 hover:text-blue-700">Use OTP reset</Link></p>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Home
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default StudentLogin;
