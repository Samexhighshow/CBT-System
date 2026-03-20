import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
import useAuthStore from '../../store/authStore';

interface MarkingExamRow {
  id: number;
  title: string;
  subject?: string;
  class_level?: string;
  pending_marking: number;
  completed_marking: number;
  total_attempts: number;
}

interface MarkingAttemptRow {
  id: number;
  status: string;
  score?: number | null;
  total_marks?: number | null;
  grade?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  pending_manual_count: number;
  answered_count: number;
  student: {
    id: number;
    registration_number?: string;
    name: string;
    class_level?: string;
  };
  security_summary?: SecuritySummary;
}

interface SecuritySummary {
  tab_warning_count: number;
  blocked_action_count: number;
  session_replace_count: number;
  total_events: number;
  last_violation_at?: string | null;
}

interface AttemptEventRow {
  event_type: string;
  meta?: Record<string, unknown>;
  created_at?: string | null;
}

interface AttemptQuestion {
  question_id: number;
  question_text: string;
  question_type: string;
  marks: number;
  requires_manual_marking: boolean;
  options: Array<{ id: number; option_text: string }>;
  correct_option_ids: number[];
  answer: {
    id?: number;
    option_id?: number | null;
    option_ids?: number[];
    answer_text?: string | null;
    flagged: boolean;
    is_correct?: boolean | null;
    marks_awarded?: number | null;
    feedback?: string | null;
    reviewed_at?: string | null;
  };
}

interface AttemptDetailResponse {
  attempt: {
    id: number;
    status: string;
    score?: number | null;
    submitted_at?: string | null;
    completed_at?: string | null;
    answered_count: number;
    pending_manual_count: number;
    student: {
      id: number;
      registration_number?: string;
      name: string;
      class_level?: string;
    };
    exam: {
      id: number;
      title: string;
    };
    security_summary?: SecuritySummary;
  };
  questions: AttemptQuestion[];
  recent_events?: AttemptEventRow[];
}

interface ScoreFormState {
  marks: string;
  feedback: string;
}

const statusBadge = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'submitted') return 'bg-amber-100 text-amber-800';
  if (normalized === 'in_progress') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-700';
};

const isForceSubmitLockedStatus = (status?: string | null) => {
  const normalized = String(status ?? '').toLowerCase();
  return ['submitted', 'completed', 'voided'].includes(normalized);
};

const formatEventLabel = (eventType: string) => eventType
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatEventDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const hasCandidateResponse = (question: AttemptQuestion) => {
  const hasOption = typeof question.answer.option_id === 'number' && question.answer.option_id > 0;
  const hasMultiOption = Array.isArray(question.answer.option_ids) && question.answer.option_ids.length > 0;
  const text = normalizeStudentText(question.answer.answer_text);
  return hasOption || hasMultiOption || !!text;
};

const riskLevel = (summary?: SecuritySummary) => {
  const tabWarnings = Number(summary?.tab_warning_count ?? 0);
  const blockedActions = Number(summary?.blocked_action_count ?? 0);
  const sessionSwitches = Number(summary?.session_replace_count ?? 0);
  const score = tabWarnings + blockedActions + sessionSwitches;

  if (score <= 0) {
    return { label: 'Low', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  }
  if (score <= 3) {
    return { label: 'Moderate', className: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  return { label: 'High', className: 'bg-red-100 text-red-800 border-red-200' };
};

const gradeBand = (percentage: number) => {
  if (percentage >= 75) return 'A1';
  if (percentage >= 70) return 'B2';
  if (percentage >= 65) return 'B3';
  if (percentage >= 60) return 'C4';
  if (percentage >= 55) return 'C5';
  if (percentage >= 50) return 'C6';
  if (percentage >= 45) return 'D7';
  if (percentage >= 40) return 'E8';
  return 'F9';
};

const extractFirstNonEmptyString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractFirstNonEmptyString(item);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      const found = extractFirstNonEmptyString(entry);
      if (found) return found;
    }
  }

  return null;
};

