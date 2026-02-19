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

interface TermSubjectSummary {
  subject: string;
  ca_score: number | null;
  exam_score: number | null;
  term_score: number | null;
}

interface TermSummary {
  term: string;
  term_average: number | null;
  cumulative_average: number | null;
  subjects: TermSubjectSummary[];
}

interface TermCompilationPayload {
  enabled: boolean;
  cumulative_enabled: boolean;
  current_session: string;
  default_ca_weight: number;
  default_exam_weight: number;
  terms: TermSummary[];
}

interface CompiledResultRow {
  term: string;
  subject: string;
  ca_score: number | null;
  exam_score: number | null;
  compiled_score: number | null;
  cumulative_average: number | null;
}

const MyResults: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState<number | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [compiledResults, setCompiledResults] = useState<CompiledResultRow[]>([]);
  const [stats, setStats] = useState<ResultStats>({
    average_score: 0,
    total_exams: 0,
    pass_rate: 0,
  });
  const [termCompilation, setTermCompilation] = useState<TermCompilationPayload | null>(null);

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
        setTermCompilation(resultsRes.value.data?.term_compilation || null);
        setCompiledResults(resultsRes.value.data?.compiled_results || []);
      } else {
        setResults([]);
        setCompiledResults([]);
        setTermCompilation(null);
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

  const filteredCompiledResults = useMemo(() => {
    if (!search.trim()) return compiledResults;
    const term = search.toLowerCase();
    return compiledResults.filter((row) => row.subject.toLowerCase().includes(term) || row.term.toLowerCase().includes(term));
  }, [compiledResults, search]);

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
          <p className="text-sm text-slate-600 mt-1">View your compiled scores, pass status, and performance trend.</p>
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
          <h2 className="text-xl font-semibold text-slate-900">Compiled Results (CA + Exam)</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject or term"
            className="w-full md:w-72 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
        </div>

        {loading ? (
          <SkeletonList items={5} />
        ) : filteredCompiledResults.length === 0 ? (
          <p className="text-sm text-slate-500">No compiled results found yet.</p>
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
                {filteredCompiledResults.map((row, idx) => (
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

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Attempt History (Audit)</h2>
          <p className="text-xs text-slate-500">{filteredResults.length} attempt(s)</p>
        </div>

        {loading ? (
          <SkeletonList items={5} />
        ) : filteredResults.length === 0 ? (
          <p className="text-sm text-slate-500">No attempt history found.</p>
        ) : (
          <div className="space-y-3">
            {filteredResults.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.exam_title}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {row.subject} | {row.completed_at ? new Date(row.completed_at).toLocaleString() : 'Completed'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900">{row.score}/{row.total_marks}</p>
                    <p className={`text-xs font-semibold ${row.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {row.percentage.toFixed(1)}% | {row.passed ? 'Passed' : 'Failed'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Grade: {row.grade || '-'} {row.position_grade ? `| Band: ${row.position_grade}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {termCompilation?.enabled && (
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Term Breakdown</h2>
            <p className="text-xs text-slate-500">Session: {termCompilation.current_session}</p>
          </div>

          {termCompilation.terms.filter((row) => row.subjects.length > 0).length === 0 ? (
            <p className="text-sm text-slate-500">No compiled term data yet for this session.</p>
          ) : (
            <div className="space-y-3">
              {termCompilation.terms
                .filter((term) => term.subjects.length > 0)
                .map((term) => (
                  <div key={term.term} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{term.term}</h3>
                      <p className="text-xs text-slate-600">
                        Term Avg: {term.term_average !== null ? `${term.term_average.toFixed(2)}%` : '-'}
                        {termCompilation.cumulative_enabled
                          ? ` | CR: ${term.cumulative_average !== null ? `${term.cumulative_average.toFixed(2)}%` : '-'}`
                          : ''}
                      </p>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[520px] text-xs">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-200">
                            <th className="pb-2">Subject</th>
                            <th className="pb-2">CA (%)</th>
                            <th className="pb-2">Exam (%)</th>
                            <th className="pb-2">Compiled (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {term.subjects.map((subject) => (
                            <tr key={`${term.term}-${subject.subject}`} className="border-b border-slate-100">
                              <td className="py-2 text-slate-700">{subject.subject}</td>
                              <td className="py-2 text-slate-700">{subject.ca_score !== null ? subject.ca_score.toFixed(2) : '-'}</td>
                              <td className="py-2 text-slate-700">{subject.exam_score !== null ? subject.exam_score.toFixed(2) : '-'}</td>
                              <td className="py-2 font-semibold text-slate-900">{subject.term_score !== null ? subject.term_score.toFixed(2) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default MyResults;
