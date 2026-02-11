import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

// Custom dark-themed input component
const DarkInput: React.FC<{
  label: string;
  type?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}> = ({ label, type = 'text', name, value, onChange, placeholder, required }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-gray-300">
      {label} {required && <span className="text-emerald-400">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
    />
  </div>
);

// Custom dark-themed select component
const DarkSelect: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, name, value, onChange, required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-gray-300">
      {label} {required && <span className="text-emerald-400">*</span>}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer"
    >
      {children}
    </select>
  </div>
);

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
      const response = await axios.get(`${API_URL}/classes?is_active=1`);
      setClasses(response.data.data || response.data);
      setError('');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to load classes';
      setError(errorMsg);
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
    if (!step1Data.first_name.trim()) { setError('Please enter your first name'); return false; }
    if (!step1Data.last_name.trim()) { setError('Please enter your last name'); return false; }
    if (!email.trim()) { setError('Please enter your email address'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address'); return false; }
    if (!step1Data.date_of_birth) { setError('Please select your date of birth'); return false; }
    if (!step1Data.gender) { setError('Please select your gender'); return false; }
    if (!step1Data.class_id) { setError('Please select a class'); return false; }
    if (requiresDepartment && !step1Data.department_id) { setError('Please select a department'); return false; }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!step2Data.guardian_first_name.trim()) { setError('Please enter guardian first name'); return false; }
    if (!step2Data.guardian_last_name.trim()) { setError('Please enter guardian last name'); return false; }
    if (!step2Data.guardian_relationship.trim()) { setError('Please enter relationship with guardian'); return false; }
    if (!step2Data.guardian_phone.trim()) { setError('Please enter guardian phone number'); return false; }
    if (!/^[0-9+\-\s()]{10,}$/.test(step2Data.guardian_phone)) { setError('Please enter a valid phone number'); return false; }
    if (!step2Data.guardian_gender) { setError('Please select guardian gender'); return false; }
    if (!step2Data.address.trim()) { setError('Please enter residential address'); return false; }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (!step3Data.password) { setError('Please enter a password'); return false; }
    if (step3Data.password.length < 8) { setError('Password must be at least 8 characters long'); return false; }
    if (step3Data.password !== step3Data.password_confirmation) { setError('Passwords do not match'); return false; }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) { setCurrentStep(2); window.scrollTo(0, 0); }
    else if (currentStep === 2 && validateStep2()) { setCurrentStep(3); window.scrollTo(0, 0); }
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
      const generatedRegNumber = response.data.registration_number || response.data.student?.registration_number || response.data.student?.id;
      setRegistrationNumber(generatedRegNumber);
      setShowSuccess(true);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginRedirect = () => navigate('/student-login');

  // Success Screen
  if (showSuccess && registrationNumber) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Registration Successful!</h1>
            <p className="text-gray-400 mb-6">Your account has been created successfully.</p>

            <div className="bg-slate-700/50 border border-emerald-500/30 rounded-xl p-5 mb-5">
              <p className="text-sm text-gray-300 mb-1">Your Registration Number:</p>
              <p className="text-2xl font-bold text-emerald-400 mb-2 select-all tracking-wider">{registrationNumber}</p>
              <p className="text-xs text-gray-500">Sent to: <span className="text-gray-300">{email}</span></p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-300">
                Use your <strong>Registration Number</strong> and <strong>Password</strong> to login
              </p>
            </div>

            <button onClick={handleLoginRedirect} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg">
              Proceed to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Progress Steps
  const renderProgressSteps = () => (
    <div className="mb-6">
      <div className="relative flex items-center justify-between max-w-xs mx-auto">
        {/* Progress Line */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-slate-700" />
        <div className="absolute left-0 top-5 h-0.5 bg-emerald-500 transition-all duration-500" style={{ width: `${((currentStep - 1) / 2) * 100}%` }} />

        {[
          { num: 1, label: 'Student', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
          { num: 2, label: 'Guardian', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
          { num: 3, label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' }
        ].map((step) => (
          <div key={step.num} className="relative flex flex-col items-center z-10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${currentStep >= step.num
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-slate-700 text-gray-500 border border-slate-600'
              }`}>
              {currentStep > step.num ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                </svg>
              )}
            </div>
            <span className={`mt-2 text-xs font-medium ${currentStep >= step.num ? 'text-emerald-400' : 'text-gray-500'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 py-6 px-4">
      {/* Subtle Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-600 rounded-full mix-blend-multiply filter blur-3xl opacity-5" />
      </div>

      <div className="relative max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl shadow-lg mb-3">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Student Registration</h1>
          <p className="text-gray-400 text-sm mt-1">Complete all steps to create your account</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-6">
          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            </div>
          )}

          {renderProgressSteps()}

          {/* Step 1: Student Profile */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="pb-3 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Student Profile
                </h2>
                <p className="text-gray-400 text-sm mt-1">Enter your basic information</p>
              </div>

              {/* Full Name Section */}
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  Full Name
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DarkInput label="First Name" name="first_name" value={step1Data.first_name} onChange={handleStep1Change} placeholder="John" required />
                  <DarkInput label="Last Name" name="last_name" value={step1Data.last_name} onChange={handleStep1Change} placeholder="Doe" required />
                  <DarkInput label="Middle Name" name="middle_name" value={step1Data.middle_name} onChange={handleStep1Change} placeholder="James (Optional)" />
                </div>
              </div>

              {/* Email Section */}
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Information
                </h3>
                <DarkInput label="Email Address" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder="your.email@example.com" required />
              </div>

              {/* Personal Details Section */}
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Personal Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DarkInput label="Date of Birth" type="date" name="date_of_birth" value={step1Data.date_of_birth} onChange={handleStep1Change} required />
                  <DarkSelect label="Gender" name="gender" value={step1Data.gender} onChange={handleStep1Change} required>
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </DarkSelect>
                </div>
              </div>

              {/* Academic Information Section */}
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Academic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-300">Class Level <span className="text-emerald-400">*</span></label>
                    {loadingClasses ? (
                      <div className="flex items-center gap-2 text-emerald-400 py-2.5 text-sm">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading classes...
                      </div>
                    ) : classes.length === 0 ? (
                      <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/30">
                        No classes available
                      </div>
                    ) : (
                      <select name="class_id" value={step1Data.class_id} onChange={handleStep1Change} required className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm">
                        <option value="">Select Class</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>{cls.name} {cls.code && `(${cls.code})`}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {requiresDepartment && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-300">Department <span className="text-emerald-400">*</span></label>
                      {loadingDepartments ? (
                        <div className="flex items-center gap-2 text-emerald-400 py-2.5 text-sm">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Loading...
                        </div>
                      ) : (
                        <select name="department_id" value={step1Data.department_id} onChange={handleStep1Change} required className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm">
                          <option value="">Select Department</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-700">
                <Link to="/student-login" className="px-5 py-2.5 text-gray-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-all text-sm font-medium">
                  Cancel
                </Link>
                <button onClick={handleNextStep} disabled={loadingClasses} className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all flex items-center gap-2 text-sm">
                  Next Step
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Guardian Profile */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="pb-3 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Guardian Profile
                </h2>
                <p className="text-gray-400 text-sm mt-1">Tell us about your guardian/parent</p>
              </div>

              {/* Guardian Name */}
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                <h3 className="text-sm font-medium text-emerald-400 mb-3">Guardian Name</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DarkInput label="First Name" name="guardian_first_name" value={step2Data.guardian_first_name} onChange={handleStep2Change} placeholder="John" required />
                  <DarkInput label="Last Name" name="guardian_last_name" value={step2Data.guardian_last_name} onChange={handleStep2Change} placeholder="Doe" required />
                </div>
              </div>

              {/* Guardian Details */}
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                <h3 className="text-sm font-medium text-emerald-400 mb-3">Guardian Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DarkInput label="Relationship" name="guardian_relationship" value={step2Data.guardian_relationship} onChange={handleStep2Change} placeholder="e.g., Father, Mother" required />
                  <DarkInput label="Phone Number" type="tel" name="guardian_phone" value={step2Data.guardian_phone} onChange={handleStep2Change} placeholder="+234 8012345678" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <DarkSelect label="Gender" name="guardian_gender" value={step2Data.guardian_gender} onChange={handleStep2Change} required>
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </DarkSelect>
                  <DarkInput label="Address" name="address" value={step2Data.address} onChange={handleStep2Change} placeholder="123 Main Street, City" required />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-700">
                <button onClick={handlePrevStep} className="px-5 py-2.5 text-gray-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-all text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button onClick={handleNextStep} className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center gap-2 text-sm">
                  Next Step
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Security */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="pb-3 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Security Setup
                </h2>
                <p className="text-gray-400 text-sm mt-1">Create a strong password for your account</p>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                <h3 className="text-sm font-medium text-emerald-400 mb-3">Create Password</h3>
                <div className="space-y-4">
                  <DarkInput label="Password" type="password" name="password" value={step3Data.password} onChange={handleStep3Change} placeholder="Enter a strong password" required />
                  <DarkInput label="Confirm Password" type="password" name="password_confirmation" value={step3Data.password_confirmation} onChange={handleStep3Change} placeholder="Confirm your password" required />

                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
                    <p className="text-xs font-medium text-gray-400 mb-2">Password Requirements:</p>
                    <div className={`flex items-center gap-2 text-xs ${step3Data.password.length >= 8 ? 'text-emerald-400' : 'text-gray-500'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step3Data.password.length >= 8 ? "M5 13l4 4L19 7" : "M12 8v4m0 4h.01"} />
                      </svg>
                      At least 8 characters long
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-700">
                <button onClick={handlePrevStep} className="px-5 py-2.5 text-gray-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-all text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button onClick={handleFinalSubmit} disabled={loading} className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all flex items-center gap-2 text-sm">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Complete Registration
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm">
            Already have an account?{' '}
            <Link to="/student-login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentRegistrationForm;
