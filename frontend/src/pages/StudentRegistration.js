import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentAPI } from '../services/api';

function StudentRegistration() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'M',
    dateOfBirth: '',
    classLevel: 'JSS1',
    departmentId: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(false);

  React.useEffect(() => {
    // Check if registration window is open
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const response = await studentAPI.getRegistrationStatus();
      setRegistrationOpen(response.data.registrationOpen);
    } catch (err) {
      setError('Failed to check registration status');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!registrationOpen) {
      setError('Registration window is currently closed');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await studentAPI.register(formData);
      localStorage.setItem('studentId', response.data.studentId);
      navigate('/student-login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (!registrationOpen) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '500px', margin: '50px auto' }}>
          <h1>Student Registration</h1>
          <div className="alert alert-error">
            Registration is currently closed. Please check back during the registration window.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '500px', margin: '30px auto' }}>
        <h1>Student Registration</h1>
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Gender *</label>
            <select name="gender" value={formData.gender} onChange={handleChange} required>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Date of Birth *</label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Class Level *</label>
            <select name="classLevel" value={formData.classLevel} onChange={handleChange} required>
              <option value="JSS1">JSS 1</option>
              <option value="JSS2">JSS 2</option>
              <option value="JSS3">JSS 3</option>
              <option value="SSS1">SSS 1</option>
              <option value="SSS2">SSS 2</option>
              <option value="SSS3">SSS 3</option>
            </select>
          </div>

          <div className="form-group">
            <label>Department (for SSS)</label>
            <select name="departmentId" value={formData.departmentId} onChange={handleChange}>
              <option value="">Select Department</option>
              <option value="science">Science</option>
              <option value="commercial">Commercial</option>
              <option value="arts">Arts</option>
            </select>
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p style={{ marginTop: '20px', textAlign: 'center' }}>
          Already registered? <a href="/student-login">Login here</a>
        </p>
      </div>
    </div>
  );
}

export default StudentRegistration;
