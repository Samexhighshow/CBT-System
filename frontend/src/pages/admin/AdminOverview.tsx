import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, WelcomeBanner } from '../../components';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

const parseExamDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  // Fallback for date-only strings
  const dateOnly = new Date(`${raw}T00:00:00`);
  return Number.isNaN(dateOnly.getTime()) ? null : dateOnly;
};

const getExamStartDate = (exam: any): Date | null =>
  parseExamDateValue(exam?.start_datetime ?? exam?.start_time ?? exam?.date ?? exam?.exam_date);

const getExamEffectiveStatus = (exam: any): string =>
  String(exam?.effective_status || exam?.status || '').toLowerCase();

const formatExamStartTime = (exam: any, startDate: Date | null): string => {
  if (startDate) return startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const raw = exam?.start_time;
  if (typeof raw !== 'string' || raw.trim() === '') return 'TBA';
  if (/^\d{2}:\d{2}/.test(raw.trim())) return raw.trim().slice(0, 5);
  return raw;
};

const AdminOverview: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadUpcomingExams();
  }, []);

  const loadStats = async () => {
    try {
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
    }
  };

  const loadUpcomingExams = async () => {
    try {
      const response = await api.get('/exams');
      const rows = response.data?.data || response.data || [];
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const upcoming = rows
        .map((exam: any) => ({
          ...exam,
          _startDate: getExamStartDate(exam),
        }))
        .filter((exam: any) => {
          if (!exam._startDate) return false;
          const isInWindow = exam._startDate >= now && exam._startDate <= nextWeek;
          if (!isInWindow) return false;

          const isPublished = Boolean(exam.published ?? exam.is_published);
          const status = getExamEffectiveStatus(exam);
          const isEligibleStatus = status === '' || status === 'scheduled' || status === 'active';
          return isPublished && isEligibleStatus;
        })
        .sort((a: any, b: any) => a._startDate.getTime() - b._startDate.getTime())
        .slice(0, 5);

      setUpcomingExams(upcoming);
    } catch (error) {
      console.error('Failed to fetch upcoming exams:', error);
      setUpcomingExams([]);
    }
  };



  return (
    <div className="app-shell section-shell">
      {/* Enhanced Welcome Banner */}
      <WelcomeBanner
        user={user}
        subtitle="Welcome back! Here's your system overview."
        gradientClass="bg-gradient-to-r from-indigo-600 to-blue-500"
        icon="bx-chart"
      />

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

      {/* Upcoming Exams Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Upcoming Exams (Next 7 Days)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {upcomingExams.length > 0
                ? `${upcomingExams.length} scheduled exam${upcomingExams.length > 1 ? 's' : ''} in this window`
                : 'No exams currently scheduled in this window'}
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/exams')}
            className="text-blue-600 text-sm font-medium hover:text-blue-700 flex items-center space-x-1"
          >
            <span>View All</span>
            <i className='bx bx-right-arrow-alt'></i>
          </button>
        </div>
        {upcomingExams.length === 0 ? (
          <Card className="panel-compact bg-gradient-to-r from-slate-50 to-blue-50 border border-blue-100">
            <div className="text-center py-8 text-gray-500">
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-white border border-blue-100 flex items-center justify-center">
                <i className='bx bx-calendar-x text-3xl text-blue-500'></i>
              </div>
              <p className="text-sm font-medium text-gray-700">No upcoming exams scheduled for the next 7 days</p>
              <p className="text-xs text-gray-500 mt-1">Create a new exam to keep your assessment pipeline active.</p>
              <button
                onClick={() => navigate('/admin/exams')}
                className="mt-3 inline-flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <span>Go to Exam Management</span>
                <i className='bx bx-right-arrow-alt'></i>
              </button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingExams.map((exam) => (
              <Card
                key={exam.id}
                className="panel-compact cursor-pointer border border-slate-200 hover:border-blue-200 hover:shadow-lg transition-all"
                onClick={() => navigate(`/admin/exams/${exam.id}`)}
              >
                <div className="flex items-start space-x-3">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-xl flex items-center justify-center w-12 h-12 flex-shrink-0 shadow-sm">
                    <i className="bx bx-book-content text-xl"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{exam.title}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">
                        {exam.class_level || 'All Classes'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{exam.subject?.name || exam.subject_name || 'No Subject'}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1 text-gray-600">
                        <div className="flex items-center space-x-1">
                          <i className="bx bx-calendar text-sm"></i>
                          <span className="font-medium">Date</span>
                        </div>
                        <p className="text-gray-700 mt-0.5 truncate">{exam._startDate ? exam._startDate.toLocaleDateString() : 'No Date'}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1 text-gray-600">
                        <div className="flex items-center space-x-1">
                          <i className="bx bx-time text-sm"></i>
                          <span className="font-medium">Time</span>
                        </div>
                        <p className="text-gray-700 mt-0.5 truncate">{formatExamStartTime(exam, exam._startDate ?? null)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        getExamEffectiveStatus(exam) === 'active'
                          ? 'bg-green-100 text-green-700'
                          : getExamEffectiveStatus(exam) === 'scheduled'
                          ? 'bg-blue-100 text-blue-700'
                          : getExamEffectiveStatus(exam) === 'completed'
                          ? 'bg-purple-100 text-purple-700'
                          : getExamEffectiveStatus(exam) === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {getExamEffectiveStatus(exam)
                          ? getExamEffectiveStatus(exam).charAt(0).toUpperCase() + getExamEffectiveStatus(exam).slice(1)
                          : 'Draft'}
                      </span>
                      <span className="text-[11px] text-gray-500">Tap to view details</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
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
