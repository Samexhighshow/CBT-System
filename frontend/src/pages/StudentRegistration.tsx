import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card, Alert } from '../components';

type ClassLevel = 'JSS1' | 'JSS2' | 'JSS3' | 'SSS1' | 'SSS2' | 'SSS3';

interface RegistrationFormData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  registration_number: string;
  department_id: string;
  class_level: ClassLevel;
  phone: string;
  guardian_phone: string;
  address: string;
}

const StudentRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegistrationFormData>({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    registration_number: '',
    department_id: '1',
    class_level: 'JSS1',
    phone: '',
    guardian_phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
    setSuccess('');

    // Validate passwords match
    if (formData.password !== formData.password_confirmation) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Temporary: simulate registration
      setTimeout(() => {
        setSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Registration</h1>
            <p className="text-gray-600">Create your account to access the CBT system</p>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {success && <Alert type="success" message={success} />}
          
          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Full Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                required
                fullWidth
              />

              <Input
                label="Registration Number"
                type="text"
                name="registration_number"
                value={formData.registration_number}
                onChange={handleChange}
                placeholder="REG/2024/001"
                required
                fullWidth
              />
            </div>

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

            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                required
                fullWidth
              />

              <Input
                label="Confirm Password"
                type="password"
                name="password_confirmation"
                value={formData.password_confirmation}
                onChange={handleChange}
                placeholder="Re-enter password"
                required
                fullWidth
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-gray-700">Class Level *</label>
                <select
                  name="class_level"
                  value={formData.class_level}
                  onChange={handleChange}
                  required
                  className="px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 focus:border-blue-500"
                >
                  <option value="JSS1">JSS 1</option>
                  <option value="JSS2">JSS 2</option>
                  <option value="JSS3">JSS 3</option>
                  <option value="SSS1">SSS 1</option>
                  <option value="SSS2">SSS 2</option>
                  <option value="SSS3">SSS 3</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-gray-700">Department *</label>
                <select
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleChange}
                  required
                  className="px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 focus:border-blue-500"
                >
                  <option value="1">Science</option>
                  <option value="2">Commercial</option>
                  <option value="3">Arts</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Phone Number"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="080XXXXXXXX"
                fullWidth
              />

              <Input
                label="Guardian Phone"
                type="tel"
                name="guardian_phone"
                value={formData.guardian_phone}
                onChange={handleChange}
                placeholder="080XXXXXXXX"
                fullWidth
              />
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className="text-sm font-medium text-gray-700">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                placeholder="Enter your residential address"
                className="px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 focus:border-blue-500"
              />
            </div>

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Login here
              </Link>
            </p>
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to Home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default StudentRegistration;
