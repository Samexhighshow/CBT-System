import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, SkeletonCard, SkeletonList } from '../../components';
import { api } from '../../services/api';

interface AnalyticsData {
  average_score: number;
  pass_rate: number;
  total_attempts: number;
}

interface AttemptSummary {
  id: number;
  student_name: string;
  registration_number?: string;
  department?: string;
  class_level: string;
  score: number;
  total_marks: number;
  question_count: number;
  answered_count: number;
  pending_manual_count: number;
  status?: string;
  percentage?: number;
  completed_at?: string;
}

interface ExamOption {
  id: number;
  title: string;
}

interface MarkingSummary {
  pending_manual: number;
  completed_marked: number;
  total_marking_attempts: number;
  exams_with_pending: number;
}

const ResultsAnalytics: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    average_score: 0,
    pass_rate: 0,
    total_attempts: 0,
  });
  const [examId, setExamId] = useState<string>('');
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [studentName, setStudentName] = useState<string>('');
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [markingSummary, setMarkingSummary] = useState<MarkingSummary>({
    pending_manual: 0,
    completed_marked: 0,
    total_marking_attempts: 0,
    exams_with_pending: 0,
  });
  const [loadingMarkingSummary, setLoadingMarkingSummary] = useState(false);
  const [attemptSort, setAttemptSort] = useState<'student_asc' | 'student_desc' | 'score_desc' | 'score_asc' | 'recent'>('recent');
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadExams();
    loadAnalytics();
    loadMarkingSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadExams = async () => {
    try {
      const response = await api.get('/exams');
      const data = response.data?.data || response.data || [];
      setExams(Array.isArray(data) ? data.map((e: any) => ({ id: e.id, title: e.title })) : []);
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
      setExams([]);
    }
  };

  const loadMarkingSummary = async () => {
    try {
      setLoadingMarkingSummary(true);
      const response = await api.get('/marking/exams');
      const rows = response.data?.data || [];

      const summary = rows.reduce((acc: MarkingSummary, row: any) => {
        const pending = Number(row.pending_marking ?? 0);
        const completed = Number(row.completed_marking ?? 0);
        const total = Number(row.total_attempts ?? 0);

        return {
          pending_manual: acc.pending_manual + pending,
          completed_marked: acc.completed_marked + completed,
          total_marking_attempts: acc.total_marking_attempts + total,
          exams_with_pending: acc.exams_with_pending + (pending > 0 ? 1 : 0),
        };
      }, {
        pending_manual: 0,
        completed_marked: 0,
        total_marking_attempts: 0,
        exams_with_pending: 0,
      });

      setMarkingSummary(summary);
    } catch (error: any) {
      console.error('Failed to load marking summary:', error);
      setMarkingSummary({
        pending_manual: 0,
        completed_marked: 0,
        total_marking_attempts: 0,
        exams_with_pending: 0,
      });
    } finally {
      setLoadingMarkingSummary(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (examId) params.append('exam_id', examId);

      const analyticsRes = await api.get(`/results/analytics?${params.toString()}`);
      if (analyticsRes.data) {
        const totalAttempts = Number(
          analyticsRes.data.total_attempts ?? analyticsRes.data.total_submissions ?? 0
        );

        setAnalytics({
          average_score: Number(analyticsRes.data.average_score ?? 0),
          pass_rate: Number(analyticsRes.data.pass_rate ?? 0),
          total_attempts: totalAttempts,
        });
      }

      if (examId) {
        // Use marking attempts endpoint so submitted/pending scripts are included too.
        const attemptsRes = await api.get(`/marking/exams/${examId}/attempts`);
        const rows = attemptsRes.data?.data || [];
        const mapped: AttemptSummary[] = Array.isArray(rows)
          ? rows.map((row: any) => {
              const score = Number(row.score ?? 0);
              const totalMarks = Number(row.total_marks ?? 0);
              const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

              return {
                id: row.id,
                student_name: row.student?.name || 'Unknown',
                registration_number: row.student?.registration_number,
                department: undefined,
                class_level: row.student?.class_level || 'N/A',
                score,
                total_marks: totalMarks,
                question_count: Number(row.question_count ?? 0),
                answered_count: Number(row.answered_count ?? 0),
                pending_manual_count: Number(row.pending_manual_count ?? 0),
                status: String(row.status || '').toLowerCase(),
                percentage,
                completed_at: row.completed_at || row.submitted_at,
              };
            })
          : [];
        setAttempts(mapped);

        if (mapped.length > 0) {
          const totalSubmissions = mapped.length;
          const avgScore = mapped.reduce((sum, row) => sum + (row.percentage ?? 0), 0) / totalSubmissions;
          const passCount = mapped.filter((row) => (row.percentage ?? 0) >= 50).length;
          setAnalytics({
            average_score: Number.isFinite(avgScore) ? avgScore : 0,
            pass_rate: totalSubmissions > 0 ? (passCount / totalSubmissions) * 100 : 0,
            total_attempts: totalSubmissions,
          });
        } else {
          setAnalytics({
            average_score: 0,
            pass_rate: 0,
            total_attempts: 0,
          });
        }
      } else {
        setAttempts([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      // Don't show error, just use default empty state
      setAnalytics({
        average_score: 0,
        pass_rate: 0,
        total_attempts: 0,
      });
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredAttempts = useMemo(() => {
    if (!studentName) return attempts;
    const term = studentName.toLowerCase();
    return attempts.filter((a) => a.student_name?.toLowerCase().includes(term));
  }, [attempts, studentName]);

  const sortedAttempts = useMemo(() => {
    return [...filteredAttempts].sort((a, b) => {
      switch (attemptSort) {
        case 'student_asc':
          return (a.student_name || '').localeCompare(b.student_name || '');
        case 'student_desc':
          return (b.student_name || '').localeCompare(a.student_name || '');
        case 'score_desc':
          return (b.percentage || 0) - (a.percentage || 0);
        case 'score_asc':
          return (a.percentage || 0) - (b.percentage || 0);
        case 'recent':
        default: {
          const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          return bTime - aTime;
        }
      }
    });
  }, [filteredAttempts, attemptSort]);

  const totalPages = Math.max(1, Math.ceil(sortedAttempts.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedAttempts = sortedAttempts.slice((currentPage - 1) * perPage, currentPage * perPage);

  const getPageNumbers = (current: number, total: number): Array<number | string> => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: Array<number | string> = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (end < total - 1) pages.push('...');
    pages.push(total);
    return pages;
  };

  useEffect(() => {
    setPage(1);
  }, [examId, studentName, perPage, attemptSort, attempts.length]);
  
  return (
    <div className="app-shell section-shell">
      <div className="stack-tight">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Results & Marking</h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">Monitor results, pending marking, and performance.</p>
          </div>
          <button
            onClick={() => navigate('/admin/marking')}
            className="btn-compact bg-indigo-600 text-white hover:bg-indigo-700 transition inline-flex items-center gap-2"
          >
            <i className="bx bx-check-square text-base"></i>
            Open Marking Workbench
          </button>
        </div>

        <Card className="panel-compact">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <select
              className="input-compact border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              aria-label="Exam filter"
            >
              <option value="">Select Exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.title}</option>
              ))}
            </select>
            <input
              className="input-compact border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
              placeholder="Filter by student name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button className="btn-compact bg-blue-600 text-white hover:bg-blue-700 transition" onClick={loadAnalytics}>
                Refresh Analytics
              </button>
              <button className="btn-compact bg-slate-900 text-white hover:bg-slate-800 transition" onClick={loadMarkingSummary}>
                Refresh Marking Summary
              </button>
            </div>
          </div>
        </Card>

        <Card className="panel-compact border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-white">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-indigo-900">Marking Summary</h2>
              <p className="text-xs text-indigo-800 mt-1">
                Pending scripts that need manual scoring and finalization.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-[11px] text-slate-500">Pending Manual</p>
              <p className="text-xl font-bold text-amber-700">
                {loadingMarkingSummary ? '...' : markingSummary.pending_manual.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-[11px] text-slate-500">Completed Marked</p>
              <p className="text-xl font-bold text-emerald-700">
                {loadingMarkingSummary ? '...' : markingSummary.completed_marked.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-[11px] text-slate-500">Total Attempts</p>
              <p className="text-xl font-bold text-indigo-700">
                {loadingMarkingSummary ? '...' : markingSummary.total_marking_attempts.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-[11px] text-slate-500">Exams With Pending</p>
              <p className="text-xl font-bold text-rose-700">
                {loadingMarkingSummary ? '...' : markingSummary.exams_with_pending.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 grid-tight">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <Card className="panel-compact bg-green-50">
                <p className="text-xs text-gray-600">Average Score</p>
                <h3 className="text-2xl font-bold text-green-700 mt-1">
                  {`${Number(analytics.average_score ?? 0).toFixed(1)}%`}
                </h3>
              </Card>
              <Card className="panel-compact bg-blue-50">
                <p className="text-xs text-gray-600">Pass Rate</p>
                <h3 className="text-2xl font-bold text-blue-700 mt-1">
                  {`${Number(analytics.pass_rate ?? 0).toFixed(1)}%`}
                </h3>
              </Card>
              <Card className="panel-compact bg-purple-50">
                <p className="text-xs text-gray-600">Submissions</p>
                <h3 className="text-2xl font-bold text-purple-700 mt-1">
                  {Number(analytics.total_attempts ?? 0).toLocaleString()}
                </h3>
              </Card>
            </>
          )}
        </div>

        <Card className="panel-compact">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold">Attempt Details</h2>
              <p className="text-xs text-slate-500">
                {sortedAttempts.length} matching attempts
                {sortedAttempts.length > 0 ? ` | Showing ${((currentPage - 1) * perPage) + 1}-${Math.min(currentPage * perPage, sortedAttempts.length)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {examId && <span className="text-xs text-slate-500">Filtered by exam</span>}
              <select
                value={attemptSort}
                onChange={(e) => setAttemptSort(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
              >
                <option value="recent">Most Recent</option>
                <option value="student_asc">Student A-Z</option>
                <option value="student_desc">Student Z-A</option>
                <option value="score_desc">Score High-Low</option>
                <option value="score_asc">Score Low-High</option>
              </select>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
          {sortedAttempts.length === 0 && !loading && (
            <p className="text-gray-500">No attempts found for the selected filters.</p>
          )}
          {loading && <SkeletonList />}
          {!loading && sortedAttempts.length > 0 && (
            <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-xs border-collapse bg-white">
                <thead>
                  <tr className="sticky top-0 z-10 bg-gray-50 text-gray-700 border-b">
                    <th className="px-3 py-2 text-left font-semibold">Student</th>
                    <th className="px-3 py-2 text-left font-semibold">Class</th>
                    <th className="px-3 py-2 text-left font-semibold">Score (Marks)</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAttempts.map((a, index) => (
                    <tr
                      key={a.id}
                      className={`border-b border-gray-200 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      } hover:bg-blue-50/60`}
                    >
                      <td className="px-3 py-2 text-sm text-slate-700">{a.student_name}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{a.class_level}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">
                        <div>{a.score}/{a.total_marks} marks ({(a.percentage ?? 0).toFixed(1)}%)</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {a.answered_count}/{a.question_count} answered
                          {a.pending_manual_count > 0 ? ` · ${a.pending_manual_count} pending manual` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                            a.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.status === 'submitted'
                                ? 'bg-amber-100 text-amber-800'
                                : a.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : a.status === 'expired'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {a.status === 'completed'
                            ? 'Completed'
                            : a.status === 'submitted'
                              ? 'Pending Marking'
                              : a.status === 'in_progress'
                                ? 'In Progress'
                                : a.status === 'expired'
                                  ? 'Expired'
                                  : 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 px-1 py-3 border-t border-gray-200 bg-gray-50/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="text-gray-600">
                Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, sortedAttempts.length)} of {sortedAttempts.length}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Prev
                </button>
                {getPageNumbers(currentPage, totalPages).map((pageNum, idx) => (
                  pageNum === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum as number)}
                      className={`min-w-[34px] px-2.5 py-1.5 border rounded-md ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResultsAnalytics;
