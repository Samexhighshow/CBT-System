import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { AvatarDropdown } from '../components';
import useAuthStore from '../store/authStore';
import StudentOverview from './student/StudentOverview';
import AvailableExams from './student/AvailableExams';
import MyResults from './student/MyResults';
import FooterMinimal from '../components/FooterMinimal';

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
  }, [navigate, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-blue-600">CBT Portal</h1>
              <div className="hidden md:flex space-x-1">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/student/exams')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Exams
                </button>
                <button
                  onClick={() => navigate('/student/results')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Results
                </button>
                <button
                  onClick={() => navigate('/student/profile')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Profile
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <AvatarDropdown showSettings={false} />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route index element={<StudentOverview />} />
          <Route path="exams" element={<AvailableExams />} />
          <Route path="results" element={<MyResults />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <div className="mt-auto">
        <FooterMinimal />
      </div>
    </div>
  );
};

export default StudentDashboard;
