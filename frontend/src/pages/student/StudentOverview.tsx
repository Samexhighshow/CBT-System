import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components';

interface DashboardStats {
  availableExams: number;
  completedExams: number;
  averageScore: number;
  upcomingExams: number;
}

interface ModuleCard {
  title: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  badge?: string;
}

const StudentOverview: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    availableExams: 0,
    completedExams: 0,
    averageScore: 0,
    upcomingExams: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    // TODO: Fetch from API
    setStats({
      availableExams: 5,
      completedExams: 12,
      averageScore: 78.5,
      upcomingExams: 3,
    });
  };

  const modules: ModuleCard[] = [
    {
      title: 'Available Exams',
      description: 'View and take available exams',
      icon: '📚',
      path: '/student/exams',
      color: 'bg-blue-500',
      badge: '5 New',
    },
    {
      title: 'My Results',
      description: 'View your exam results and scores',
      icon: '📊',
      path: '/student/results',
      color: 'bg-green-500',
    },
    {
      title: 'Exam History',
      description: 'View all your past exam attempts',
      icon: '🕐',
      path: '/student/history',
      color: 'bg-purple-500',
    },
    {
      title: 'My Profile',
      description: 'View and update your profile',
      icon: '👤',
      path: '/student/profile',
      color: 'bg-orange-500',
    },
    {
      title: 'Practice Tests',
      description: 'Take practice tests to prepare',
      icon: '📝',
      path: '/student/practice',
      color: 'bg-indigo-500',
    },
    {
      title: 'Completed Exams',
      description: 'Review your completed exams',
      icon: '✅',
      path: '/student/completed',
      color: 'bg-pink-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's your academic overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Available Exams</p>
              <h3 className="text-3xl font-bold mt-2">{stats.availableExams}</h3>
              <p className="text-blue-100 text-xs mt-1">Ready to take</p>
            </div>
            <span className="text-5xl">📚</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Average Score</p>
              <h3 className="text-3xl font-bold mt-2">{stats.averageScore}%</h3>
              <p className="text-green-100 text-xs mt-1">Overall performance</p>
            </div>
            <span className="text-5xl">📊</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Completed Exams</p>
              <h3 className="text-3xl font-bold mt-2">{stats.completedExams}</h3>
              <p className="text-purple-100 text-xs mt-1">This term</p>
            </div>
            <span className="text-5xl">✅</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Upcoming Exams</p>
              <h3 className="text-3xl font-bold mt-2">{stats.upcomingExams}</h3>
              <p className="text-orange-100 text-xs mt-1">This week</p>
            </div>
            <span className="text-5xl">🕐</span>
          </div>
        </Card>
      </div>

      {/* Modules Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card
              key={module.path}
              className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative"
              onClick={() => navigate(module.path)}
            >
              {module.badge && (
                <span className="absolute top-4 right-4 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {module.badge}
                </span>
              )}
              <div className="flex items-start space-x-4">
                <div className={`${module.color} text-white p-3 rounded-lg flex items-center justify-center`} style={{width: '64px', height: '64px'}}>
                  <span className="text-3xl">{module.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{module.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{module.description}</p>
                  <button className="text-blue-600 text-sm font-medium mt-3 hover:text-blue-700">
                    Open →
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="font-medium">Mathematics Mid-Term Exam</p>
                  <p className="text-sm text-gray-600">Completed • Score: 85%</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">2 days ago</span>
            </div>
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <span className="text-2xl">📚</span>
                </div>
                <div>
                  <p className="font-medium">English Language Test</p>
                  <p className="text-sm text-gray-600">Available • 45 minutes</p>
                </div>
              </div>
              <button className="text-blue-600 font-medium text-sm">Start</button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <span className="text-2xl">🕐</span>
                </div>
                <div>
                  <p className="font-medium">Physics Practical Exam</p>
                  <p className="text-sm text-gray-600">Upcoming • Tomorrow at 10:00 AM</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">In 1 day</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default StudentOverview;
