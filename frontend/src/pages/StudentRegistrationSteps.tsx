import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card, Alert } from '../components';
import { showSuccess, showError } from '../utils/alerts';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

type ClassLevel = 'JSS1' | 'JSS2' | 'JSS3' | 'SSS1' | 'SSS2' | 'SSS3';

interface Class {
  id: number;
  name: string;
  level: ClassLevel;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface Step1Data {
  name: string;
  email: string;
  class_level: string;
  department_id: string;
}

interface Step2Data {
  guardian_name: string;
  guardian_relationship: string;
  guardian_phone: string;
  address: string;
  date_of_birth: string;
  gender: string;
}

interface Step3Data {
  password: string;
  password_confirmation: string;
}

const StudentRegistrationSteps: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Form data for each step
  const [step1Data, setStep1Data] = useState<Step1Data>({
    name: '',
    email: '',
    class_level: '',
    department_id: ''
  });

  const [step2Data, setStep2Data] = useState<Step2Data>({
    guardian_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    address: '',
    date_of_birth: '',
    gender: ''
  });

  const [step3Data, setStep3Data] = useState<Step3Data>({
    password: '',
    password_confirmation: ''
  });

  useEffect(() => {
    checkRegistrationStatus();
    fetchClasses();
    fetchDepartments();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings`);
      const settings = response.data;
      const regOpen = settings.find((s: any) => s.key === 'student_registration_open');
      if (regOpen && regOpen.value === false) {
        setError('Student registration is currently closed by the administrator');
      }
    } catch (error) {
      console.error('Failed to check registration status');
    }
  };

  const fetchClasses = async () => {
    // Use hardcoded class levels since classes endpoint requires auth
    // Admin must have created departments for SSS students
    const hardcodedClasses: Class[] = [
      { id: 1, name: 'JSS 1', level: 'JSS1' },
      { id: 2, name: 'JSS 2', level: 'JSS2' },
      { id: 3, name: 'JSS 3', level: 'JSS3' },
      { id: 4, name: 'SSS 1', level: 'SSS1' },
      { id: 5, name: 'SSS 2', level: 'SSS2' },
      { id: 6, name: 'SSS 3', level: 'SSS3' },
    ];
    
    setClasses(hardcodedClasses);
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${API_URL}/departments`);
      setDepartments(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch departments');
    }
  };

