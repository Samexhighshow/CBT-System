import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, SkeletonCard, SkeletonList } from '../../components';
import { api, API_URL } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { getCurrentStudentProfile } from './studentData';

interface ResultRow {
  id: number;
  exam_title: string;
  subject: string;
  score: number;
  total_marks: number;
  percentage: number;
  passed: boolean;
  grade?: string | null;
  position_grade?: string | null;
  completed_at?: string;
}

interface ResultStats {
  average_score: number;
  total_exams: number;
  pass_rate: number;
}

const MyResults: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState<number | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [stats, setStats] = useState<ResultStats>({
    average_score: 0,
    total_exams: 0,
    pass_rate: 0,
  });

  const loadResults = async () => {
    try {
      setLoading(true);

      const student = await getCurrentStudentProfile();
      setStudentId(student.id);

      const [resultsRes, statsRes] = await Promise.allSettled([
        api.get(`/results/student/${student.id}`, { params: { limit: 100 } }),
        api.get(`/analytics/student/${student.id}/dashboard`),
      ]);

      if (resultsRes.status === 'fulfilled') {
        const rows: ResultRow[] = resultsRes.value.data?.data || [];
        setResults(rows);
      } else {
        setResults([]);
      }

      if (statsRes.status === 'fulfilled') {
        const analytics = statsRes.value.data || {};
        setStats({
          average_score: Number(analytics.average_score || 0),
          total_exams: Number(analytics.total_exams_taken || 0),
          pass_rate: Number(analytics.pass_rate || 0),
        });
      } else {
        try {
          const fallbackStatsRes = await api.get(`/students/${student.id}/statistics`);
          const fallbackStats = fallbackStatsRes.data || {};
          setStats({
            average_score: Number(fallbackStats.average_score || 0),
            total_exams: Number(fallbackStats.total_exams_taken || 0),
            pass_rate: Number(fallbackStats.pass_rate || 0),
          });
        } catch {
          setStats({
            average_score: 0,
            total_exams: 0,
            pass_rate: 0,
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to load student results', error);
      showError(error?.response?.data?.message || 'Failed to load your results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  useKeyboardShortcuts({
    onRefresh: loadResults,
  });

  const filteredResults = useMemo(() => {
    if (!search.trim()) return results;
    const term = search.toLowerCase();
    return results.filter((row) => row.exam_title.toLowerCase().includes(term) || row.subject.toLowerCase().includes(term));
  }, [results, search]);

  const downloadPdf = () => {
    if (!studentId) return;
    window.open(`${API_URL}/reports/student/${studentId}/pdf`, '_blank');
    showSuccess('Downloading PDF report...');
  };

  const downloadExcel = () => {
    if (!studentId) return;
    window.open(`${API_URL}/reports/student/${studentId}/excel`, '_blank');
    showSuccess('Downloading Excel report...');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Results</h1>
          <p className="text-sm text-slate-600 mt-1">View your scores, pass status, and performance trend.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadPdf} variant="secondary" className="flex items-center gap-1.5">
            <i className="bx bx-download" /> PDF
          </Button>
          <Button onClick={downloadExcel} variant="secondary" className="flex items-center gap-1.5">
            <i className="bx bx-spreadsheet" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card className="bg-emerald-50 border border-emerald-200">
              <p className="text-xs uppercase tracking-wide text-emerald-800">Average Score</p>
              <p className="text-3xl font-extrabold text-emerald-700 mt-1">{stats.average_score.toFixed(1)}%</p>
            </Card>
            <Card className="bg-cyan-50 border border-cyan-200">
              <p className="text-xs uppercase tracking-wide text-cyan-800">Exams Taken</p>
              <p className="text-3xl font-extrabold text-cyan-700 mt-1">{stats.total_exams}</p>
            </Card>
            <Card className="bg-indigo-50 border border-indigo-200">
              <p className="text-xs uppercase tracking-wide text-indigo-800">Pass Rate</p>
              <p className="text-3xl font-extrabold text-indigo-700 mt-1">{stats.pass_rate.toFixed(1)}%</p>
            </Card>
          </>
        )}
      </div>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Result History</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exam or subject"
            className="w-full md:w-72 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
        </div>

        {loading ? (
          <SkeletonList items={5} />
        ) : filteredResults.length === 0 ? (
          <p className="text-sm text-slate-500">No results found.</p>
        ) : (
          <div className="space-y-3">
            {filteredResults.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.exam_title}</p>
                    <p className="text-xs text-slate-600 mt-1">{row.subject} • {row.completed_at ? new Date(row.completed_at).toLocaleString() : 'Completed'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900">{row.score}/{row.total_marks}</p>
                    <p className={`text-xs font-semibold ${row.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {row.percentage.toFixed(1)}% • {row.passed ? 'Passed' : 'Failed'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Grade: {row.grade || '-'} {row.position_grade ? `• Band: ${row.position_grade}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default MyResults;
