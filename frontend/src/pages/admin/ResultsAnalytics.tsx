import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, SkeletonCard, SkeletonList } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';

interface AnalyticsData {
  average_score: number;
  pass_rate: number;
  total_attempts: number;
}

interface AttemptSummary {
  id: number;
  student_id?: number;
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
  grade?: string | null;
  position_grade?: string | null;
  rank_label?: string | null;
  completed_at?: string;
}

interface ExamOption {
  id: number;
  title: string;
  subject_name?: string;
  class_name?: string;
  results_released?: boolean;
}

interface MarkingSummary {
  pending_manual: number;
  completed_marked: number;
  total_marking_attempts: number;
  exams_with_pending: number;
}

interface CompiledAdminRow {
  student_id: number;
  student_name: string;
  registration_number: string;
  class_level: string;
  term: string;
  subject: string;
  ca_score: number | null;
  exam_score: number | null;
  compiled_score: number | null;
  cumulative_average: number | null;
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
  const [releaseClass, setReleaseClass] = useState<string>('');
  const [releaseSubject, setReleaseSubject] = useState<string>('');
  const [releaseExamId, setReleaseExamId] = useState<string>('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [compiledRows, setCompiledRows] = useState<CompiledAdminRow[]>([]);
  const [loadingCompiledRows, setLoadingCompiledRows] = useState(false);

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
      setExams(Array.isArray(data) ? data.map((e: any) => ({
        id: e.id,
        title: e.title,
        subject_name: e.subject?.name || '',
        class_name: e.school_class?.name || '',
        results_released: !!e.results_released,
      })) : []);
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
      setExams([]);
    }
  };

  const classOptions = useMemo(
    () => Array.from(new Set(exams.map((e) => String(e.class_name || '').trim()).filter(Boolean))).sort(),
    [exams]
  );

  const subjectOptions = useMemo(
    () => Array.from(new Set(exams.map((e) => String(e.subject_name || '').trim()).filter(Boolean))).sort(),
    [exams]
  );

  const releaseCandidates = useMemo(() => {
    if (releaseExamId) {
      return exams.filter((e) => String(e.id) === releaseExamId);
    }
    return exams.filter((e) => {
      const classOk = releaseClass ? (e.class_name || '') === releaseClass : true;
      const subjectOk = releaseSubject ? (e.subject_name || '') === releaseSubject : true;
      return classOk && subjectOk;
    });
  }, [exams, releaseClass, releaseSubject, releaseExamId]);

  const handleReleaseVisibility = async (release: boolean) => {
    if (releaseCandidates.length === 0) {
      showError('No exams matched the selected exam/subject/class filter.');
      return;
    }

    try {
      setReleaseLoading(true);
      const settled = await Promise.allSettled(
        releaseCandidates.map((exam) =>
          api.post(`/exams/${exam.id}/toggle-results`, { results_released: release })
        )
      );

      const successCount = settled.filter((item) => item.status === 'fulfilled').length;
      const failCount = settled.length - successCount;

      if (successCount > 0) {
        showSuccess(
          release
            ? `Released results for ${successCount} exam(s).`
            : `Hidden results for ${successCount} exam(s).`
        );
      }
      if (failCount > 0) {
        showError(`${failCount} exam(s) failed to update results visibility.`);
      }

      await loadExams();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to update result visibility.');
    } finally {
      setReleaseLoading(false);
    }
  };

  const loadCompiledResults = async (attemptRows: AttemptSummary[], selectedExamId: string) => {
    if (!selectedExamId || attemptRows.length === 0) {
      setCompiledRows([]);
      return;
    }

    try {
      setLoadingCompiledRows(true);

      const selectedExam = exams.find((e) => String(e.id) === selectedExamId);
      const subjectName = (selectedExam?.subject_name || '').trim().toLowerCase();

      const byStudent = new Map<number, AttemptSummary>();
      attemptRows.forEach((row) => {
        if (row.student_id && !byStudent.has(row.student_id)) {
          byStudent.set(row.student_id, row);
        }
      });

      const studentIds = Array.from(byStudent.keys());
      const settled = await Promise.allSettled(
        studentIds.map((studentId) => api.get(`/results/student/${studentId}`, { params: { limit: 1 } }))
      );

      const termOrder: Record<string, number> = {
        'first term': 1,
        'second term': 2,
        'third term': 3,
      };

      const rows: CompiledAdminRow[] = [];
      settled.forEach((item, idx) => {
        if (item.status !== 'fulfilled') return;

        const studentId = studentIds[idx];
        const attempt = byStudent.get(studentId);
        if (!attempt) return;

        const compiled: any[] = item.value.data?.compiled_results || [];
        if (!Array.isArray(compiled) || compiled.length === 0) return;

        const filtered = subjectName
          ? compiled.filter((entry) => String(entry.subject || '').trim().toLowerCase() === subjectName)
          : compiled;
        if (filtered.length === 0) return;

        const best = [...filtered].sort((a, b) => {
          const aTerm = termOrder[String(a.term || '').trim().toLowerCase()] || 0;
          const bTerm = termOrder[String(b.term || '').trim().toLowerCase()] || 0;
          return bTerm - aTerm;
        })[0];

        rows.push({
          student_id: studentId,
          student_name: attempt.student_name || 'Unknown',
          registration_number: attempt.registration_number || '-',
          class_level: attempt.class_level || 'N/A',
          term: String(best.term || '-'),
          subject: String(best.subject || selectedExam?.subject_name || '-'),
          ca_score: best.ca_score ?? null,
          exam_score: best.exam_score ?? null,
          compiled_score: best.compiled_score ?? null,
          cumulative_average: best.cumulative_average ?? null,
        });
      });

      rows.sort((a, b) => {
        const aScore = a.compiled_score ?? -1;
        const bScore = b.compiled_score ?? -1;
        return bScore - aScore;
      });

      setCompiledRows(rows);
    } catch (error) {
      console.error('Failed to load compiled results for selected exam:', error);
      setCompiledRows([]);
    } finally {
      setLoadingCompiledRows(false);
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
                student_id: Number(row.student?.id ?? 0),
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
                grade: row.grade || null,
                position_grade: row.position_grade || null,
                rank_label: row.rank_label || null,
                completed_at: row.completed_at || row.submitted_at,
              };
            })
          : [];
        setAttempts(mapped);
        await loadCompiledResults(mapped, examId);

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
        setCompiledRows([]);
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
      setCompiledRows([]);
    } finally {
      setLoading(false);
    }
  };

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

        <Card className="panel-compact border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-white">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold text-emerald-900">Release Results Control</h2>
              <p className="text-xs text-emerald-800 mt-1">
                Release or hide results by exam, subject, or class from one place.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                value={releaseClass}
                onChange={(e) => setReleaseClass(e.target.value)}
                className="input-compact border border-emerald-200 text-sm bg-white"
              >
                <option value="">All Classes</option>
                {classOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select
                value={releaseSubject}
                onChange={(e) => setReleaseSubject(e.target.value)}
                className="input-compact border border-emerald-200 text-sm bg-white"
              >
                <option value="">All Subjects</option>
                {subjectOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select
                value={releaseExamId}
                onChange={(e) => setReleaseExamId(e.target.value)}
                className="input-compact border border-emerald-200 text-sm bg-white"
              >
                <option value="">All Matching Exams</option>
                {exams
                  .filter((e) => !releaseClass || (e.class_name || '') === releaseClass)
                  .filter((e) => !releaseSubject || (e.subject_name || '') === releaseSubject)
                  .map((exam) => (
                    <option key={exam.id} value={String(exam.id)}>
                      {exam.title}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReleaseVisibility(true)}
                  disabled={releaseLoading}
                  className="btn-compact bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Release
                </button>
                <button
                  onClick={() => handleReleaseVisibility(false)}
                  disabled={releaseLoading}
                  className="btn-compact bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Hide
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Target exams: <span className="font-semibold">{releaseCandidates.length}</span>
            </p>
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
              <h2 className="text-lg font-semibold">Compiled Results (CA + Exam)</h2>
              <p className="text-xs text-slate-500">
                {examId ? 'Primary merged scores for selected exam subject.' : 'Select an exam to load compiled results.'}
              </p>
            </div>
            {examId && <span className="text-xs text-slate-500">{compiledRows.length} row(s)</span>}
          </div>

          {!examId && <p className="text-gray-500 text-sm">Choose an exam above to view compiled CA + Exam scores.</p>}
          {examId && loadingCompiledRows && <SkeletonList items={4} />}
          {examId && !loadingCompiledRows && compiledRows.length === 0 && (
            <p className="text-gray-500 text-sm">No compiled rows found for this exam subject yet.</p>
          )}

          {examId && !loadingCompiledRows && compiledRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs border-collapse bg-white">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b">
                    <th className="px-3 py-2 text-left font-semibold">Student</th>
                    <th className="px-3 py-2 text-left font-semibold">Class</th>
                    <th className="px-3 py-2 text-left font-semibold">Term</th>
                    <th className="px-3 py-2 text-left font-semibold">Subject</th>
                    <th className="px-3 py-2 text-left font-semibold">CA (%)</th>
                    <th className="px-3 py-2 text-left font-semibold">Exam (%)</th>
                    <th className="px-3 py-2 text-left font-semibold">Compiled (%)</th>
                    <th className="px-3 py-2 text-left font-semibold">CR (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {compiledRows.map((row, index) => (
                    <tr
                      key={`${row.student_id}-${row.term}-${row.subject}-${index}`}
                      className={`border-b border-gray-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      } hover:bg-blue-50/60`}
                    >
                      <td className="px-3 py-2 text-sm text-slate-700">
                        <div className="font-medium">{row.student_name}</div>
                        <div className="text-[11px] text-slate-500">{row.registration_number}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.class_level}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.term}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.subject}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.ca_score !== null ? row.ca_score.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.exam_score !== null ? row.exam_score.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-900">{row.compiled_score !== null ? row.compiled_score.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.cumulative_average !== null ? row.cumulative_average.toFixed(2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>`n      </div>
    </div>
  );
};

export default ResultsAnalytics;