const normalizeStudentText = (raw?: string | null): string | null => {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!looksLikeJson) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (typeof parsed === 'string') {
      const normalized = parsed.trim();
      return normalized.length > 0 ? normalized : null;
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const parsedObj = parsed as Record<string, unknown>;
      const priorityKeys = ['answer_text', 'text', 'response', 'value'];

      for (const key of priorityKeys) {
        const candidate = extractFirstNonEmptyString(parsedObj[key]);
        if (candidate) return candidate;
      }
    }

    return extractFirstNonEmptyString(parsed);
  } catch {
    // If backend saved plain text that happens to start with "{" or "[", keep it visible.
    return trimmed;
  }
};

const MarkingWorkbench: React.FC = () => {
  const { user } = useAuthStore();
  const [exams, setExams] = useState<MarkingExamRow[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<MarkingAttemptRow[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetailResponse | null>(null);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [loadingAttemptDetail, setLoadingAttemptDetail] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [clearingAttempt, setClearingAttempt] = useState(false);
  const [forcingSubmit, setForcingSubmit] = useState(false);
  const [extendingTime, setExtendingTime] = useState(false);
  const [scoreForms, setScoreForms] = useState<Record<number, ScoreFormState>>({});
  const [clearReason, setClearReason] = useState('');
  const [adminOverrideClear, setAdminOverrideClear] = useState(false);

  const selectedExam = useMemo(() => exams.find((exam) => exam.id === selectedExamId) || null, [exams, selectedExamId]);

  const roleNames = useMemo(() => (
    (user?.roles || [])
      .map((role: any) => String(role?.name || role || '').trim().toLowerCase())
      .filter(Boolean)
  ), [user]);

  const isAdmin = useMemo(() => (
    roleNames.includes('admin') || roleNames.includes('main admin')
  ), [roleNames]);

  const isTeacherOnly = useMemo(() => (
    roleNames.includes('teacher') && !isAdmin
  ), [isAdmin, roleNames]);

  const canClearAttempt = useMemo(() => {
    return !isTeacherOnly;
  }, [isTeacherOnly]);

  const canModerateAttempt = useMemo(() => isAdmin, [isAdmin]);

  const loadExams = async () => {
    try {
      setLoadingExams(true);
      const response = await api.get('/marking/exams');
      const rows: MarkingExamRow[] = response.data?.data || [];
      setExams(rows);
      if (!selectedExamId && rows.length > 0) {
        setSelectedExamId(rows[0].id);
      }
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to load marking exams');
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  };

  const loadAttempts = async (examId: number) => {
    try {
      setLoadingAttempts(true);
      const response = await api.get(`/marking/exams/${examId}/attempts`);
      const rows: MarkingAttemptRow[] = response.data?.data || [];
      setAttempts(rows);
      if (rows.length > 0) {
        setSelectedAttemptId(rows[0].id);
      } else {
        setSelectedAttemptId(null);
        setAttemptDetail(null);
      }
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to load attempts');
      setAttempts([]);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const loadAttemptDetail = async (attemptId: number) => {
    try {
      setLoadingAttemptDetail(true);
      const response = await api.get(`/marking/attempts/${attemptId}`);
      const payload: AttemptDetailResponse = response.data;
      setAttemptDetail(payload);

      const nextForms: Record<number, ScoreFormState> = {};
      payload.questions.forEach((question) => {
        nextForms[question.question_id] = {
          marks: question.answer.marks_awarded?.toString() || '',
          feedback: question.answer.feedback || '',
        };
      });
      setScoreForms(nextForms);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to load attempt details');
      setAttemptDetail(null);
    } finally {
      setLoadingAttemptDetail(false);
    }
  };

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadAttempts(selectedExamId);
    }
  }, [selectedExamId]);

  useEffect(() => {
    if (selectedAttemptId) {
      loadAttemptDetail(selectedAttemptId);
    }
  }, [selectedAttemptId]);

  const updateForm = (questionId: number, updates: Partial<ScoreFormState>) => {
    setScoreForms((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ...updates,
      },
    }));
  };

  const collectManualScores = (requireAll: boolean) => {
    if (!attemptDetail) return null;

    const manualQuestions = attemptDetail.questions.filter((question) => question.requires_manual_marking);

    const missingQuestionNumbers: number[] = [];
    const invalidQuestionNumbers: number[] = [];

    const scores = manualQuestions
      .map((question, index) => {
        const form = scoreForms[question.question_id] || { marks: '', feedback: '' };
        const rawMarks = String(form.marks ?? '').trim();
        const questionNumber = index + 1;

        if (rawMarks === '') {
          if (requireAll) {
            missingQuestionNumbers.push(questionNumber);
          }
          return null;
        }

        const marks = Number(rawMarks);
        if (Number.isNaN(marks) || marks < 0) {
          invalidQuestionNumbers.push(questionNumber);
          return null;
        }

        return {
          question_id: question.question_id,
          marks_awarded: marks,
          feedback: form.feedback || '',
        };
      })
      .filter(Boolean) as Array<{ question_id: number; marks_awarded: number; feedback?: string }>;

    if (missingQuestionNumbers.length > 0) {
      showError(`Enter marks for all pending manual answers before finalizing. Missing question numbers: ${missingQuestionNumbers.join(', ')}`);
      return null;
    }

    if (invalidQuestionNumbers.length > 0) {
      showError(`Some entered marks are invalid. Check question numbers: ${invalidQuestionNumbers.join(', ')}`);
      return null;
    }

    return scores;
  };

  const finalizeAttempt = async () => {
    if (!attemptDetail) return;

    if (String(attemptDetail.attempt.status).toLowerCase() === 'completed') {
      showError('Attempt is already finalized.');
      return;
    }

    const scores = collectManualScores(true);
    if (!scores) {
      return;
    }

    const shouldProceed = window.confirm('Are you sure? This will finalize and lock this attempt for marking.');
    if (!shouldProceed) return;

    try {
      setFinalizing(true);
      await api.post(`/marking/attempts/${attemptDetail.attempt.id}/finalize`, {
        scores,
      });
      showSuccess('All scores saved and attempt finalized successfully');
      await loadAttemptDetail(attemptDetail.attempt.id);
      if (selectedExamId) await loadAttempts(selectedExamId);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Unable to finalize attempt');
    } finally {
      setFinalizing(false);
    }
  };

  const saveDraftScores = async () => {
    if (!attemptDetail) return;

    if (String(attemptDetail.attempt.status).toLowerCase() === 'completed') {
      showError('Attempt is already finalized.');
      return;
    }

    const scores = collectManualScores(false);
    if (!scores || scores.length === 0) {
      showError('Enter at least one valid manual score before saving draft.');
      return;
    }

    try {
      setSavingDraft(true);
      await api.post(`/marking/attempts/${attemptDetail.attempt.id}/bulk-score`, {
        scores,
      });
      showSuccess('Draft scores saved successfully');
      await loadAttemptDetail(attemptDetail.attempt.id);
      if (selectedExamId) await loadAttempts(selectedExamId);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Unable to save draft scores');
    } finally {
      setSavingDraft(false);
    }
  };

  const forceSubmitAttempt = async () => {
    if (!attemptDetail || !selectedExamId) return;

    if (isForceSubmitLockedStatus(attemptDetail.attempt.status)) {
      showError('Attempt is already submitted/finalized. Force submit is not available.');
      return;
    }

    const reason = window.prompt('Enter reason for force submit:');
    if (!reason || !reason.trim()) {
      showError('Reason is required to force submit.');
      return;
    }

    const shouldProceed = window.confirm(
      `Force submit attempt ${attemptDetail.attempt.id} for ${attemptDetail.attempt.student.name}?`
    );
    if (!shouldProceed) return;

    try {
      setForcingSubmit(true);
      await api.post(`/marking/attempts/${attemptDetail.attempt.id}/force-submit`, {
        reason: reason.trim(),
      });
      showSuccess('Attempt force-submitted successfully.');
      await loadAttemptDetail(attemptDetail.attempt.id);
      await loadAttempts(selectedExamId);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to force submit attempt');
    } finally {
      setForcingSubmit(false);
    }
  };

  const extendAttemptTime = async () => {
    if (!attemptDetail || !selectedExamId) return;

    const minutesRaw = window.prompt('Enter extra time in minutes (1-180):', '5');
    if (!minutesRaw) return;

    const minutes = Number(minutesRaw);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
      showError('Minutes must be a whole number between 1 and 180.');
      return;
    }

    const reason = window.prompt('Enter reason for time extension:');
    if (!reason || !reason.trim()) {
      showError('Reason is required to extend time.');
      return;
    }

    const shouldProceed = window.confirm(
      `Extend attempt ${attemptDetail.attempt.id} by ${minutes} minute(s)?`
    );
    if (!shouldProceed) return;

    try {
      setExtendingTime(true);
      await api.post(`/marking/attempts/${attemptDetail.attempt.id}/extend-time`, {
        minutes,
        reason: reason.trim(),
      });
      showSuccess(`Extended attempt by ${minutes} minute(s).`);
      await loadAttemptDetail(attemptDetail.attempt.id);
      await loadAttempts(selectedExamId);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to extend time');
    } finally {
      setExtendingTime(false);
    }
  };

  const clearAttempt = async () => {
    if (!attemptDetail || !selectedExamId) return;

    if (!canClearAttempt) {
      showError('Teachers are not allowed to clear attempts.');
      return;
    }

    const isFinalized = String(attemptDetail.attempt.status).toLowerCase() === 'completed';
    if (isFinalized && !adminOverrideClear) {
      showError('Finalized attempts require Admin Override to clear.');
      return;
    }

    if (!adminOverrideClear && !clearReason.trim()) {
      showError('Provide a reason before clearing this attempt.');
      return;
    }

    const reasonText = clearReason.trim();
    const reasonNote = reasonText ? ` Reason: ${reasonText}.` : ' No reason provided (Admin Override).';

    const shouldProceed = window.confirm(
      `Clear attempt ${attemptDetail.attempt.id} for ${attemptDetail.attempt.student.name}?${reasonNote} This will remove answers and allow a fresh restart.`
    );
    if (!shouldProceed) return;

    try {
      setClearingAttempt(true);
      await api.delete(`/marking/attempts/${attemptDetail.attempt.id}`, {
        data: {
          reason: reasonText,
          admin_override: adminOverrideClear,
        },
      });
      showSuccess('Attempt cleared. Student can restart the exam.');
      setClearReason('');
      setAdminOverrideClear(false);
      setSelectedAttemptId(null);
      setAttemptDetail(null);
      await loadAttempts(selectedExamId);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to clear attempt');
    } finally {
      setClearingAttempt(false);
    }
  };

  const selectedAttempt = useMemo(
    () => attempts.find((attempt) => attempt.id === selectedAttemptId) || null,
    [attempts, selectedAttemptId]
  );

  const scoreSummary = useMemo(() => {
    if (!attemptDetail) {
      return {
        objectiveScore: 0,
        objectiveTotal: 0,
        manualScore: 0,
        manualTotal: 0,
        totalScore: 0,
        totalMarks: 0,
        percentage: 0,
        grade: 'F9',
        manualMarked: 0,
        manualTotalQuestions: 0,
        manualPending: 0,
      };
    }

    const objectiveQuestions = attemptDetail.questions.filter((q) => !q.requires_manual_marking);
    const manualQuestions = attemptDetail.questions.filter((q) => q.requires_manual_marking);
    const objectiveScore = objectiveQuestions.reduce((sum, q) => sum + Number(q.answer.marks_awarded ?? 0), 0);
    const objectiveTotal = objectiveQuestions.reduce((sum, q) => sum + Number(q.marks ?? 0), 0);
    const manualScore = manualQuestions.reduce((sum, q) => sum + Number(q.answer.marks_awarded ?? 0), 0);
    const manualTotal = manualQuestions.reduce((sum, q) => sum + Number(q.marks ?? 0), 0);
    const totalScore = objectiveScore + manualScore;
    const totalMarks = objectiveTotal + manualTotal;
    const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
    const manualMarked = manualQuestions.filter((q) => q.answer.marks_awarded !== null && q.answer.marks_awarded !== undefined).length;
    const manualPending = manualQuestions.filter((q) => hasCandidateResponse(q) && (q.answer.marks_awarded === null || q.answer.marks_awarded === undefined)).length;

    return {
      objectiveScore,
      objectiveTotal,
      manualScore,
      manualTotal,
      totalScore,
      totalMarks,
      percentage,
      grade: gradeBand(percentage),
      manualMarked,
      manualTotalQuestions: manualQuestions.length,
      manualPending,
    };
  }, [attemptDetail]);

  return (
    <div className="app-shell py-6 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Marking Workbench</h1>
          <p className="text-sm text-gray-600 mt-1">Dedicated interface for manual scoring and finalizing attempts.</p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="text-xs text-gray-600">
            {selectedExam ? `${selectedExam.title} • Pending ${selectedExam.pending_marking}` : 'Select an exam to begin marking'}
          </div>
          <Link
            to="/admin/results"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Results
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-2">Exam</label>
            <select
              value={selectedExamId || ''}
              onChange={(e) => setSelectedExamId(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.pending_marking} pending)
                </option>
              ))}
            </select>
          </div>

          {loadingExams && <p className="text-sm text-gray-500">Loading exams...</p>}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase text-gray-600">
              Attempts ({attempts.length})
            </div>
            <div className="max-h-[620px] overflow-auto">
              {loadingAttempts ? (
                <p className="p-4 text-sm text-gray-500">Loading attempts...</p>
              ) : attempts.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No attempts found for selected exam.</p>
              ) : (
                attempts.map((attempt) => (
                  <button
                    key={attempt.id}
                    onClick={() => setSelectedAttemptId(attempt.id)}
                    className={`w-full border-b border-gray-200 p-3 text-left hover:bg-gray-50 transition ${selectedAttemptId === attempt.id ? 'bg-blue-50' : 'bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{attempt.student.name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{attempt.student.registration_number || 'No Reg'} • Pending {attempt.pending_manual_count}</p>
                        <p className="text-[11px] text-gray-600 mt-1">
                          Score {Number(attempt.score ?? 0).toFixed(1)}/{Number(attempt.total_marks ?? 0).toFixed(1)}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Tab warnings {attempt.security_summary?.tab_warning_count ?? 0} • Session switches {attempt.security_summary?.session_replace_count ?? 0}
                        </p>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${statusBadge(attempt.status)}`}>
                        {attempt.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          {!attemptDetail ? (
            <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-gray-500">
              {loadingAttemptDetail ? 'Loading attempt details...' : 'Select an attempt to start marking.'}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-3 border-b border-gray-200">
                <div>
                  <p className="text-sm text-gray-600">Attempt {attemptDetail.attempt.id}</p>
                  <h2 className="text-lg font-bold text-gray-900">{attemptDetail.attempt.student.name}</h2>
                  <p className="text-xs text-gray-600">
                    {attemptDetail.attempt.student.registration_number || 'No Reg'} • Manual marked: {scoreSummary.manualMarked}/{scoreSummary.manualTotalQuestions} • Pending manual: {scoreSummary.manualPending}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${statusBadge(attemptDetail.attempt.status)}`}>
                    {attemptDetail.attempt.status}
                  </span>
                  {canModerateAttempt && (
                    <>
                      <button
                        onClick={forceSubmitAttempt}
                        disabled={forcingSubmit || isForceSubmitLockedStatus(attemptDetail.attempt.status)}
                        className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
                      >
                        {forcingSubmit ? 'Submitting...' : 'Force Submit'}
                      </button>
                      <button
                        onClick={extendAttemptTime}
                        disabled={extendingTime}
                        className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                      >
                        {extendingTime ? 'Extending...' : 'Extend Time'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={saveDraftScores}
                    disabled={savingDraft || String(attemptDetail.attempt.status).toLowerCase() === 'completed'}
                    className="px-3 py-1.5 rounded-md bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingDraft ? 'Saving Draft...' : 'Save Draft Scores'}
                  </button>
                  <button
                    onClick={finalizeAttempt}
                    disabled={finalizing || String(attemptDetail.attempt.status).toLowerCase() === 'completed'}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {finalizing ? 'Finalizing...' : 'Finalize Marking'}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[11px] text-emerald-700 uppercase font-semibold">Objective Score</p>
                  <p className="text-lg font-bold text-emerald-800">{scoreSummary.objectiveScore.toFixed(1)}/{scoreSummary.objectiveTotal.toFixed(1)}</p>
                </div>
                <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
                  <p className="text-[11px] text-sky-700 uppercase font-semibold">Manual Score</p>
                  <p className="text-lg font-bold text-sky-800">{scoreSummary.manualScore.toFixed(1)}/{scoreSummary.manualTotal.toFixed(1)}</p>
                </div>
                <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-[11px] text-indigo-700 uppercase font-semibold">Total Score</p>
                  <p className="text-lg font-bold text-indigo-800">{scoreSummary.totalScore.toFixed(1)}/{scoreSummary.totalMarks.toFixed(1)}</p>
                </div>
                <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
                  <p className="text-[11px] text-violet-700 uppercase font-semibold">Percentage</p>
                  <p className="text-lg font-bold text-violet-800">{scoreSummary.percentage.toFixed(1)}%</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-3">
                  <p className="text-[11px] text-gray-600 uppercase font-semibold">Grade</p>
                  <p className="text-lg font-bold text-gray-900">{selectedAttempt?.status === 'completed' ? selectedAttempt?.grade || scoreSummary.grade : scoreSummary.grade}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[11px] text-amber-700 uppercase font-semibold">Tab Warnings</p>
                  <p className="text-lg font-bold text-amber-800">{attemptDetail.attempt.security_summary?.tab_warning_count ?? 0}</p>
                </div>
                <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-[11px] text-indigo-700 uppercase font-semibold">Session Switches</p>
                  <p className="text-lg font-bold text-indigo-800">{attemptDetail.attempt.security_summary?.session_replace_count ?? 0}</p>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-[11px] text-red-700 uppercase font-semibold">Blocked Actions</p>
                  <p className="text-lg font-bold text-red-800">{attemptDetail.attempt.security_summary?.blocked_action_count ?? 0}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-700 uppercase font-semibold">Security Events</p>
                  <p className="text-lg font-bold text-slate-800">{attemptDetail.attempt.security_summary?.total_events ?? 0}</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-3">
                  <p className="text-[11px] text-gray-600 uppercase font-semibold">Last Violation</p>
                  <p className="text-xs font-semibold text-gray-900 mt-1">
                    {formatEventDate(attemptDetail.attempt.security_summary?.last_violation_at)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase text-gray-500 font-semibold">Security Risk Level</p>
                  <p className="text-xs text-gray-600 mt-1">Derived from tab warnings, blocked actions, and session switches.</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${riskLevel(attemptDetail.attempt.security_summary).className}`}>
                  {riskLevel(attemptDetail.attempt.security_summary).label}
                </span>
              </div>

              {canClearAttempt && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-red-800">Danger Zone: Clear Attempt</h3>
                    <label className="text-xs text-red-700 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={adminOverrideClear}
                        onChange={(e) => setAdminOverrideClear(e.target.checked)}
                      />
                      Admin Override
                    </label>
                  </div>
                  <input
                    value={clearReason}
                    onChange={(e) => setClearReason(e.target.value)}
                    placeholder="Reason for clearing this attempt"
                    className="w-full border border-red-300 rounded-md px-3 py-2 text-sm bg-white"
                  />
                  <button
                    onClick={clearAttempt}
                    disabled={clearingAttempt || (String(attemptDetail.attempt.status).toLowerCase() === 'completed' && !adminOverrideClear)}
                    className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
                  >
                    {clearingAttempt ? 'Clearing...' : 'Clear Attempt'}
                  </button>
                </div>
              )}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Recent Session & Security Events</h3>
                  <span className="text-[11px] text-gray-600">{attemptDetail.recent_events?.length || 0} events</span>
                </div>
                {(!attemptDetail.recent_events || attemptDetail.recent_events.length === 0) ? (
                  <p className="text-xs text-gray-500 mt-2">No events captured for this attempt yet.</p>
                ) : (
                  <div className="mt-2 max-h-44 overflow-auto space-y-1">
                    {attemptDetail.recent_events.map((event, index) => (
                      <div key={`${event.event_type}-${event.created_at}-${index}`} className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-800">{formatEventLabel(event.event_type)}</span>
                          <span className="text-gray-500">{formatEventDate(event.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-[720px] overflow-auto pr-1">
                {attemptDetail.questions.map((question, idx) => {
                  const form = scoreForms[question.question_id] || { marks: '', feedback: '' };
                  const selectedOptionIds = Array.from(new Set([
                    ...(typeof question.answer.option_id === 'number' ? [question.answer.option_id] : []),
                    ...(question.answer.option_ids || []),
                  ]));
                  const studentText = normalizeStudentText(question.answer.answer_text);
                  const selectedOptionText = question.options
                    .filter((option) => selectedOptionIds.includes(option.id))
                    .map((option) => option.option_text)
                    .join(', ');
                  const correctOptionText = question.options
                    .filter((option) => question.correct_option_ids.includes(option.id))
                    .map((option) => option.option_text)
                    .join(', ');

                  return (
                    <article key={question.question_id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">Q{idx + 1}. {question.question_text}</p>
                        <span className="text-[11px] px-2 py-1 bg-gray-100 text-gray-700 rounded">{question.marks} marks</span>
                      </div>

                      <div className="mt-2 text-xs text-gray-700 space-y-1">
                        <p><span className="font-semibold">Type:</span> {question.question_type}</p>
                        {selectedOptionText && <p><span className="font-semibold">Student Answer:</span> {selectedOptionText}</p>}
                        {studentText && <p><span className="font-semibold">Student Text:</span> {studentText}</p>}
                        {correctOptionText && <p><span className="font-semibold">Correct:</span> {correctOptionText}</p>}
                        {question.answer.flagged && <p className="text-amber-700 font-semibold">Flagged by student for review</p>}
                      </div>

                      {question.requires_manual_marking ? (
                        <div className="mt-3 border-t border-gray-200 pt-3 grid gap-2 md:grid-cols-[180px_minmax(0,1fr)]">
                          <input
                            type="number"
                            min={0}
                            max={question.marks}
                            step="0.5"
                            value={form.marks}
                            onChange={(e) => updateForm(question.question_id, { marks: e.target.value })}
                            placeholder={`0 - ${question.marks}`}
                            disabled={String(attemptDetail.attempt.status).toLowerCase() === 'completed'}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                          <input
                            value={form.feedback}
                            onChange={(e) => updateForm(question.question_id, { feedback: e.target.value })}
                            placeholder="Feedback (optional)"
                            disabled={String(attemptDetail.attempt.status).toLowerCase() === 'completed'}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-emerald-700 font-semibold">
                          Objective question: score is auto-computed.
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MarkingWorkbench;

