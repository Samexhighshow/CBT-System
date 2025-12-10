import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card, Alert } from '../components';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

interface Class {
  id: number;
  name: string;
  code: string;
  description?: string;
}

interface Department {
  id: number;
  name: string;
  description?: string;
}

interface Step1Data {
  first_name: string;
  last_name: string;
  middle_name: string;
  date_of_birth: string;
  class_id: string;
  department_id: string;
  gender: string;
}

interface Step2Data {
  guardian_first_name: string;
  guardian_last_name: string;
  guardian_relationship: string;
  guardian_phone: string;
  guardian_gender: string;
  address: string;
}

interface Step3Data {
  password: string;
  password_confirmation: string;
}

const StudentRegistrationForm: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const [step1Data, setStep1Data] = useState<Step1Data>({
    first_name: '',
    last_name: '',
    middle_name: '',
    date_of_birth: '',
    class_id: '',
    department_id: '',
    gender: ''
  });

  const [step2Data, setStep2Data] = useState<Step2Data>({
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    guardian_gender: '',
    address: ''
  });

  const [step3Data, setStep3Data] = useState<Step3Data>({
    password: '',
    password_confirmation: ''
  });

  const [email, setEmail] = useState('');

  const selectedClass = classes.find(c => c.id === parseInt(step1Data.class_id));
  const requiresDepartment = selectedClass?.name?.includes('SSS');

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (requiresDepartment && step1Data.class_id) {
      fetchDepartments();
    } else {
      setDepartments([]);
      setStep1Data(prev => ({ ...prev, department_id: '' }));
    }
  }, [requiresDepartment, step1Data.class_id]);

  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const response = await axios.get(`${API_URL}/classes`);
      setClasses(response.data.data || response.data);
      setError('');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to load classes';
      setError(errorMsg);
      console.error('Fetch classes error:', err);
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const response = await axios.get(`${API_URL}/departments`);
      setDepartments(response.data.data || response.data);
    } catch (err: any) {
      console.error('Fetch departments error:', err);
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleStep1Change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStep1Data(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleStep2Change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setStep2Data(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleStep3Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStep3Data(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateStep1 = (): boolean => {
    if (!step1Data.first_name.trim()) {
      setError('Please enter your first name');
      return false;
    }
    if (!step1Data.last_name.trim()) {
      setError('Please enter your last name');
      return false;
    }
    if (!email.trim()) {
      setError('Please enter your email address');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!step1Data.date_of_birth) {
      setError('Please select your date of birth');
      return false;
    }
    if (!step1Data.gender) {
      setError('Please select your gender');
      return false;
    }
    if (!step1Data.class_id) {
      setError('Please select a class');
      return false;
    }
    if (requiresDepartment && !step1Data.department_id) {
      setError('Please select a department');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!step2Data.guardian_first_name.trim()) {
      setError('Please enter guardian first name');
      return false;
    }
    if (!step2Data.guardian_last_name.trim()) {
      setError('Please enter guardian last name');
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
    if (!/^[0-9+\-\s()]{10,}$/.test(step2Data.guardian_phone)) {
      setError('Please enter a valid phone number');
      return false;
    }
    if (!step2Data.guardian_gender) {
      setError('Please select guardian gender');
      return false;
    }
    if (!step2Data.address.trim()) {
      setError('Please enter residential address');
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
      const payload = {
        first_name: step1Data.first_name,
        last_name: step1Data.last_name,
        other_names: step1Data.middle_name || null,
        email: email,
        date_of_birth: step1Data.date_of_birth,
        gender: step1Data.gender,
        class_id: parseInt(step1Data.class_id),
        department_id: step1Data.department_id ? parseInt(step1Data.department_id) : null,
        guardian_first_name: step2Data.guardian_first_name,
        guardian_last_name: step2Data.guardian_last_name,
        guardian_relationship: step2Data.guardian_relationship,
        guardian_phone: step2Data.guardian_phone,
        guardian_gender: step2Data.guardian_gender,
        address: step2Data.address,
        password: step3Data.password,
        password_confirmation: step3Data.password_confirmation
      };

      const response = await axios.post(`${API_URL}/students`, payload);

      const generatedRegNumber = response.data.registration_number ||
                                 response.data.student?.registration_number ||
                                 response.data.student?.id;

      setRegistrationNumber(generatedRegNumber);
      setShowSuccess(true);

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
      <div className="min-h-screen w-full bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center py-3 px-3">
        <Card className="w-full max-w-sm shadow-lg p-3">
          <div className="text-center">
            <div className="mb-2">
              <div className="mx-auto w-11 h-11 bg-green-100 rounded-full flex items-center justify-center shadow">
                <i className='bx bx-check text-xl text-green-600'></i>
              </div>
            </div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 mb-1">Registration Successful!</h1>
            <p className="text-gray-600 mb-2.5 text-xs">Your account has been created successfully.</p>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded p-2.5 mb-2.5">
              <p className="text-xs text-gray-700 mb-0.5 font-medium">Your Registration Number:</p>
              <p className="text-lg md:text-xl font-bold text-blue-600 mb-1.5 select-all tracking-wide">{registrationNumber}</p>
              <p className="text-xs text-gray-600">
                <i className='bx bx-envelope text-xs'></i> Sent to: <strong>{email}</strong>
              </p>
            </div>

            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded p-2 mb-2.5">
              <p className="text-xs text-yellow-800 font-medium">
                <i className='bx bx-key text-xs'></i> Use your <strong>Registration Number</strong> and <strong>Password</strong> to login
              </p>
            </div>

            <Button onClick={handleLoginRedirect} fullWidth className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-1.5 rounded text-xs transition-all duration-300 shadow">
              Proceed to Login
            </Button>

            <p className="mt-2.5 text-xs text-gray-500">
              <i className='bx bx-save text-xs'></i> Save your registration number for future reference
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const renderProgressSteps = () => (
    <div className="mb-3">
      {/* Step Circles with Lines */}
      <div className="relative flex items-center justify-center mb-2">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gray-200 -translate-y-1/2"></div>
        <div className="relative flex justify-between w-full max-w-xs mx-auto px-4">
          {[
            { num: 1, label: 'Student', icon: 'bx-user' },
            { num: 2, label: 'Guardian', icon: 'bx-group' },
            { num: 3, label: 'Security', icon: 'bx-shield-alt' }
          ].map((step) => (
            <div key={step.num} className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                currentStep >= step.num
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md ring-4 ring-blue-100'
                  : 'bg-white text-gray-400 border-2 border-gray-200'
              }`}>
                {currentStep > step.num ? (
                  <i className='bx bx-check text-base'></i>
                ) : (
                  step.num
                )}
              </div>
              <div className={`mt-1.5 text-center transition-colors duration-300 ${
                currentStep === step.num ? 'text-blue-600' : 'text-gray-500'
              }`}>
                <i className={`bx ${step.icon} text-sm block mb-0.5`}></i>
                <span className="text-xs font-medium">{step.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-3 px-3">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-3">
          <div className="inline-block mb-1">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow">
              <i className='bx bx-book-open text-white text-base'></i>
            </div>
          </div>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Student Registration</h1>
          <p className="text-gray-600 text-xs mt-0.5">Complete all steps to create your account</p>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg border-0 p-2.5 md:p-3">
          {error && (
            <div className="mb-2.5 p-2 bg-red-50 border-l-4 border-red-500 rounded">
              <div className="flex items-center">
                <i className='bx bx-error-circle text-red-500 text-base mr-1.5'></i>
                <span className="text-red-700 text-xs font-medium">{error}</span>
              </div>
            </div>
          )}

          {renderProgressSteps()}

          {/* Step 1: Student Profile */}
          {currentStep === 1 && (
            <div className="space-y-2.5">
              {/* Section Header */}
              <div className="pb-2 border-b border-gray-200">
                <h2 className="text-sm md:text-base font-bold text-gray-900 flex items-center">
                  <i className='bx bx-user-circle text-blue-600 text-base mr-1'></i>
                  Student Profile
                </h2>
                <p className="text-gray-600 mt-0.5 text-xs">Enter your basic information</p>
              </div>

              {/* Name Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-2.5 rounded border border-blue-100">
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 mb-2 flex items-center">
                  <i className='bx bx-id-card text-blue-600 mr-1 text-sm'></i>
                  Full Name
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    label="First Name"
                    type="text"
                    name="first_name"
                    value={step1Data.first_name}
                    onChange={handleStep1Change}
                    placeholder="John"
                    required
                    fullWidth
                  />
                  <Input
                    label="Last Name"
                    type="text"
                    name="last_name"
                    value={step1Data.last_name}
                    onChange={handleStep1Change}
                    placeholder="Doe"
                    required
                    fullWidth
                  />
                  <Input
                    label="Middle Name (Optional)"
                    type="text"
                    name="middle_name"
                    value={step1Data.middle_name}
                    onChange={handleStep1Change}
                    placeholder="James"
                    fullWidth
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-2.5 rounded border border-green-100">
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 mb-2 flex items-center">
                  <i className='bx bx-envelope text-green-600 mr-1 text-sm'></i>
                  Contact Information
                </h3>
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="your.email@example.com"
                  required
                  fullWidth
                />
              </div>

              {/* Personal Details */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-2.5 rounded border border-purple-100">
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 mb-2 flex items-center">
                  <i className='bx bx-calendar text-purple-600 mr-1 text-sm'></i>
                  Personal Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    label="Date of Birth"
                    type="date"
                    name="date_of_birth"
                    value={step1Data.date_of_birth}
                    onChange={handleStep1Change}
                    required
                    fullWidth
                  />
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-gray-700">Gender *</label>
                    <select
                      name="gender"
                      value={step1Data.gender}
                      onChange={handleStep1Change}
                      required
                      className="px-2 py-1.5 border-2 border-gray-300 rounded text-xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-300"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-2.5 rounded border border-orange-100">
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 mb-2 flex items-center">
                  <i className='bx bx-book text-orange-600 mr-1 text-sm'></i>
                  Academic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-gray-700">Class Level *</label>
                    {loadingClasses ? (
                      <div className="text-xs text-blue-600 py-1.5">
                        <i className='bx bx-loader-alt animate-spin mr-2'></i>
                        Loading classes...
                      </div>
                    ) : classes.length === 0 ? (
                      <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                        <i className='bx bx-error'></i> No classes available
                      </div>
                    ) : (
                      <select
                        name="class_id"
                        value={step1Data.class_id}
                        onChange={handleStep1Change}
                        required
                        className="px-4 py-3 border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent hover:border-orange-300"
                      >
                        <option value="">Select Class</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} {cls.code && `(${cls.code})`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Conditional Department Field */}
                  {requiresDepartment && (
                    <div className="flex flex-col gap-2 w-full">
                      <label className="text-sm font-semibold text-gray-700">Department *</label>
                      {loadingDepartments ? (
                        <div className="text-sm text-blue-600 py-3">
                          <i className='bx bx-loader-alt animate-spin mr-2'></i>
                          Loading departments...
                        </div>
                      ) : departments.length === 0 ? (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                          <i className='bx bx-error'></i> No departments available
                        </div>
                      ) : (
                        <select
                          name="department_id"
                          value={step1Data.department_id}
                          onChange={handleStep1Change}
                          required
                          className="px-4 py-3 border-2 border-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent hover:border-orange-300"
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
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-end gap-2 pt-2.5 border-t border-gray-200">
                <Link to="/student-login">
                  <Button variant="outline" className="px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-100 transition-colors">
                    <i className='bx bx-left-arrow-alt mr-1 text-sm'></i>
                    Cancel
                  </Button>
                </Link>
                <Button 
                  onClick={handleNextStep} 
                  disabled={loadingClasses}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-50 transition-all"
                >
                  Next
                  <i className='bx bx-right-arrow-alt ml-1 text-sm'></i>
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Guardian Profile */}
          {currentStep === 2 && (
            <div className="space-y-2.5">
              {/* Section Header */}
              <div className="pb-2 border-b border-gray-200">
                <h2 className="text-sm md:text-base font-bold text-gray-900 flex items-center">
                  <i className='bx bx-group text-green-600 text-base mr-1'></i>
                  Guardian Profile
                </h2>
                <p className="text-gray-600 mt-0.5 text-xs">Tell us about your guardian/parent</p>
              </div>

              {/* Guardian Name Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-2.5 rounded border border-green-100">
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 mb-2 flex items-center">
                  <i className='bx bx-id-card text-green-600 mr-1 text-sm'></i>
                  Guardian Name
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    label="Guardian First Name"
                    type="text"
                    name="guardian_first_name"
                    value={step2Data.guardian_first_name}
                    onChange={handleStep2Change}
                    placeholder="John"
                    required
                    fullWidth
                  />
                  <Input
                    label="Guardian Last Name"
                    type="text"
                    name="guardian_last_name"
                    value={step2Data.guardian_last_name}
                    onChange={handleStep2Change}
                    placeholder="Doe"
                    required
                    fullWidth
                  />
                </div>
              </div>

              {/* Guardian Details Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-2.5 rounded border border-blue-100">
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 mb-2 flex items-center">
                  <i className='bx bx-info-circle text-blue-600 mr-1 text-sm'></i>
                  Guardian Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    label="Relationship"
                    type="text"
                    name="guardian_relationship"
                    value={step2Data.guardian_relationship}
                    onChange={handleStep2Change}
                    placeholder="e.g., Father, Mother, Uncle, Aunt"
                    required
                    fullWidth
                  />
                  <Input
                    label="Guardian Phone Number"
                    type="tel"
                    name="guardian_phone"
                    value={step2Data.guardian_phone}
                    onChange={handleStep2Change}
                    placeholder="+234 8012345678"
                    required
                    fullWidth
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-gray-700">Guardian Gender *</label>
                    <select
                      name="guardian_gender"
                      value={step2Data.guardian_gender}
                      onChange={handleStep2Change}
                      required
                      className="px-2 py-1.5 border-2 border-gray-300 rounded text-xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-300"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <Input
                    label="Residential Address"
                    type="text"
                    name="address"
                    value={step2Data.address}
                    onChange={handleStep2Change}
                    placeholder="123 Main Street, City"
                    required
                    fullWidth
                  />
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between gap-2 pt-2.5 border-t border-gray-200">
                <Button 
                  onClick={handlePrevStep}
                  variant="outline"
                  className="px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-100 transition-colors"
                >
                  <i className='bx bx-left-arrow-alt mr-1 text-sm'></i>
                  Back
                </Button>
                <Button 
                  onClick={handleNextStep}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white transition-all"
                >
                  Next
                  <i className='bx bx-right-arrow-alt ml-1 text-sm'></i>
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Security Setup */}
          {currentStep === 3 && (
            <div className="space-y-2.5">
              {/* Section Header */}
              <div className="pb-2 border-b border-gray-200">
                <h2 className="text-sm md:text-base font-bold text-gray-900 flex items-center">
                  <i className='bx bx-shield-alt text-purple-600 text-base mr-1'></i>
                  Security Setup
                </h2>
                <p className="text-gray-600 mt-0.5 text-xs">Create a strong password for your account</p>
              </div>

              {/* Password Section */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-2.5 rounded border border-purple-100">
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 mb-2 flex items-center">
                  <i className='bx bx-lock-alt text-purple-600 mr-1 text-sm'></i>
                  Create Password
                </h3>
                <div className="space-y-2">
                  <Input
                    label="Password"
                    type="password"
                    name="password"
                    value={step3Data.password}
                    onChange={handleStep3Change}
                    placeholder="Enter a strong password"
                    required
                    fullWidth
                  />
                  <Input
                    label="Confirm Password"
                    type="password"
                    name="password_confirmation"
                    value={step3Data.password_confirmation}
                    onChange={handleStep3Change}
                    placeholder="Confirm your password"
                    required
                    fullWidth
                  />

                  {/* Password Requirements */}
                  <div className="bg-white rounded p-2 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Password Requirements:</p>
                    <ul className="space-y-0.5 text-xs text-gray-600">
                      <li className={step3Data.password.length >= 8 ? 'text-green-600' : 'text-gray-600'}>
                        <i className={`bx ${step3Data.password.length >= 8 ? 'bx-check-circle' : 'bx-circle'} mr-1`}></i>
                        At least 8 characters long
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between gap-2 pt-2.5 border-t border-gray-200">
                <Button 
                  onClick={handlePrevStep}
                  variant="outline"
                  className="px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-100 transition-colors"
                >
                  <i className='bx bx-left-arrow-alt mr-1 text-sm'></i>
                  Back
                </Button>
                <Button 
                  onClick={handleFinalSubmit}
                  disabled={loading}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <i className='bx bx-loader-alt animate-spin mr-1 text-sm'></i>
                      Creating...
                    </>
                  ) : (
                    <>
                      Complete
                      <i className='bx bx-right-arrow-alt ml-1 text-sm'></i>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StudentRegistrationForm;
