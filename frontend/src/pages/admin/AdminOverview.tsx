import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  assigned_subjects_count?: number;
  assigned_classes_count?: number;
  scoped_exams_count?: number;
  scoped_published_exams_count?: number;
  scoped_attempts_count?: number;
  scoped_students_count?: number;
  scoped_ongoing_exams_count?: number;
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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isRetriableStatsError = (error: any): boolean => {
  if (!error?.response) return true;
  const status = Number(error.response.status || 0);
  return status === 429 || (status >= 500 && status <= 599);
};

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
  const roleNames = useMemo(
    () => (user?.roles || []).map((r: any) => String(r?.name || r || '').trim().toLowerCase()),
    [user?.roles]
  );
  const isAdminBypassRole = roleNames.includes('main admin') || roleNames.includes('admin');
  const isTeacherScopedDashboard = roleNames.includes('teacher') && !isAdminBypassRole;
  const [stats, setStats] = useState<DashboardStats>({
    total_students: 0,
    active_students: 0,
    total_exams: 0,
    published_exams: 0,
    total_departments: 0,
    total_subjects: 0,
    total_attempts: 0,
    ongoing_exams: 0,
    assigned_subjects_count: 0,
    assigned_classes_count: 0,
    scoped_exams_count: 0,
    scoped_published_exams_count: 0,
    scoped_attempts_count: 0,
    scoped_students_count: 0,
    scoped_ongoing_exams_count: 0,
  });
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const loadStats = useCallback(async () => {
    const retryDelays = [0, 600, 1400];

    for (let i = 0; i < retryDelays.length; i += 1) {
      if (retryDelays[i] > 0) {
        await wait(retryDelays[i]);
      }

      try {
        const response = await api.get('/analytics/admin/dashboard', { skipGlobalLoading: true } as any);
        const payload = response.data?.data ?? response.data ?? {};

        setStats({
          total_students: Number(payload.total_students ?? 0),
          active_students: Number(payload.active_students ?? 0),
          total_exams: Number(payload.total_exams ?? 0),
          published_exams: Number(payload.published_exams ?? 0),
          total_departments: Number(payload.total_departments ?? 0),
          total_subjects: Number(payload.total_subjects ?? 0),
          total_attempts: Number(payload.total_attempts ?? 0),
          ongoing_exams: Number(payload.ongoing_exams ?? 0),
          assigned_subjects_count: Number(payload.assigned_subjects_count ?? 0),
          assigned_classes_count: Number(payload.assigned_classes_count ?? 0),
          scoped_exams_count: Number(payload.scoped_exams_count ?? 0),
          scoped_published_exams_count: Number(payload.scoped_published_exams_count ?? 0),
          scoped_attempts_count: Number(payload.scoped_attempts_count ?? 0),
          scoped_students_count: Number(payload.scoped_students_count ?? 0),
          scoped_ongoing_exams_count: Number(payload.scoped_ongoing_exams_count ?? 0),
        });
        setStatsLoaded(true);
        return;
      } catch (error: any) {
        const canRetry = isRetriableStatsError(error) && i < retryDelays.length - 1;
        if (!canRetry) {
          console.error('Failed to fetch admin stats:', error);
          if (!statsLoaded) {
            setStats({
              total_students: 0,
              active_students: 0,
              total_exams: 0,
              published_exams: 0,
            total_departments: 0,
            total_subjects: 0,
            total_attempts: 0,
            ongoing_exams: 0,
            assigned_subjects_count: 0,
            assigned_classes_count: 0,
            scoped_exams_count: 0,
            scoped_published_exams_count: 0,
            scoped_attempts_count: 0,
            scoped_students_count: 0,
            scoped_ongoing_exams_count: 0,
          });
        }
        return;
        }
      }
    }
  }, [statsLoaded]);

  const loadUpcomingExams = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    let isActive = true;

    const loadOverview = async () => {
      await loadStats();
      if (isActive) {
        loadUpcomingExams();
      }
    };

    loadOverview();

    const delayedRefresh = window.setTimeout(() => {
      if (!isActive) return;
      loadOverview();
    }, 1500);

    return () => {
      isActive = false;
      window.clearTimeout(delayedRefresh);
    };
  }, [user?.id, loadStats, loadUpcomingExams]);

  const statCards = useMemo(() => {
    if (isTeacherScopedDashboard) {
      return [
        {
          title: 'Assigned Subjects',
          value: stats.assigned_subjects_count ?? stats.total_subjects,
          subtitle: 'approved scope',
          icon: 'bx-book',
          className: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white panel-compact',
          titleClass: 'text-blue-100',
          subtitleClass: 'text-blue-100',
        },
        {
          title: 'Assigned Classes',
          value: stats.assigned_classes_count ?? 0,
          subtitle: 'teaching classes',
          icon: 'bx-category',
          className: 'bg-gradient-to-br from-green-500 to-green-600 text-white panel-compact',
          titleClass: 'text-green-100',
          subtitleClass: 'text-green-100',
        },
        {
          title: 'Scoped Exams',
          value: stats.scoped_exams_count ?? stats.total_exams,
          subtitle: `${stats.scoped_published_exams_count ?? stats.published_exams} published`,
          icon: 'bx-book-content',
          className: 'bg-gradient-to-br from-purple-500 to-purple-600 text-white panel-compact',
          titleClass: 'text-purple-100',
          subtitleClass: 'text-purple-100',
        },
        {
          title: 'Scoped Students',
          value: stats.scoped_students_count ?? stats.total_students,
          subtitle: `${stats.active_students} active`,
          icon: 'bx-group',
          className: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white panel-compact',
          titleClass: 'text-orange-100',
          subtitleClass: 'text-orange-100',
        },
        {
          title: 'Scoped Attempts',
          value: stats.scoped_attempts_count ?? stats.total_attempts,
          subtitle: 'completed attempts',
          icon: 'bx-edit-alt',
          className: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white panel-compact',
          titleClass: 'text-indigo-100',
          subtitleClass: 'text-indigo-100',
        },
        {
          title: 'Ongoing Scoped Exams',
          value: stats.scoped_ongoing_exams_count ?? stats.ongoing_exams,
          subtitle: 'currently open',
          icon: 'bx-time-five',
          className: 'bg-gradient-to-br from-pink-500 to-pink-600 text-white panel-compact',
          titleClass: 'text-pink-100',
          subtitleClass: 'text-pink-100',
        },
      ];
    }

    return [
      {
        title: 'Total Students',
        value: stats.total_students,
        subtitle: `${stats.active_students} active`,
        icon: 'bx-group',
        className: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white panel-compact',
        titleClass: 'text-blue-100',
        subtitleClass: 'text-blue-100',
      },
      {
        title: 'Total Exams',
        value: stats.total_exams,
        subtitle: `${stats.published_exams} published`,
        icon: 'bx-book-content',
        className: 'bg-gradient-to-br from-green-500 to-green-600 text-white panel-compact',
        titleClass: 'text-green-100',
        subtitleClass: 'text-green-100',
      },
      {
        title: 'Total Attempts',
        value: stats.total_attempts,
        subtitle: '',
        icon: 'bx-edit-alt',
        className: 'bg-gradient-to-br from-purple-500 to-purple-600 text-white panel-compact',
        titleClass: 'text-purple-100',
        subtitleClass: 'text-purple-100',
      },
      {
        title: 'Subjects',
        value: stats.total_subjects,
        subtitle: '',
        icon: 'bx-book',
        className: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white panel-compact',
        titleClass: 'text-orange-100',
        subtitleClass: 'text-orange-100',
      },
      {
        title: 'Departments',
        value: stats.total_departments,
        subtitle: '',
        icon: 'bx-bar-chart-alt-2',
        className: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white panel-compact',
        titleClass: 'text-indigo-100',
        subtitleClass: 'text-indigo-100',
      },
      {
        title: 'Ongoing Exams',
        value: stats.ongoing_exams,
        subtitle: '',
        icon: 'bx-graduation',
        className: 'bg-gradient-to-br from-pink-500 to-pink-600 text-white panel-compact',
        titleClass: 'text-pink-100',
        subtitleClass: 'text-pink-100',
      },
    ];
  }, [isTeacherScopedDashboard, stats]);

  const pieData = useMemo(() => {
    if (isTeacherScopedDashboard) {
      const published = stats.scoped_published_exams_count ?? stats.published_exams;
      const total = stats.scoped_exams_count ?? stats.total_exams;
      return [
        { name: 'Published', value: published },
        { name: 'Other', value: Math.max(total - published, 0) },
      ];
    }

    return [
      { name: 'Active', value: stats.active_students },
      { name: 'Inactive', value: Math.max(stats.total_students - stats.active_students, 0) },
    ];
  }, [isTeacherScopedDashboard, stats]);

  const systemOverviewData = useMemo(() => {
    if (isTeacherScopedDashboard) {
      return [
        { name: 'Subjects', value: stats.assigned_subjects_count ?? stats.total_subjects },
        { name: 'Classes', value: stats.assigned_classes_count ?? 0 },
        { name: 'Scoped Exams', value: stats.scoped_exams_count ?? stats.total_exams },
        { name: 'Attempts', value: stats.scoped_attempts_count ?? stats.total_attempts },
      ];
    }

    return [
      { name: 'Students', value: stats.total_students },
      { name: 'Exams', value: stats.total_exams },
      { name: 'Subjects', value: stats.total_subjects },
      { name: 'Departments', value: stats.total_departments },
    ];
  }, [isTeacherScopedDashboard, stats]);



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
        {statCards.map((card) => (
          <Card key={card.title} className={card.className}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${card.titleClass} text-xs md:text-sm`}>{card.title}</p>
                <h3 className="text-2xl md:text-3xl font-bold mt-1">{card.value}</h3>
                {card.subtitle ? (
                  <p className={`${card.subtitleClass} text-xs mt-0.5`}>{card.subtitle}</p>
                ) : null}
              </div>
              <i className={`bx ${card.icon} text-4xl md:text-5xl opacity-80`}></i>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card className="panel-compact">
          <h3 className="text-sm md:text-base font-semibold mb-3">Student Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
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
            <BarChart data={systemOverviewData}>
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
