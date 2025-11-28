import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components';
import { api } from '../../services/api';
import { showError } from '../../utils/alerts';

interface DashboardStats {
  total_students: number;
  active_students: number;
  total_exams: number;
  published_exams: number;
  total_departments: number;
  total_subjects: number;
  total_attempts: number;
  ongoing_exams: number;
}

interface ModuleCard {
  title: string;
  description: string;
  icon: string;
  path: string;
  color: string;
}

const AdminOverview: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total_students: 0,
    active_students: 0,
    total_exams: 0,
    published_exams: 0,
    total_departments: 0,
    total_subjects: 0,
    total_attempts: 0,
    ongoing_exams: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/analytics/admin/dashboard');
      if (response.data) {
        setStats(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch admin stats:', error);
      showError('Failed to load dashboard statistics. Using sample data.');
      // Fallback to sample data
      setStats({
        total_students: 0,
        active_students: 0,
        total_exams: 0,
        published_exams: 0,
        total_departments: 0,
        total_subjects: 0,
        total_attempts: 0,
        ongoing_exams: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const modules: ModuleCard[] = [
    {
      title: 'Question Bank',
      description: 'Create, manage and organize exam questions',
      icon: '📝',
      path: '/admin/questions',
      color: 'bg-blue-500',
    },
    {
      title: 'Exam Management',
      description: 'Create and manage exams, set schedules',
      icon: '📚',
      path: '/admin/exams',
      color: 'bg-green-500',
    },
    {
      title: 'Student Management',
      description: 'View and manage student records',
      icon: '👥',
      path: '/admin/students',
      color: 'bg-purple-500',
    },
    {
      title: 'Subjects & Departments',
      description: 'Manage subjects and department structure',
      icon: '📂',
      path: '/admin/subjects',
      color: 'bg-orange-500',
    },
    {
      title: 'Results & Analytics',
      description: 'View exam results and performance analytics',
      icon: '📊',
      path: '/admin/results',
      color: 'bg-indigo-500',
    },
    {
      title: 'Class Management',
      description: 'Manage class levels and academic sessions',
      icon: '🎓',
      path: '/admin/classes',
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's an overview of your system.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Students</p>
              <h3 className="text-3xl font-bold mt-2">{stats.total_students}</h3>
              <p className="text-blue-100 text-xs mt-1">{stats.active_students} active</p>
            </div>
            <span className="text-5xl">👥</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Exams</p>
              <h3 className="text-3xl font-bold mt-2">{stats.total_exams}</h3>
              <p className="text-green-100 text-xs mt-1">{stats.published_exams} published</p>
            </div>
            <span className="text-5xl">📚</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Attempts</p>
              <h3 className="text-3xl font-bold mt-2">{stats.total_attempts}</h3>
            </div>
            <span className="text-5xl">📝</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Subjects</p>
              <h3 className="text-3xl font-bold mt-2">{stats.total_subjects}</h3>
            </div>
            <span className="text-5xl">📂</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm">Departments</p>
              <h3 className="text-3xl font-bold mt-2">{stats.total_departments}</h3>
            </div>
            <span className="text-5xl">📊</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-pink-100 text-sm">Ongoing Exams</p>
              <h3 className="text-3xl font-bold mt-2">{stats.ongoing_exams}</h3>
            </div>
            <span className="text-5xl">🎓</span>
          </div>
        </Card>
      </div>

      {/* Modules Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Management Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card
              key={module.path}
              className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              onClick={() => navigate(module.path)}
            >
              <div className="flex items-start space-x-4">
                <div className={`${module.color} text-white p-3 rounded-lg flex items-center justify-center w-16 h-16`}>
                  <span className="text-2xl">{module.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{module.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{module.description}</p>
                  <button className="text-blue-600 text-sm font-medium mt-3 hover:text-blue-700">
                    Open Module →
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/admin/exams/create')}
            className="bg-white border-2 border-blue-500 text-blue-600 px-6 py-4 rounded-lg font-semibold hover:bg-blue-50 transition"
          >
            + Create New Exam
          </button>
          <button
            onClick={() => navigate('/admin/questions/create')}
            className="bg-white border-2 border-green-500 text-green-600 px-6 py-4 rounded-lg font-semibold hover:bg-green-50 transition"
          >
            + Add Questions
          </button>
          <button
            onClick={() => navigate('/admin/students/register')}
            className="bg-white border-2 border-purple-500 text-purple-600 px-6 py-4 rounded-lg font-semibold hover:bg-purple-50 transition"
          >
            + Register Student
          </button>
          <button
            onClick={() => navigate('/admin/results')}
            className="bg-white border-2 border-indigo-500 text-indigo-600 px-6 py-4 rounded-lg font-semibold hover:bg-indigo-50 transition"
          >
            📊 View Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
