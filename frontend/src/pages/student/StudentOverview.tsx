import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnnouncementsCarousel, Card } from '../../components';
import { api } from '../../services/api';
import { getCurrentStudentProfile, CurrentStudentProfile } from './studentData';

interface DashboardStats {
  availableExams: number;
  completedExams: number;
  averageScore: number;
  passRate: number;
}

interface QuickItem {
  title: string;
  description: string;
  path: string;
  icon: string;
  accent: string;
}

interface CompiledPreview {
  term: string;
  subject: string;
  ca_score: number | null;
  exam_score: number | null;
  compiled_score: number | null;
  cumulative_average: number | null;
}

const StudentOverview: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<CurrentStudentProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    availableExams: 0,
    completedExams: 0,
    averageScore: 0,
    passRate: 0,
  });
  const [compiledResults, setCompiledResults] = useState<CompiledPreview[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const profile = await getCurrentStudentProfile();
        setStudent(profile);

        const [statsResult, compiledResult] = await Promise.allSettled([
          api.get(`/analytics/student/${profile.id}/dashboard`),
          api.get(`/results/student/${profile.id}`, {
            params: { limit: 100 },
          }),
        ]);

        if (statsResult.status === 'fulfilled') {
          const statsPayload = statsResult.value.data || {};
          setStats({
            availableExams: Number(statsPayload.available_exams || 0),
            completedExams: Number(statsPayload.total_exams_taken || 0),
            averageScore: Number(statsPayload.average_score || 0),
            passRate: Number(statsPayload.pass_rate || 0),
          });
        } else {
          try {
            const fallbackStatsRes = await api.get(`/students/${profile.id}/statistics`);
            const fallbackStats = fallbackStatsRes.data || {};
            setStats({
              availableExams: Number(fallbackStats.available_exams || 0),
              completedExams: Number(fallbackStats.total_exams_taken || 0),
              averageScore: Number(fallbackStats.average_score || 0),
              passRate: Number(fallbackStats.pass_rate || 0),
            });
          } catch {
            setStats({
              availableExams: 0,
              completedExams: 0,
              averageScore: 0,
              passRate: 0,
            });
          }
        }

        if (compiledResult.status === 'fulfilled') {
          const rows: CompiledPreview[] = compiledResult.value.data?.compiled_results || [];
          setCompiledResults(rows.slice(0, 6));
        } else {
          setCompiledResults([]);
        }
      } catch (error) {
        console.error('Failed to load student overview data', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const quickItems: QuickItem[] = useMemo(() => ([
    {
      title: 'Available Exams',
      description: 'Check active exams and start immediately.',
      path: '/student/exams',
      icon: 'bx bx-book-content',
      accent: 'from-cyan-500 to-blue-600',
    },
    {
      title: 'My Results',
      description: 'Review scores, pass rate, and recent performance.',
      path: '/student/results',
      icon: 'bx bx-bar-chart-alt-2',
      accent: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Seat Allocation',
      description: 'Find your allocated hall and seat for exams.',
      path: '/student/allocations',
      icon: 'bx bx-grid-alt',
      accent: 'from-indigo-500 to-purple-600',
    },
    {
      title: 'Announcements',
      description: 'Read notices from school administration.',
      path: '/student/announcements',
      icon: 'bx bx-megaphone',
      accent: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Profile Settings',
      description: 'Update personal details, password, and photo.',
      path: '/student/profile',
      icon: 'bx bx-user-circle',
      accent: 'from-rose-500 to-pink-600',
    },
  ]), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900">Student Overview</h1>
        <p className="text-sm text-slate-600">
          {student
            ? `Welcome, ${student.first_name || 'Student'} (${student.registration_number || 'No Reg No'})`
            : 'Welcome back. Here is your academic dashboard.'}
        </p>
      </div>

      <AnnouncementsCarousel limit={5} autoScrollInterval={7000} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
          <p className="text-xs uppercase tracking-wide text-cyan-100">Available Exams</p>
          <p className="text-3xl font-extrabold mt-2">{loading ? '...' : stats.availableExams}</p>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <p className="text-xs uppercase tracking-wide text-emerald-100">Completed</p>
          <p className="text-3xl font-extrabold mt-2">{loading ? '...' : stats.completedExams}</p>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <p className="text-xs uppercase tracking-wide text-indigo-100">Average Score</p>
          <p className="text-3xl font-extrabold mt-2">{loading ? '...' : `${stats.averageScore.toFixed(1)}%`}</p>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white">
          <p className="text-xs uppercase tracking-wide text-orange-100">Pass Rate</p>
          <p className="text-3xl font-extrabold mt-2">{loading ? '...' : `${stats.passRate.toFixed(1)}%`}</p>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-3">Student Tools</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickItems.map((item) => (
            <button
              type="button"
              key={item.path}
              onClick={() => navigate(item.path)}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition"
            >
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} text-white`}>
                <i className={`${item.icon} text-2xl`} />
              </div>
              <p className="mt-3 text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Compiled Results</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading compiled results...</p>
        ) : compiledResults.length === 0 ? (
          <p className="text-sm text-slate-500">No compiled results yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-600">
                  <th className="py-2">Term</th>
                  <th className="py-2">Subject</th>
                  <th className="py-2">CA (%)</th>
                  <th className="py-2">Exam (%)</th>
                  <th className="py-2">Compiled (%)</th>
                  <th className="py-2">CR (%)</th>
                </tr>
              </thead>
              <tbody>
                {compiledResults.map((row, idx) => (
                  <tr key={`${row.term}-${row.subject}-${idx}`} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">{row.term}</td>
                    <td className="py-2 font-medium text-slate-900">{row.subject}</td>
                    <td className="py-2 text-slate-700">{row.ca_score !== null ? row.ca_score.toFixed(2) : '-'}</td>
                    <td className="py-2 text-slate-700">{row.exam_score !== null ? row.exam_score.toFixed(2) : '-'}</td>
                    <td className="py-2 font-semibold text-slate-900">{row.compiled_score !== null ? row.compiled_score.toFixed(2) : '-'}</td>
                    <td className="py-2 text-slate-700">{row.cumulative_average !== null ? row.cumulative_average.toFixed(2) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default StudentOverview;
