import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

interface ClassOption {
  id: number;
  name: string;
  code?: string;
}

interface DepartmentOption {
  id: number;
  name: string;
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

const FieldLabel: React.FC<{ text: string; required?: boolean }> = ({ text, required }) => (
  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
    {text} {required ? <span className="text-red-500">*</span> : null}
  </label>
);

const InputField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}> = ({ label, value, onChange, type = 'text', placeholder, required, maxLength }) => (
  <div>
    <FieldLabel text={label} required={required} />
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, value, onChange, required, children }) => (
  <div>
    <FieldLabel text={label} required={required} />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
    >
      {children}
    </select>
  </div>
);

const StudentRegistrationForm: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState('');

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [email, setEmail] = useState('');
  const [step1Data, setStep1Data] = useState<Step1Data>({
    first_name: '',
    last_name: '',
    middle_name: '',
    date_of_birth: '',
    class_id: '',
    department_id: '',
    gender: '',
  });

  const [step2Data, setStep2Data] = useState<Step2Data>({
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    guardian_gender: '',
    address: '',
  });

  const [step3Data, setStep3Data] = useState<Step3Data>({
    password: '',
    password_confirmation: '',
  });

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === Number(step1Data.class_id)),
    [classes, step1Data.class_id]
  );

  const requiresDepartment = useMemo(() => {
    const name = (selectedClass?.name || '').toUpperCase();
    return name.includes('SSS') || name.includes('SS');
  }, [selectedClass?.name]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoadingClasses(true);
        const response = await axios.get(`${API_URL}/public/classes?is_active=1`);
        const payload = response.data?.data || response.data || [];
        setClasses(Array.isArray(payload) ? payload : []);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load classes');
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClasses();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      if (!requiresDepartment || !step1Data.class_id) {
        setDepartments([]);
        setStep1Data((prev) => ({ ...prev, department_id: '' }));
        return;
      }

      try {
        setLoadingDepartments(true);
        const response = await axios.get(`${API_URL}/departments`);
        const payload = response.data?.data || response.data || [];
        setDepartments(Array.isArray(payload) ? payload : []);
      } catch {
        setDepartments([]);
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchDepartments();
  }, [requiresDepartment, step1Data.class_id]);

  const validateStep1 = (): boolean => {
    if (!step1Data.first_name.trim()) {
      setError('Please enter your first name.');
      return false;
    }
    if (!step1Data.last_name.trim()) {
      setError('Please enter your last name.');
      return false;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!step1Data.date_of_birth) {
      setError('Please select your date of birth.');
      return false;
    }
    if (!step1Data.gender) {
      setError('Please select your gender.');
      return false;
    }
    if (!step1Data.class_id) {
      setError('Please select your class.');
      return false;
    }
    if (requiresDepartment && !step1Data.department_id) {
      setError('Please select your department.');
      return false;
    }

    return true;
  };

  const validateStep2 = (): boolean => {
    if (!step2Data.guardian_first_name.trim()) {
      setError('Please enter guardian first name.');
      return false;
    }
    if (!step2Data.guardian_last_name.trim()) {
      setError('Please enter guardian last name.');
      return false;
    }
    if (!step2Data.guardian_relationship.trim()) {
      setError('Please enter guardian relationship.');
      return false;
    }
    if (!step2Data.guardian_phone.trim()) {
      setError('Please enter guardian phone number.');
      return false;
    }
    if (!/^[0-9+\-\s()]{10,}$/.test(step2Data.guardian_phone)) {
      setError('Please enter a valid guardian phone number.');
      return false;
    }
    if (!step2Data.guardian_gender) {
      setError('Please select guardian gender.');
      return false;
    }
    if (!step2Data.address.trim()) {
      setError('Please enter address.');
      return false;
    }

    return true;
  };

  const validateStep3 = (): boolean => {
    if (!step3Data.password) {
      setError('Please enter a password.');
      return false;
    }
    if (step3Data.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return false;
    }
    if (step3Data.password !== step3Data.password_confirmation) {
      setError('Password confirmation does not match.');
      return false;
    }

    return true;
  };

  const goNext = () => {
    setError('');
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((prev) => (prev === 1 ? 2 : 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setError('');
    setStep((prev) => (prev === 3 ? 2 : 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitRegistration = async () => {
    if (!validateStep3()) return;

    try {
      setLoading(true);
      setError('');

      const payload = {
        first_name: step1Data.first_name,
        last_name: step1Data.last_name,
        other_names: step1Data.middle_name || null,
        email,
        date_of_birth: step1Data.date_of_birth,
        gender: step1Data.gender,
        class_id: Number(step1Data.class_id),
        department_id: step1Data.department_id ? Number(step1Data.department_id) : null,
        guardian_first_name: step2Data.guardian_first_name,
        guardian_last_name: step2Data.guardian_last_name,
        guardian_relationship: step2Data.guardian_relationship,
        guardian_phone: step2Data.guardian_phone,
        guardian_gender: step2Data.guardian_gender,
        address: step2Data.address,
        password: step3Data.password,
        password_confirmation: step3Data.password_confirmation,
      };

      const response = await axios.post(`${API_URL}/students`, payload);
      const generatedRegNo =
        response.data?.registration_number ||
        response.data?.student?.registration_number ||
        '';

      setRegistrationNumber(generatedRegNo);
      setShowSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white p-8 shadow-xl text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
            <i className="bx bx-check text-4xl" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Registration Completed</h1>
          <p className="mt-2 text-sm text-slate-600">Your student account has been created successfully.</p>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-800">Registration Number</p>
            <p className="mt-1 text-2xl font-extrabold tracking-wide text-emerald-700 select-all">
              {registrationNumber || 'Generated'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/student-login')}
            className="mt-6 w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Continue to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Student Registration</h1>
          <p className="text-sm text-slate-600 mt-1">Create your account in three guided steps.</p>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-lg">
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      step >= item ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {item}
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    {item === 1 ? 'Student' : item === 2 ? 'Guardian' : 'Security'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <InputField label="First Name" value={step1Data.first_name} onChange={(v) => setStep1Data((p) => ({ ...p, first_name: v }))} required />
                <InputField label="Last Name" value={step1Data.last_name} onChange={(v) => setStep1Data((p) => ({ ...p, last_name: v }))} required />
                <InputField label="Middle Name" value={step1Data.middle_name} onChange={(v) => setStep1Data((p) => ({ ...p, middle_name: v }))} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
                <InputField label="Date of Birth" type="date" value={step1Data.date_of_birth} onChange={(v) => setStep1Data((p) => ({ ...p, date_of_birth: v }))} required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Gender" value={step1Data.gender} onChange={(v) => setStep1Data((p) => ({ ...p, gender: v }))} required>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </SelectField>

                <div>
                  <FieldLabel text="Class" required />
                  {loadingClasses ? (
                    <div className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-500">Loading classes...</div>
                  ) : (
                    <select
                      value={step1Data.class_id}
                      onChange={(e) => setStep1Data((p) => ({ ...p, class_id: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                      required
                    >
                      <option value="">Select class</option>
                      {classes.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {requiresDepartment && (
                <div>
                  <FieldLabel text="Department" required />
                  {loadingDepartments ? (
                    <div className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-500">Loading departments...</div>
                  ) : (
                    <select
                      value={step1Data.department_id}
                      onChange={(e) => setStep1Data((p) => ({ ...p, department_id: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                      required
                    >
                      <option value="">Select department</option>
                      {departments.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="Guardian First Name" value={step2Data.guardian_first_name} onChange={(v) => setStep2Data((p) => ({ ...p, guardian_first_name: v }))} required />
                <InputField label="Guardian Last Name" value={step2Data.guardian_last_name} onChange={(v) => setStep2Data((p) => ({ ...p, guardian_last_name: v }))} required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InputField label="Relationship" value={step2Data.guardian_relationship} onChange={(v) => setStep2Data((p) => ({ ...p, guardian_relationship: v }))} required />
                <InputField label="Guardian Phone" value={step2Data.guardian_phone} onChange={(v) => setStep2Data((p) => ({ ...p, guardian_phone: v }))} required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Guardian Gender" value={step2Data.guardian_gender} onChange={(v) => setStep2Data((p) => ({ ...p, guardian_gender: v }))} required>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </SelectField>
                <InputField label="Address" value={step2Data.address} onChange={(v) => setStep2Data((p) => ({ ...p, address: v }))} required />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <InputField
                label="Password"
                type="password"
                value={step3Data.password}
                onChange={(v) => setStep3Data((p) => ({ ...p, password: v }))}
                placeholder="At least 8 characters"
                required
              />

              <InputField
                label="Confirm Password"
                type="password"
                value={step3Data.password_confirmation}
                onChange={(v) => setStep3Data((p) => ({ ...p, password_confirmation: v }))}
                required
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Password must contain at least 8 characters. Keep it private and secure.
              </div>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-200 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button type="button" onClick={goBack} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Back
              </button>
            ) : (
              <Link to="/student-login" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Cancel
              </Link>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={loadingClasses}
                className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={submitRegistration}
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center mt-5 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/student-login" className="font-semibold text-cyan-700 hover:text-cyan-800">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default StudentRegistrationForm;
