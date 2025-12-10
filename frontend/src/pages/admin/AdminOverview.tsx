import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components';
import { api } from '../../services/api';
import { showError } from '../../utils/alerts';
import { useAuthStore } from '../../store/authStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

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
  const { user } = useAuthStore();
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
        setStats({
          total_students: Number(response.data.total_students ?? 0),
          active_students: Number(response.data.active_students ?? 0),
          total_exams: Number(response.data.total_exams ?? 0),
          published_exams: Number(response.data.published_exams ?? 0),
          total_departments: Number(response.data.total_departments ?? 0),
          total_subjects: Number(response.data.total_subjects ?? 0),
          total_attempts: Number(response.data.total_attempts ?? 0),
          ongoing_exams: Number(response.data.ongoing_exams ?? 0),
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch admin stats:', error);
      // Don't show error dialog, just use default empty stats
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
      icon: 'bx-edit-alt',
      path: '/admin/questions',
      color: 'bg-blue-500',
    },
    {
      title: 'Exam Management',
      description: 'Create and manage exams, set schedules',
      icon: 'bx-book-content',
      path: '/admin/exams',
      color: 'bg-green-500',
    },
    {
      title: 'Student Management',
      description: 'View and manage student records',
      icon: 'bx-group',
      path: '/admin/students',
      color: 'bg-purple-500',
    },
    {
      title: 'Subjects & Departments',
      description: 'Manage subjects and department structure',
      icon: 'bx-folder',
      path: '/admin/subjects',
      color: 'bg-orange-500',
    },
    {
      title: 'Results & Analytics',
      description: 'View exam results and performance analytics',
      icon: 'bx-bar-chart-alt-2',
      path: '/admin/results',
      color: 'bg-indigo-500',
    },
    {
      title: 'Class Management',
      description: 'Manage class levels and academic sessions',
      icon: 'bx-graduation',
      path: '/admin/classes',
      color: 'bg-pink-500',
    },
    {
      title: 'Roles & Users',
      description: 'Manage roles, permissions, and users',
      icon: 'bx-shield',
      path: '/admin/users',
      color: 'bg-sky-500',
    },
  ];

  return (
    <div className="app-shell section-shell">
      {/* Header */}
      <div className="mb-5">
        <h1
          className={
            `text-2xl md:text-3xl font-bold mb-1 ` +
            (user?.name?.toLowerCase() === 'maximus'
              ? 'text-blue-600'
              : user?.name?.toLowerCase() === 'mavis'
              ? 'bg-gradient-to-r from-yellow-400 to-blue-500 bg-clip-text text-transparent'
              : 'text-gray-900')
          }
        >
          {user?.name ?? 'Admin'}
        </h1>
        <p className="text-sm md:text-base text-gray-600">Welcome back! Overview of your system.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white panel-compact">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs md:text-sm">Total Students</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1">{stats.total_students}</h3>
              <p className="text-blue-100 text-xs mt-0.5">{stats.active_students} active</p>
            </div>
            <i className='bx bx-group text-4xl md:text-5xl opacity-80'></i>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white panel-compact">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-xs md:text-sm">Total Exams</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1">{stats.total_exams}</h3>
              <p className="text-green-100 text-xs mt-0.5">{stats.published_exams} published</p>
            </div>
            <i className='bx bx-book-content text-4xl md:text-5xl opacity-80'></i>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white panel-compact">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-xs md:text-sm">Total Attempts</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1">{stats.total_attempts}</h3>
            </div>
            <i className='bx bx-edit-alt text-4xl md:text-5xl opacity-80'></i>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white panel-compact">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs md:text-sm">Subjects</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1">{stats.total_subjects}</h3>
            </div>
            <i className='bx bx-book text-4xl md:text-5xl opacity-80'></i>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white panel-compact">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-xs md:text-sm">Departments</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1">{stats.total_departments}</h3>
            </div>
            <i className='bx bx-bar-chart-alt-2 text-4xl md:text-5xl opacity-80'></i>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white panel-compact">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-pink-100 text-xs md:text-sm">Ongoing Exams</p>
              <h3 className="text-2xl md:text-3xl font-bold mt-1">{stats.ongoing_exams}</h3>
            </div>
            <i className='bx bx-graduation text-4xl md:text-5xl opacity-80'></i>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card className="panel-compact">
          <h3 className="text-sm md:text-base font-semibold mb-3">Student Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Active', value: stats.active_students },
                  { name: 'Inactive', value: stats.total_students - stats.active_students }
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#6b7280" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="panel-compact">
          <h3 className="text-sm md:text-base font-semibold mb-3">System Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={[
                { name: 'Students', value: stats.total_students },
                { name: 'Exams', value: stats.total_exams },
                { name: 'Subjects', value: stats.total_subjects },
                { name: 'Departments', value: stats.total_departments }
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Modules Section (hidden on small screens) */}
      <div className="mt-6 hidden md:block">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">Management Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((module) => (
            <Card
              key={module.path}
              className="panel-compact cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              onClick={() => navigate(module.path)}
            >
              <div className="flex items-start space-x-3">
                <div className={`${module.color} text-white p-2 rounded-lg flex items-center justify-center w-14 h-14 flex-shrink-0`}>
                  <i className={`bx ${module.icon} text-2xl`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-semibold text-gray-900">{module.title}</h3>
                  <p className="text-gray-600 text-xs md:text-sm mt-0.5">{module.description}</p>
                  <button className="text-blue-600 text-xs md:text-sm font-medium mt-2 hover:text-blue-700 flex items-center space-x-1">
                    <span>Open Module</span>
                    <i className='bx bx-right-arrow-alt text-xs'></i>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/admin/exams')}
            className="bg-white border-2 border-blue-500 text-blue-600 px-4 py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-blue-50 transition"
          >
            + Create New Exam
          </button>
          <button
            onClick={() => navigate('/admin/questions')}
            className="bg-white border-2 border-green-500 text-green-600 px-4 py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-green-50 transition"
          >
            + Add Questions
          </button>
          <button
            onClick={() => navigate('/admin/students')}
            className="bg-white border-2 border-purple-500 text-purple-600 px-4 py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-purple-50 transition"
          >
            + Register Student
          </button>
          <button
            onClick={() => navigate('/admin/results')}
            className="bg-white border-2 border-indigo-500 text-indigo-600 px-4 py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-indigo-50 transition flex items-center justify-center space-x-2"
          >
            <i className='bx bx-bar-chart-alt-2 text-lg'></i>
            <span>View Results</span>
          </button>
        </div>
      </div>

      {/* Footer is provided by layout. Removed local footer to avoid duplicates. */}
    </div>
  );
};

export default AdminOverview;
