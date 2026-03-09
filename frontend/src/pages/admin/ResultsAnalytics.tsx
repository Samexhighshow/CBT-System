import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, SkeletonCard, SkeletonList } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
import { runWithRetry } from '../../utils/requestRetry';

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
  submitted_at?: string;
  completed_at?: string;
  assessment_type?: string;
  time_taken_minutes?: number | null;
}

interface ExamOption {
  id: number;
  title: string;
  class_id?: number;
  subject_name?: string;
  class_name?: string;
  term?: string;
  academic_session?: string;
  results_released?: boolean;
}

interface SittingOption {
  id: number;
  assessment_mode_snapshot?: 'ca_test' | 'exam' | string;
  status?: 'draft' | 'scheduled' | 'active' | 'closed' | string;
  results_released?: boolean;
  session?: string | null;
  term?: string | null;
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
  source_exam_ids: number[];
}

type AssessmentWindowMode = 'exam' | 'ca_test' | 'auto';

const normalizeAssessmentWindowMode = (value: unknown): AssessmentWindowMode => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ca_test' || normalized === 'exam' || normalized === 'auto') {
    return normalized as AssessmentWindowMode;
  }
  return 'auto';
};

const ResultsAnalytics: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'results' | 'compiled' | 'broadsheet'>('results');
  const [exportLoading, setExportLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    average_score: 0,
    pass_rate: 0,
    total_attempts: 0,
  });
  const [examId, setExamId] = useState<string>('');
  const [sittingId, setSittingId] = useState<string>('');
  const [sittings, setSittings] = useState<SittingOption[]>([]);
  const [studentName, setStudentName] = useState<string>('');
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [markingSummary, setMarkingSummary] = useState<MarkingSummary>({
    pending_manual: 0,
    completed_marked: 0,
    total_marking_attempts: 0,
    exams_with_pending: 0,
  });
  const [loadingMarkingSummary, setLoadingMarkingSummary] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [compiledRows, setCompiledRows] = useState<CompiledAdminRow[]>([]);
  const [loadingCompiledRows, setLoadingCompiledRows] = useState(false);
  const [assessmentWindowMode, setAssessmentWindowMode] = useState<AssessmentWindowMode>('auto');
  const [examResults, setExamResults] = useState<AttemptSummary[]>([]);
  const [resultsPage, setResultsPage] = useState(1);
  const [reportCardStudentId, setReportCardStudentId] = useState<string>('');
  const [teacherRemark, setTeacherRemark] = useState<string>('');
  const [principalRemark, setPrincipalRemark] = useState<string>('');
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [remarksSaving, setRemarksSaving] = useState(false);
  const resultsPerPage = 10;

  const activeRouteTab = useMemo<'results' | 'compiled' | 'broadsheet'>(() => {
    const path = location.pathname.toLowerCase();
    if (path.endsWith('/compiled')) return 'compiled';
    if (path.endsWith('/broadsheet')) return 'broadsheet';
    return 'results';
  }, [location.pathname]);

  useEffect(() => {
    setActiveTab(activeRouteTab);
    setResultsPage(1);
  }, [activeRouteTab]);

  const tabRoutePath = (tab: 'results' | 'compiled' | 'broadsheet'): string => {
    if (tab === 'compiled') return '/admin/results/compiled';
    if (tab === 'broadsheet') return '/admin/results/broadsheet';
    return '/admin/results/exam';
  };

  const goToTab = (tab: 'results' | 'compiled' | 'broadsheet') => {
    const nextPath = tabRoutePath(tab);
    const params = new URLSearchParams(location.search);
    if (examId) {
      params.set('examId', examId);
    }
    if (sittingId) {
      params.set('sittingId', sittingId);
    }
    const search = params.toString();
    navigate(search ? `${nextPath}?${search}` : nextPath);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const routeExamId = params.get('examId');
    const routeSittingId = params.get('sittingId');
    if (routeExamId && routeExamId !== examId) {
      setExamId(routeExamId);
    }
    if ((routeSittingId || '') !== sittingId) {
      setSittingId(routeSittingId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    const loadSittings = async () => {
      if (!examId) {
        setSittings([]);
        setSittingId('');
        return;
      }

      try {
        const response = await runWithRetry(() =>
          api.get(`/exams/${examId}/sittings`, { skipGlobalLoading: true } as any)
        );
        const rows = response.data?.sittings || response.data?.data || [];
        const list: SittingOption[] = Array.isArray(rows) ? rows : [];
        setSittings(list);

        if (sittingId && !list.some((row) => String(row.id) === sittingId)) {
          setSittingId('');
        }
      } catch (error) {
        console.error('Failed to load sittings for selected exam', error);
        setSittings([]);
        setSittingId('');
      }
    };

    loadSittings();
  }, [examId, sittingId]);

  useEffect(() => {
    let isActive = true;

    const loadInitial = async () => {
      await Promise.all([loadExams(), loadAnalytics(), loadMarkingSummary(), loadAssessmentWindowMode()]);
    };

    loadInitial();

    const delayedRefresh = window.setTimeout(() => {
      if (!isActive) return;
      loadInitial();
    }, 1500);

    return () => {
      isActive = false;
      window.clearTimeout(delayedRefresh);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAssessmentWindowMode = async () => {
    try {
      const response = await runWithRetry(() =>
        api.get('/settings', { skipGlobalLoading: true } as any)
      );
      const data = response.data?.data || response.data || [];
      const rows = Array.isArray(data) ? data : [];
      const modeRow = rows.find((row: any) => String(row?.key || '').trim() === 'assessment_display_mode');
      setAssessmentWindowMode(normalizeAssessmentWindowMode(modeRow?.value));
    } catch (error) {
      console.warn('Failed to load assessment mode, using auto fallback.', error);
      setAssessmentWindowMode('auto');
    }
  };

  const loadExams = async () => {
    const normalizeExamRows = (payload: any): any[] => {
      const root = payload?.data ?? payload;
      if (Array.isArray(root)) return root;
      if (Array.isArray(root?.data)) return root.data;
      return [];
    };

    const mapExam = (e: any): ExamOption => ({
      id: Number(e.id),
      title: String(e.title || `Exam #${e.id}`),
      class_id: e.class_id,
      subject_name: e.subject?.name || '',
      class_name: e.school_class?.name || '',
      term: e.term || '',
      academic_session: e.academic_session || '',
      results_released: !!e.results_released,
    });

    try {
      const response = await runWithRetry(() => api.get('/exams', { skipGlobalLoading: true } as any));
      let rows = normalizeExamRows(response.data);

      if (rows.length === 0) {
        const markingExams = await runWithRetry(() => api.get('/marking/exams', { skipGlobalLoading: true } as any));
        const markingRows = Array.isArray(markingExams.data?.data) ? markingExams.data.data : [];
        rows = markingRows
          .map((row: any) => ({
            id: Number(row.exam_id || row.id || 0),
            title: String(row.exam_title || row.title || '').trim(),
            class_id: Number(row.class_id || 0) || undefined,
            term: row.term || '',
            academic_session: row.session || row.academic_session || '',
            results_released: !!row.results_released,
            subject: { name: row.subject_name || '' },
            school_class: { name: row.class_name || '' },
          }))
          .filter((row: any) => row.id > 0 && row.title);
      }

      const mapped = rows
        .map(mapExam)
        .filter((row) => Number.isFinite(row.id) && row.id > 0)
        .sort((a, b) => a.title.localeCompare(b.title));

      // Preserve selected context even when exam list endpoint is role-restricted.
      if (examId && !mapped.some((row) => String(row.id) === examId)) {
        mapped.unshift({
          id: Number(examId),
          title: `Exam #${examId}`,
          results_released: false,
        });
      }

      setExams(mapped);
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
      setExams([]);
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
          source_exam_ids: Array.isArray(best.source_exam_ids)
            ? best.source_exam_ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
            : [],
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
      if (examId) {
        const response = await runWithRetry(() =>
          api.get(`/marking/exams/${examId}/attempts`, {
            params: sittingId ? { sitting_id: Number(sittingId) } : undefined,
            skipGlobalLoading: true,
          } as any)
        );
        const rows = response.data?.data || [];
        const pending = Array.isArray(rows)
          ? rows.reduce((sum: number, row: any) => sum + Number(row.pending_manual_count ?? 0), 0)
          : 0;
        const completed = Array.isArray(rows)
          ? rows.filter((row: any) => String(row.status || '').toLowerCase() === 'completed').length
          : 0;
        const total = Array.isArray(rows) ? rows.length : 0;

        setMarkingSummary({
          pending_manual: pending,
          completed_marked: completed,
          total_marking_attempts: total,
          exams_with_pending: pending > 0 ? 1 : 0,
        });
      } else {
        const response = await runWithRetry(() => api.get('/marking/exams', { skipGlobalLoading: true } as any));
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
      }
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

  useEffect(() => {
    if (!examId) return;
    loadAnalytics();
    loadMarkingSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, sittingId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (examId) params.append('exam_id', examId);
      if (sittingId) params.append('sitting_id', sittingId);

      const analyticsRes = await runWithRetry(() =>
        api.get(`/results/analytics?${params.toString()}`, { skipGlobalLoading: true } as any)
      );
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
        const attemptsRes = await runWithRetry(() =>
          api.get(`/marking/exams/${examId}/attempts`, {
            params: sittingId ? { sitting_id: Number(sittingId) } : undefined,
            skipGlobalLoading: true,
          } as any)
        );
        const rows = attemptsRes.data?.data || [];
        const mapped: AttemptSummary[] = Array.isArray(rows)
          ? rows.map((row: any) => {
              const score = Number(row.score ?? 0);
              const totalMarks = Number(row.total_marks ?? 0);
              const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
              const submittedAt = row.submitted_at || null;
              const completedAt = row.completed_at || submittedAt;
              const startedAt = row.started_at || null;
              const timeTakenMinutes = startedAt && completedAt
                ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000))
                : null;

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
                submitted_at: submittedAt,
                completed_at: completedAt,
                assessment_type: row.assessment_type || 'Final Exam',
                time_taken_minutes: Number.isFinite(timeTakenMinutes) ? timeTakenMinutes : null,
              };
            })
          : [];
        setExamResults(mapped);
        setResultsPage(1);
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
        setCompiledRows([]);
        setExamResults([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      // Don't show error, just use default empty state
      setAnalytics({
        average_score: 0,
        pass_rate: 0,
        total_attempts: 0,
      });
      setCompiledRows([]);
      setExamResults([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedExam = useMemo(
    () => exams.find((exam) => String(exam.id) === examId) || null,
    [exams, examId]
  );

  const actionBanner = useMemo(() => {
    if (!examId || !selectedExam) {
      return {
        tone: 'bg-slate-50 border-slate-200 text-slate-800',
        title: 'Select an exam to continue',
        message: 'Pick an exam first, then review attempt-level results and exports in the selected context.',
        cta: null as null | 'marking' | 'release' | 'hide',
      };
    }

    if (markingSummary.pending_manual > 0) {
      return {
        tone: 'bg-amber-50 border-amber-200 text-amber-900',
        title: 'Pending marking requires attention',
        message: 'Finalize all pending scripts before releasing results to students.',
        cta: 'marking' as const,
      };
    }

    const released = sittingId
      ? !!sittings.find((row) => String(row.id) === sittingId)?.results_released
      : !!selectedExam.results_released;

    if (!released) {
      return {
        tone: 'bg-indigo-50 border-indigo-200 text-indigo-900',
        title: 'Results can be released',
        message: sittingId
          ? `All marking appears complete for sitting #${sittingId}. You can now release results.`
          : 'All marking appears complete for this exam. You can now release results to students.',
        cta: 'release' as const,
      };
    }

    return {
      tone: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      title: 'Results are currently visible to students',
      message: sittingId
        ? `Use Hide if you need to pause visibility for sitting #${sittingId}.`
        : 'Use Hide if you need to pause visibility while corrections are made.',
      cta: 'hide' as const,
    };
  }, [examId, selectedExam, markingSummary.pending_manual, sittingId, sittings]);

  const selectedSitting = useMemo(
    () => sittings.find((row) => String(row.id) === sittingId) || null,
    [sittings, sittingId]
  );

  const buildExamReportPath = (format: 'pdf' | 'excel'): string => {
    const query = new URLSearchParams();
    if (sittingId) query.set('sitting_id', sittingId);
    const mode = selectedSitting?.assessment_mode_snapshot;
    if (mode === 'ca_test' || mode === 'exam') {
      query.set('mode', mode);
    }
    const qs = query.toString();
    return `/reports/exam/${examId}/${format}${qs ? `?${qs}` : ''}`;
  };

  const downloadReport = async (path: string, fallbackFilename: string) => {
    try {
      setExportLoading(true);
      const response = await api.get(path, {
        responseType: 'blob',
      } as any);

      const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const text = await (response.data as Blob).text();
        const parsed = JSON.parse(text);
        throw new Error(parsed?.message || 'Export failed.');
      }

      const disposition = String(response.headers?.['content-disposition'] || '');
      const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
      const filename = filenameMatch
        ? filenameMatch[1].replace(/['"]/g, '')
        : fallbackFilename;

      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showSuccess('Report download started.');
    } catch (error: any) {
      showError(error?.message || error?.response?.data?.message || 'Failed to export report.');
    } finally {
      setExportLoading(false);
    }
  };

  const slugTerm = (term: string) => term.trim().toLowerCase().replace(/\s+/g, '-');
  const slugSession = (session: string) => session.trim().replace(/\//g, '-');

  const selectedTerm = String(selectedExam?.term || '').trim();
  const selectedSession = String(selectedExam?.academic_session || '').trim();
  const selectedClassId = Number(selectedExam?.class_id || 0);
  const canExportTermAggregate = !!selectedExam && !!selectedTerm && !!selectedSession && selectedClassId > 0;

  const reportCardStudents = useMemo(() => {
    const map = new Map<number, { id: number; student_name: string; registration_number: string; class_level: string }>();
    compiledRows.forEach((row) => {
      const sid = Number(row.student_id || 0);
      if (sid <= 0 || map.has(sid)) return;
      map.set(sid, {
        id: sid,
        student_name: row.student_name || 'Unknown',
        registration_number: row.registration_number || '-',
        class_level: row.class_level || '-',
      });
    });
    return Array.from(map.values()).sort((a, b) => a.student_name.localeCompare(b.student_name));
  }, [compiledRows]);

  useEffect(() => {
    if (reportCardStudents.length === 0) {
      setReportCardStudentId('');
      return;
    }

    const exists = reportCardStudents.some((student) => String(student.id) === reportCardStudentId);
    if (!exists) {
      setReportCardStudentId(String(reportCardStudents[0].id));
    }
  }, [reportCardStudents, reportCardStudentId]);

  useEffect(() => {
    const loadRemarks = async () => {
      if (!canExportTermAggregate || !reportCardStudentId) {
        setTeacherRemark('');
        setPrincipalRemark('');
        return;
      }

      try {
        setRemarksLoading(true);
        const response = await api.get(
          `/reports/report-cards/student/${encodeURIComponent(reportCardStudentId)}/session/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/remarks`
        );
        const data = response.data?.data || {};
        setTeacherRemark(String(data.teacher_remark || '').replace(/^-$/, ''));
        setPrincipalRemark(String(data.principal_remark || '').replace(/^-$/, ''));
      } catch (error: any) {
        setTeacherRemark('');
        setPrincipalRemark('');
        showError(error?.response?.data?.message || 'Failed to load saved remarks.');
      } finally {
        setRemarksLoading(false);
      }
    };

    loadRemarks();
  }, [canExportTermAggregate, reportCardStudentId, selectedSession, selectedTerm, selectedClassId]);

  const saveReportCardRemarks = async () => {
    if (!canExportTermAggregate || !reportCardStudentId) {
      showError('Select exam context and a student before saving remarks.');
      return;
    }

    try {
      setRemarksSaving(true);
      await api.post(
        `/reports/report-cards/student/${encodeURIComponent(reportCardStudentId)}/session/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/remarks`,
        {
          teacher_remark: teacherRemark,
          principal_remark: principalRemark,
        }
      );
      showSuccess('Report-card remarks saved.');
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to save report-card remarks.');
    } finally {
      setRemarksSaving(false);
    }
  };

  const releaseSelectedExam = async (release: boolean) => {
    if (!selectedExam) {
      showError('Select an exam first.');
      return;
    }

    try {
      setReleaseLoading(true);
      if (sittingId) {
        await api.put(`/exams/${selectedExam.id}/sittings/${sittingId}`, { results_released: release });
        showSuccess(release ? `Results released for sitting #${sittingId}.` : `Results hidden for sitting #${sittingId}.`);
      } else {
        await api.post(`/exams/${selectedExam.id}/toggle-results`, { results_released: release });
        showSuccess(release ? 'Results released for selected exam.' : 'Results hidden for selected exam.');
      }

      await loadExams();
      if (examId) {
        const response = await runWithRetry(() =>
          api.get(`/exams/${examId}/sittings`, { skipGlobalLoading: true } as any)
        );
        const rows = response.data?.sittings || response.data?.data || [];
        setSittings(Array.isArray(rows) ? rows : []);
      }
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to update selected exam visibility.');
    } finally {
      setReleaseLoading(false);
    }
  };

  const filteredExamResults = useMemo(() => {
    const term = studentName.trim().toLowerCase();
    if (!term) return examResults;
    return examResults.filter((row) => {
      const reg = String(row.registration_number || '').toLowerCase();
      const name = String(row.student_name || '').toLowerCase();
      const className = String(row.class_level || '').toLowerCase();
      return name.includes(term) || reg.includes(term) || className.includes(term);
    });
  }, [examResults, studentName]);

  const selectedAttemptRows = useMemo(() => filteredExamResults, [filteredExamResults]);

  const totalResultPages = Math.max(1, Math.ceil(selectedAttemptRows.length / resultsPerPage));
  const currentResultRows = useMemo(() => {
    const start = (resultsPage - 1) * resultsPerPage;
    return selectedAttemptRows.slice(start, start + resultsPerPage);
  }, [selectedAttemptRows, resultsPage]);

  const normalizeResultStatus = (row: AttemptSummary): 'Submitted' | 'Marked' | 'Finalized' | 'Released' => {
    const released = sittingId ? !!selectedSitting?.results_released : !!selectedExam?.results_released;
    if (released) return 'Released';
    if ((row.status || '').toLowerCase() === 'completed') return 'Finalized';
    if ((row.status || '').toLowerCase() === 'submitted') return 'Submitted';
    return 'Marked';
  };

  const statusClass = (status: string) => {
    if (status === 'Released') return 'bg-emerald-100 text-emerald-800';
    if (status === 'Finalized') return 'bg-indigo-100 text-indigo-800';
    if (status === 'Submitted') return 'bg-amber-100 text-amber-800';
    return 'bg-slate-100 text-slate-700';
  };

  const assessmentModeBanner = useMemo(() => {
    if (assessmentWindowMode === 'ca_test') {
      return {
        tone: 'border-blue-200 bg-blue-50 text-blue-900',
        title: 'System Assessment Mode: CA TEST',
        message: 'All attempts started now are recorded as CA Test.',
      };
    }
    if (assessmentWindowMode === 'exam') {
      return {
        tone: 'border-rose-200 bg-rose-50 text-rose-900',
        title: 'System Assessment Mode: FINAL EXAM',
        message: 'All attempts started now are recorded as Final Exam.',
      };
    }
    return {
      tone: 'border-slate-200 bg-slate-50 text-slate-800',
      title: 'System Assessment Mode: AUTO',
      message: 'Attempt mode follows each exam fallback rule.',
    };
  }, [assessmentWindowMode]);

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

        <Card className={`panel-compact border ${assessmentModeBanner.tone}`}>
          <h2 className="text-sm font-semibold">{assessmentModeBanner.title}</h2>
          <p className="text-xs mt-1">{assessmentModeBanner.message}</p>
        </Card>

        <Card className="panel-compact">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <select
              className="input-compact border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setSittingId('');
              }}
              aria-label="Exam filter"
            >
              <option value="">Select Exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.title}</option>
              ))}
            </select>
            <select
              className="input-compact border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
              value={sittingId}
              onChange={(e) => setSittingId(e.target.value)}
              aria-label="Sitting filter"
              disabled={!examId}
            >
              <option value="">All Sittings</option>
              {sittings.map((sitting) => (
                <option key={sitting.id} value={String(sitting.id)}>
                  {`#${sitting.id} | ${(sitting.assessment_mode_snapshot || '').toUpperCase()} | ${sitting.status || '-'} | ${sitting.session || '-'} / ${sitting.term || '-'}`}
                </option>
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
              <button className="btn-compact bg-slate-700 text-white hover:bg-slate-800 transition" onClick={loadExams}>
                Reload Exams
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
                Manage visibility using the currently selected exam and sitting context.
              </p>
            </div>
            {!examId ? (
              <p className="text-xs text-slate-600">Select an exam first to control release visibility.</p>
            ) : (
              <>
                <div className="text-xs text-slate-700 bg-white border border-emerald-100 rounded-lg p-2">
                  {sittingId
                    ? `Target: Sitting #${sittingId} (${selectedSitting?.assessment_mode_snapshot || '-'} | ${selectedSitting?.status || '-'})`
                    : 'Target: Entire exam template (all sittings inherit only if no sitting-level override).'}
                </div>
                <div className="flex gap-2">
                <button
                  onClick={() => releaseSelectedExam(true)}
                  disabled={releaseLoading}
                  className="btn-compact bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {sittingId ? `Release Sitting #${sittingId}` : 'Release Selected Exam'}
                </button>
                <button
                  onClick={() => releaseSelectedExam(false)}
                  disabled={releaseLoading}
                  className="btn-compact bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {sittingId ? `Hide Sitting #${sittingId}` : 'Hide Selected Exam'}
                </button>
                </div>
              </>
            )}
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

        <Card className={`panel-compact border ${actionBanner.tone}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Next Action</h2>
              <p className="text-xs mt-1">{actionBanner.title}</p>
              <p className="text-xs opacity-90 mt-1">{actionBanner.message}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {actionBanner.cta === 'marking' && (
                <button
                  onClick={() => navigate('/admin/marking')}
                  className="btn-compact bg-amber-600 text-white hover:bg-amber-700"
                  title="Open Marking Workbench to score pending manual scripts and finalize attempts"
                >
                  Open Marking
                </button>
              )}
              {actionBanner.cta === 'release' && (
                <button
                  onClick={() => releaseSelectedExam(true)}
                  disabled={releaseLoading}
                  className="btn-compact bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  title="Release makes completed results visible to students"
                >
                  {sittingId ? `Release Sitting #${sittingId}` : 'Release Selected Exam'}
                </button>
              )}
              {actionBanner.cta === 'hide' && (
                <button
                  onClick={() => releaseSelectedExam(false)}
                  disabled={releaseLoading}
                  className="btn-compact bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
                  title="Hide removes student visibility for already computed results"
                >
                  {sittingId ? `Hide Sitting #${sittingId}` : 'Hide Selected Exam'}
                </button>
              )}
            </div>
          </div>
        </Card>

        <Card className="panel-compact">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              className={`btn-compact ${activeTab === 'results' ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
              onClick={() => goToTab('results')}
              title="Attempt-level result summary for selected exam/sitting"
            >
              Result Summary
            </button>
            <button
              className={`btn-compact ${activeTab === 'compiled' ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
              onClick={() => goToTab('compiled')}
              title="Compiled Results tab shows CA + Exam compiled scores by subject for selected exam context"
            >
              Compiled Results
            </button>
            <button
              className={`btn-compact ${activeTab === 'broadsheet' ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
              onClick={() => goToTab('broadsheet')}
              title="Broadsheet and report actions"
            >
              Broadsheet / Reports
            </button>
          </div>
        </Card>

        {activeTab === 'results' && <Card className="panel-compact">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedExam
                  ? `${sittingId ? `Sitting #${sittingId} Results` : 'Result Summary'} - ${selectedExam.title}`
                  : 'Result Summary'}
              </h2>
              <p className="text-xs text-slate-500">
                {sittingId
                  ? 'Sitting-scoped attempt list. Exports and print actions apply to the selected sitting.'
                  : 'Exam-scoped attempt list. Choose a sitting above when you need sitting-specific output.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!!examId && (
                <span className="text-xs text-slate-500">
                  {selectedAttemptRows.length} row(s) • Page {Math.min(resultsPage, totalResultPages)} of {totalResultPages}
                </span>
              )}
              {!!examId && (
                <>
                  <button
                    className="btn-compact bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                    onClick={() => downloadReport(
                      buildExamReportPath('pdf'),
                      `${sittingId ? `sitting_${sittingId}` : 'exam'}_report_${examId}.pdf`
                    )}
                    disabled={exportLoading}
                    title="Download printable result sheet (PDF) for the selected context"
                  >
                    Print Result Sheet (PDF)
                  </button>
                  <button
                    className="btn-compact bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    onClick={() => downloadReport(
                      buildExamReportPath('excel'),
                      `${sittingId ? `sitting_${sittingId}` : 'exam'}_report_${examId}.xlsx`
                    )}
                    disabled={exportLoading}
                    title="Export result sheet (Excel) for the selected context"
                  >
                    Export Result Excel
                  </button>
                </>
              )}
            </div>
          </div>

          {!examId ? (
            <p className="text-sm text-slate-500">Select an exam to view results.</p>
          ) : loading ? (
            <SkeletonList items={4} />
          ) : selectedAttemptRows.length === 0 ? (
            <p className="text-sm text-slate-500">No result rows found for this filter.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-xs border-collapse bg-white">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 border-b">
                      <th className="px-3 py-2 text-left font-semibold">Student</th>
                      <th className="px-3 py-2 text-left font-semibold">Class</th>
                      <th className="px-3 py-2 text-left font-semibold">Score (%)</th>
                      <th className="px-3 py-2 text-left font-semibold">Grade</th>
                      <th className="px-3 py-2 text-left font-semibold">Subject Position</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-left font-semibold">Total Questions</th>
                      <th className="px-3 py-2 text-left font-semibold">Time Taken</th>
                      <th className="px-3 py-2 text-left font-semibold">Attempt Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentResultRows.map((row) => {
                      const normalizedStatus = normalizeResultStatus(row);
                      return (
                        <tr key={row.id} className="border-b border-gray-200 hover:bg-blue-50/40">
                          <td className="px-3 py-2 text-sm text-slate-700">
                            <div className="font-medium">{row.student_name}</div>
                            <div className="text-[11px] text-slate-500">{row.registration_number || '-'}</div>
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-700">{row.class_level || '-'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">
                            {Number(row.score ?? 0).toFixed(1)}/{Number(row.total_marks ?? 0).toFixed(1)} ({Number(row.percentage ?? 0).toFixed(1)}%)
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-700">{row.grade || '-'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">{row.rank_label || '-'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">
                            <span
                              className={`px-2 py-1 rounded-full text-[11px] font-semibold ${statusClass(normalizedStatus)}`}
                              title={
                                normalizedStatus === 'Finalized'
                                  ? 'Finalized means marking is complete and the attempt is locked from further score edits.'
                                  : normalizedStatus === 'Released'
                                    ? 'Released means students can view the result.'
                                    : normalizedStatus === 'Submitted'
                                      ? 'Submitted means waiting for manual marking and finalization.'
                                      : 'Marked means scoring exists but finalization/release may still be pending.'
                              }
                            >
                              {normalizedStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-700">{row.question_count ?? 0}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">
                            {row.time_taken_minutes !== null && row.time_taken_minutes !== undefined
                              ? `${row.time_taken_minutes} min`
                              : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-700">
                            {row.completed_at ? new Date(row.completed_at).toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  className="btn-compact bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  disabled={resultsPage <= 1}
                  onClick={() => setResultsPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn-compact bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  disabled={resultsPage >= totalResultPages}
                  onClick={() => setResultsPage((prev) => Math.min(totalResultPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </Card>}

        {activeTab === 'compiled' && <Card className="panel-compact">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold">Subject Term Aggregate (CA + Exam)</h2>
              <p className="text-xs text-slate-500">
                {examId
                  ? 'Uses latest CA + Exam records for this subject in the current session; not limited to this single exam attempt.'
                  : 'Select an exam to load subject term aggregates.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {examId && <span className="text-xs text-slate-500">{compiledRows.length} row(s)</span>}
              <button
                className="btn-compact bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={!canExportTermAggregate || exportLoading}
                title={canExportTermAggregate
                  ? 'Download printable term aggregate report (PDF)'
                  : 'Select an exam with class, term and session metadata to enable term export.'}
                onClick={() => {
                  if (!canExportTermAggregate) return;
                  downloadReport(
                    `/reports/term/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/pdf`,
                    `term_aggregate_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.pdf`
                  );
                }}
              >
                Print Sheet (PDF)
              </button>
              <button
                className="btn-compact bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={!canExportTermAggregate || exportLoading}
                title={canExportTermAggregate
                  ? 'Download term aggregate report (Excel)'
                  : 'Select an exam with class, term and session metadata to enable term export.'}
                onClick={() => {
                  if (!canExportTermAggregate) return;
                  downloadReport(
                    `/reports/term/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/excel`,
                    `term_aggregate_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.xlsx`
                  );
                }}
              >
                Export Excel
              </button>
            </div>
          </div>

          {!examId && <p className="text-gray-500 text-sm">Choose an exam above to view subject term aggregates.</p>}
          {examId && loadingCompiledRows && <SkeletonList items={4} />}
          {examId && !loadingCompiledRows && compiledRows.length === 0 && (
            <p className="text-gray-500 text-sm">No aggregate rows found for this exam subject yet.</p>
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
                    <th className="px-3 py-2 text-left font-semibold" title="Continuous Assessment weighted score for this subject in term context">CA (%)</th>
                    <th className="px-3 py-2 text-left font-semibold" title="Exam component weighted score for this subject in term context">Exam (%)</th>
                    <th className="px-3 py-2 text-left font-semibold" title="Compiled score from CA and Exam using configured weights">Compiled (%)</th>
                    <th className="px-3 py-2 text-left font-semibold" title="Cumulative/Composite result average for this student across loaded subject rows">CR (%)</th>
                    <th className="px-3 py-2 text-left font-semibold" title="Exam IDs used as source records to compute this aggregate row">Source Exam ID(s)</th>
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
                      <td className="px-3 py-2 text-sm text-slate-700">
                        {row.source_exam_ids.length > 0
                          ? row.source_exam_ids.map((id) => `#${id}`).join(', ')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>}

        {activeTab === 'broadsheet' && <Card className="panel-compact border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Broadsheet / Reports Workspace</h2>
              <p className="text-xs text-slate-600">
                Generate subject broadsheet outputs from the current exam context and access reporting actions.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {!examId ? 'Select an exam above to enable report actions.' : `Exam #${examId} selected`}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-slate-900">Subject Broadsheet</h3>
              <p className="text-xs text-slate-600 mt-1">Exports compiled subject rows (CA + Exam + Total) for selected class/session/term context.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn-compact bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={!canExportTermAggregate || exportLoading}
                  onClick={() => {
                    if (!canExportTermAggregate) return;
                    downloadReport(
                      `/reports/term/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/pdf`,
                      `subject_broadsheet_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.pdf`
                    );
                  }}
                >
                  Print Subject Broadsheet
                </button>
                <button
                  className="btn-compact bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!canExportTermAggregate || exportLoading}
                  onClick={() => {
                    if (!canExportTermAggregate) return;
                    downloadReport(
                      `/reports/term/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/excel`,
                      `subject_broadsheet_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.xlsx`
                    );
                  }}
                >
                  Export Subject Broadsheet
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-slate-900">Class Reports</h3>
              <p className="text-xs text-slate-600 mt-1">Generate full class broadsheet reports for the selected term/class/session context.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn-compact bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={!canExportTermAggregate || exportLoading}
                  title={canExportTermAggregate
                    ? 'Download full class broadsheet (PDF)'
                    : 'Select an exam with class, term and session metadata to enable class broadsheet export.'}
                  onClick={() => {
                    if (!canExportTermAggregate) return;
                    downloadReport(
                      `/reports/broadsheet/class/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/pdf`,
                      `class_broadsheet_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.pdf`
                    );
                  }}
                >
                  Print Full Class Broadsheet
                </button>
                <button
                  className="btn-compact bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!canExportTermAggregate || exportLoading}
                  title={canExportTermAggregate
                    ? 'Download full class broadsheet (Excel)'
                    : 'Select an exam with class, term and session metadata to enable class broadsheet export.'}
                  onClick={() => {
                    if (!canExportTermAggregate) return;
                    downloadReport(
                      `/reports/broadsheet/class/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/excel`,
                      `class_broadsheet_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.xlsx`
                    );
                  }}
                >
                  Export Full Class Broadsheet
                </button>
                <button
                  className="btn-compact bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={!canExportTermAggregate || exportLoading}
                  title={canExportTermAggregate
                    ? 'Download class report cards summary (Excel)'
                    : 'Select an exam with class, term and session metadata to enable report-card export.'}
                  onClick={() => {
                    if (!canExportTermAggregate) return;
                    downloadReport(
                      `/reports/report-cards/class/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/excel`,
                      `class_report_cards_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.xlsx`
                    );
                  }}
                >
                  Generate Report Cards (Excel)
                </button>
                <button
                  className="btn-compact bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={!canExportTermAggregate || exportLoading}
                  title={canExportTermAggregate
                    ? 'Download class report cards summary (PDF)'
                    : 'Select an exam with class, term and session metadata to enable report-card print.'}
                  onClick={() => {
                    if (!canExportTermAggregate) return;
                    downloadReport(
                      `/reports/report-cards/class/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/pdf`,
                      `class_report_cards_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.pdf`
                    );
                  }}
                >
                  Print Report Cards (PDF)
                </button>
              </div>

              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Single Student Report Card</p>
                <p className="text-[11px] text-slate-600 mt-1">Select a student and optionally add remarks before generating their report card.</p>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <select
                    className="input-compact border border-slate-200 text-sm bg-white"
                    value={reportCardStudentId}
                    onChange={(e) => setReportCardStudentId(e.target.value)}
                    disabled={!canExportTermAggregate || reportCardStudents.length === 0 || exportLoading}
                  >
                    {reportCardStudents.length === 0 ? (
                      <option value="">No students available</option>
                    ) : (
                      reportCardStudents.map((student) => (
                        <option key={student.id} value={String(student.id)}>
                          {student.student_name} ({student.registration_number})
                        </option>
                      ))
                    )}
                  </select>
                  <input
                    className="input-compact border border-slate-200 text-sm bg-white"
                    placeholder="Teacher remark (optional)"
                    value={teacherRemark}
                    onChange={(e) => setTeacherRemark(e.target.value)}
                    disabled={!canExportTermAggregate || reportCardStudents.length === 0 || exportLoading || remarksLoading}
                  />
                  <input
                    className="input-compact border border-slate-200 text-sm bg-white"
                    placeholder="Principal remark (optional)"
                    value={principalRemark}
                    onChange={(e) => setPrincipalRemark(e.target.value)}
                    disabled={!canExportTermAggregate || reportCardStudents.length === 0 || exportLoading || remarksLoading}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="btn-compact bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={!canExportTermAggregate || !reportCardStudentId || exportLoading || remarksSaving || remarksLoading}
                    onClick={saveReportCardRemarks}
                  >
                    {remarksSaving ? 'Saving...' : 'Save Remarks'}
                  </button>
                  <button
                    className="btn-compact bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    disabled={!canExportTermAggregate || !reportCardStudentId || exportLoading}
                    onClick={() => {
                      if (!canExportTermAggregate || !reportCardStudentId) return;
                      const params = new URLSearchParams();
                      if (teacherRemark.trim()) params.set('teacher_remark', teacherRemark.trim());
                      if (principalRemark.trim()) params.set('principal_remark', principalRemark.trim());
                      const suffix = params.toString();
                      downloadReport(
                        `/reports/report-cards/student/${encodeURIComponent(reportCardStudentId)}/session/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/excel${suffix ? `?${suffix}` : ''}`,
                        `student_report_card_${reportCardStudentId}_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.xlsx`
                      );
                    }}
                  >
                    Export Student Card (Excel)
                  </button>
                  <button
                    className="btn-compact bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={!canExportTermAggregate || !reportCardStudentId || exportLoading}
                    onClick={() => {
                      if (!canExportTermAggregate || !reportCardStudentId) return;
                      const params = new URLSearchParams();
                      if (teacherRemark.trim()) params.set('teacher_remark', teacherRemark.trim());
                      if (principalRemark.trim()) params.set('principal_remark', principalRemark.trim());
                      const suffix = params.toString();
                      downloadReport(
                        `/reports/report-cards/student/${encodeURIComponent(reportCardStudentId)}/session/${encodeURIComponent(slugSession(selectedSession))}/term/${encodeURIComponent(slugTerm(selectedTerm))}/class/${selectedClassId}/pdf${suffix ? `?${suffix}` : ''}`,
                        `student_report_card_${reportCardStudentId}_${slugSession(selectedSession)}_${slugTerm(selectedTerm)}_class_${selectedClassId}.pdf`
                      );
                    }}
                  >
                    Print Student Card (PDF)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>}
      </div>
    </div>
  );
};

export default ResultsAnalytics;

