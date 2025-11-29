import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { AvatarDropdown } from '../components';
import useAuthStore from '../store/authStore';
import AdminOverview from './admin/AdminOverview';
import QuestionBank from './admin/QuestionBank';
import ExamManagement from './admin/ExamManagement';
import StudentManagement from './admin/StudentManagement';
import SubjectManagement from './admin/SubjectManagement';
import ResultsAnalytics from './admin/ResultsAnalytics';
import FooterMinimal from '../components/FooterMinimal';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isMainAdmin, setIsMainAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/admin-login');
      return;
    }
    // Check if user has Main Admin role
    const hasMainAdminRole = user.roles?.some((role: any) => role.name === 'Main Admin');
    setIsMainAdmin(hasMainAdminRole || false);
  }, [navigate, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-blue-600">CBT Admin</h1>
              <div className="hidden md:flex space-x-1">
                <button
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Overview
                </button>
                <button
                  onClick={() => navigate('/admin/questions')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Questions
                </button>
                <button
                  onClick={() => navigate('/admin/exams')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Exams
                </button>
                <button
                  onClick={() => navigate('/admin/students')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Students
                </button>
                <button
                  onClick={() => navigate('/admin/subjects')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Subjects
                </button>
                <button
                  onClick={() => navigate('/admin/results')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                  Results
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <AvatarDropdown showSettings={isMainAdmin} />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="questions" element={<QuestionBank />} />
          <Route path="exams" element={<ExamManagement />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="subjects" element={<SubjectManagement />} />
          <Route path="results" element={<ResultsAnalytics />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>

      <div className="mt-auto">
        <FooterMinimal />
      </div>
    </div>
  );
};

export default AdminDashboard;