  const handleStep1Change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setStep1Data(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleStep2Change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setStep2Data(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleStep3Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStep3Data(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const validateStep1 = (): boolean => {
    if (!step1Data.name.trim()) {
      setError('Please enter your full name');
      return false;
    }
    if (!step1Data.email.trim()) {
      setError('Please enter your email address');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1Data.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!step1Data.class_level) {
      setError('Please select your class level');
      return false;
    }
    // Check if SSS student has selected department
    if (step1Data.class_level.startsWith('SSS') && !step1Data.department_id) {
      setError('Please select your department (required for SSS students)');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!step2Data.guardian_name.trim()) {
      setError('Please enter guardian name');
      return false;
    }
    if (!step2Data.guardian_relationship.trim()) {
      setError('Please enter relationship with guardian');
      return false;
    }
    if (!step2Data.guardian_phone.trim()) {
      setError('Please enter guardian phone number');
      return false;
    }
    if (!/^[0-9]{10,15}$/.test(step2Data.guardian_phone.replace(/[\s-]/g, ''))) {
      setError('Please enter a valid phone number (10-15 digits)');
      return false;
    }
    if (!step2Data.address.trim()) {
      setError('Please enter residential address');
      return false;
    }
    if (!step2Data.date_of_birth) {
      setError('Please enter your date of birth');
      return false;
    }
    if (!step2Data.gender) {
      setError('Please select your gender');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (!step3Data.password) {
      setError('Please enter a password');
      return false;
    }
    if (step3Data.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (step3Data.password !== step3Data.password_confirmation) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      window.scrollTo(0, 0);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
    setError('');
    window.scrollTo(0, 0);
  };

  const handleFinalSubmit = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    setError('');

    try {
      // Split name into first and last name
      const nameParts = step1Data.name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      // Find default department for JSS students (use first department or create a default)
      let departmentId = step1Data.department_id;
      if (!step1Data.class_level.startsWith('SSS')) {
        // For JSS students, use first available department or null
        departmentId = departments.length > 0 ? departments[0].id.toString() : '1';
      }

      const payload = {
        first_name: firstName,
        last_name: lastName,
        email: step1Data.email,
        class_level: step1Data.class_level,
        department_id: departmentId,
        guardian_name: step2Data.guardian_name,
        guardian_relationship: step2Data.guardian_relationship,
        guardian_phone: step2Data.guardian_phone,
        phone_number: step2Data.guardian_phone, // Same as guardian for now
        address: step2Data.address,
        date_of_birth: step2Data.date_of_birth,
        gender: step2Data.gender,
        password: step3Data.password,
        password_confirmation: step3Data.password_confirmation
      };

      const response = await axios.post(`${API_URL}/students`, payload);
      
      // Get the generated registration number from response
      const generatedRegNumber = response.data.registration_number || 
                                 response.data.student?.registration_number ||
                                 response.data.student?.id;
      setRegistrationNumber(generatedRegNumber);
      setShowSuccess(true);

      // Backend should send email notification automatically
      
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 
                      err.response?.data?.error ||
                      'Registration failed. Please try again.';
      setError(errorMsg);
      console.error('Registration error:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    navigate('/student-login');
  };

  // Success Screen
  if (showSuccess && registrationNumber) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <div className="text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <i className='bx bx-check text-4xl text-green-600'></i>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Registration Successful!</h1>
            <p className="text-gray-600 mb-6">Your student account has been created successfully.</p>
            
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
              <p className="text-sm text-gray-700 mb-2">Your Student Registration Number:</p>
              <p className="text-2xl font-bold text-blue-600 mb-4 select-all">{registrationNumber}</p>
              <p className="text-xs text-gray-600">
                <i className='bx bx-info-circle'></i> This registration number has been sent to your email: <strong>{step1Data.email}</strong>
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <i className='bx bx-key'></i> <strong>To login to your dashboard:</strong>
              </p>
              <p className="text-sm text-yellow-700 mt-2">
                Use your <strong>Registration Number</strong> + <strong>Password</strong>
              </p>
            </div>

            <Button onClick={handleLoginRedirect} fullWidth>
              Proceed to Login
            </Button>

            <p className="mt-4 text-xs text-gray-500">
              Please save your registration number for future reference.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Progress indicator
  const renderProgressSteps = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
              currentStep >= step 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step}
            </div>
            {step < 3 && (
              <div className={`flex-1 h-1 mx-2 ${
                currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-600">
        <span className={currentStep === 1 ? 'font-semibold text-blue-600' : ''}>Student Profile</span>
        <span className={currentStep === 2 ? 'font-semibold text-blue-600' : ''}>Guardian Info</span>
        <span className={currentStep === 3 ? 'font-semibold text-blue-600' : ''}>Security Setup</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Registration</h1>
            <p className="text-gray-600">Step {currentStep} of 3</p>
          </div>

          {renderProgressSteps()}

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}

          {/* Step 1: Student Profile */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Student Profile</h2>
              
              <Input
                label="Full Name"
                type="text"
                name="name"
                value={step1Data.name}
                onChange={handleStep1Change}
                placeholder="Enter your full name"
                required
                fullWidth
              />

              <Input
                label="Email Address"
                type="email"
                name="email"
                value={step1Data.email}
                onChange={handleStep1Change}
                placeholder="your.email@example.com"
                required
                fullWidth
              />

              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-gray-700">Class Level *</label>
                {classes.length === 0 ? (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    <i className='bx bx-error'></i> No classes available. Please contact the administrator.
                  </div>
                ) : (
                  <select
                    name="class_level"
                    value={step1Data.class_level}
                    onChange={handleStep1Change}
                    required
                    className="px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 focus:border-blue-500"
                  >
                    <option value="">Select Class Level</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.level}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Show department selection for SSS students */}
              {step1Data.class_level.startsWith('SSS') && (
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-sm font-medium text-gray-700">Department *</label>
                  {departments.length === 0 ? (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      <i className='bx bx-error'></i> No departments available. Please contact the administrator.
                    </div>
                  ) : (
                    <select
                      name="department_id"
                      value={step1Data.department_id}
                      onChange={handleStep1Change}
                      required
                      className="px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 focus:border-blue-500"
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-4 mt-8">
                <Link to="/student-login">
                  <Button variant="outline">Cancel</Button>
                </Link>
                <Button onClick={handleNextStep} disabled={classes.length === 0}>
                  Next <i className='bx bx-right-arrow-alt ml-2'></i>
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Guardian Profile */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Guardian Information</h2>

              <Input
                label="Guardian Name"
                type="text"
                name="guardian_name"
                value={step2Data.guardian_name}
                onChange={handleStep2Change}
                placeholder="Enter guardian's full name"
                required
                fullWidth
              />

              <Input
                label="Relationship"
                type="text"
                name="guardian_relationship"
                value={step2Data.guardian_relationship}
                onChange={handleStep2Change}
                placeholder="e.g., Father, Mother, Uncle"
                required
                fullWidth
              />

              <Input
                label="Guardian Phone Number"
                type="tel"
                name="guardian_phone"
                value={step2Data.guardian_phone}
                onChange={handleStep2Change}
                placeholder="080XXXXXXXX"
                required
                fullWidth
              />

              <div className="grid md:grid-cols-2 gap-6">
                <Input
                  label="Date of Birth"
                  type="date"
                  name="date_of_birth"
                  value={step2Data.date_of_birth}
                  onChange={handleStep2Change}
                  required
                  fullWidth
                />

                <div className="flex flex-col gap-2 w-full">
                  <label className="text-sm font-medium text-gray-700">Gender *</label>
                  <select
                    name="gender"
                    value={step2Data.gender}
                    onChange={handleStep2Change}
                    required
                    className="px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 focus:border-blue-500"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-gray-700">Residential Address *</label>
                <textarea
                  name="address"
                  value={step2Data.address}
                  onChange={handleStep2Change}
                  rows={4}
                  required
                  placeholder="Enter your complete residential address"
                  className="px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-between gap-4 mt-8">
                <Button variant="outline" onClick={handlePrevStep}>
                  <i className='bx bx-left-arrow-alt mr-2'></i> Back
                </Button>
                <Button onClick={handleNextStep}>
                  Next <i className='bx bx-right-arrow-alt ml-2'></i>
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Security Setup */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Security Setup</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <i className='bx bx-info-circle'></i> Create a strong password to secure your account.
                  After registration, you'll receive a <strong>Student Registration Number</strong> which you'll use to login.
                </p>
              </div>

              <Input
                label="Create Password"
                type="password"
                name="password"
                value={step3Data.password}
                onChange={handleStep3Change}
                placeholder="Minimum 8 characters"
                required
                fullWidth
              />

              <Input
                label="Confirm Password"
                type="password"
                name="password_confirmation"
                value={step3Data.password_confirmation}
                onChange={handleStep3Change}
                placeholder="Re-enter your password"
                required
                fullWidth
              />

              <div className="text-xs text-gray-600 space-y-1">
                <p>Password must contain:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>At least 8 characters</li>
                  <li>Mix of uppercase and lowercase letters (recommended)</li>
                  <li>Numbers and special characters (recommended)</li>
                </ul>
              </div>

              <div className="flex justify-between gap-4 mt-8">
                <Button variant="outline" onClick={handlePrevStep}>
                  <i className='bx bx-left-arrow-alt mr-2'></i> Back
                </Button>
                <Button onClick={handleFinalSubmit} loading={loading}>
                  {loading ? 'Registering...' : 'Complete Registration'}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/student-login" className="text-blue-600 hover:text-blue-700 font-medium">
                Login here
              </Link>
            </p>
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 block">
              ← Back to Home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default StudentRegistrationSteps;
