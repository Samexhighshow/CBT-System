import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { showSuccess, showError } from '../utils/alerts';
import useAuthStore from '../store/authStore';

const ExamAccessLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({
    reg_number: '',
    access_code: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value.toUpperCase(),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reg_number || !formData.access_code) {
      showError('Please enter both registration number and access code');
      return;
    }

    setLoading(true);
    try {
      // First, verify the access code and get exam details
      const verifyResponse = await api.post('/exam-access/verify', {
        access_code: formData.access_code,
        reg_number: formData.reg_number,
      });

      if (verifyResponse.data.success) {
        const { exam_id } = verifyResponse.data.data;

        // Now log in the student (simplified - you might want proper authentication)
        const loginResponse = await api.post('/auth/login', {
          reg_number: formData.reg_number,
          // Add additional auth if needed
        });

        if (loginResponse.data.success) {
          login(loginResponse.data.user, loginResponse.data.token);
          showSuccess('Access verified! Redirecting to exam...');
          
          // Redirect to the specific exam
          setTimeout(() => {
            navigate(`/exam/${exam_id}`);
          }, 1000);
        }
      }
    } catch (error: any) {
      console.error('Access verification failed:', error);
      const message = error.response?.data?.message || 'Invalid access code or registration number';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
              <i className="bx bx-key text-3xl text-blue-600 dark:text-blue-400"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Exam Access
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Enter your registration number and one-time access code
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Registration Number
              </label>
              <input
                type="text"
                name="reg_number"
                value={formData.reg_number}
                onChange={handleChange}
                placeholder="Enter your reg number"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Access Code
              </label>
              <input
                type="text"
                name="access_code"
                value={formData.access_code}
                onChange={handleChange}
                placeholder="Enter 8-digit access code"
                maxLength={8}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-lg tracking-wider uppercase text-center"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Get your access code from your exam supervisor
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center space-x-2 font-medium"
            >
              {loading ? (
                <>
                  <i className="bx bx-loader-alt animate-spin"></i>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <i className="bx bx-log-in"></i>
                  <span>Access Exam</span>
                </>
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <i className="bx bx-info-circle text-amber-600 dark:text-amber-400 text-xl flex-shrink-0 mt-0.5"></i>
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <p className="font-semibold mb-1">Important:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Each access code can only be used once</li>
                  <li>Access codes expire at the end of exam day</li>
                  <li>Contact your supervisor if you have issues</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to regular login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamAccessLogin;
