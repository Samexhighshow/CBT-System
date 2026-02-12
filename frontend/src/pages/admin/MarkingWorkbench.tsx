import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';

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
  saving: boolean;
}

const statusBadge = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'submitted') return 'bg-amber-100 text-amber-800';
  if (normalized === 'in_progress') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-700';
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

const MarkingWorkbench: React.FC = () => {
  const [exams, setExams] = useState<MarkingExamRow[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<MarkingAttemptRow[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetailResponse | null>(null);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [loadingAttemptDetail, setLoadingAttemptDetail] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [scoreForms, setScoreForms] = useState<Record<number, ScoreFormState>>({});

  const selectedExam = useMemo(() => exams.find((exam) => exam.id === selectedExamId) || null, [exams, selectedExamId]);

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
          saving: false,
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

  const saveScore = async (question: AttemptQuestion) => {
    if (!attemptDetail) return;

    const form = scoreForms[question.question_id];
    if (!form) return;

    const parsedMarks = Number(form.marks);
    if (Number.isNaN(parsedMarks) || parsedMarks < 0) {
      showError('Enter a valid mark before saving');
      return;
    }

    try {
      updateForm(question.question_id, { saving: true });
      await api.post(`/marking/attempts/${attemptDetail.attempt.id}/questions/${question.question_id}/score`, {
        marks_awarded: parsedMarks,
        feedback: form.feedback,
      });
      showSuccess('Question score updated');
      await loadAttemptDetail(attemptDetail.attempt.id);
      if (selectedExamId) await loadAttempts(selectedExamId);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to save score');
    } finally {
      updateForm(question.question_id, { saving: false });
    }
  };

  const finalizeAttempt = async () => {
    if (!attemptDetail) return;

    try {
      setFinalizing(true);
      await api.post(`/marking/attempts/${attemptDetail.attempt.id}/finalize`);
      showSuccess('Attempt finalized successfully');
      await loadAttemptDetail(attemptDetail.attempt.id);
      if (selectedExamId) await loadAttempts(selectedExamId);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Unable to finalize attempt');
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="app-shell py-6 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Marking Workbench</h1>
          <p className="text-sm text-gray-600 mt-1">Dedicated interface for manual scoring and finalizing attempts.</p>
        </div>
        <div className="text-xs text-gray-600">
          {selectedExam ? `${selectedExam.title} • Pending ${selectedExam.pending_marking}` : 'Select an exam to begin marking'}
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
                  <p className="text-sm text-gray-600">Attempt #{attemptDetail.attempt.id}</p>
                  <h2 className="text-lg font-bold text-gray-900">{attemptDetail.attempt.student.name}</h2>
                  <p className="text-xs text-gray-600">{attemptDetail.attempt.student.registration_number || 'No Reg'} • Pending manual: {attemptDetail.attempt.pending_manual_count}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${statusBadge(attemptDetail.attempt.status)}`}>
                    {attemptDetail.attempt.status}
                  </span>
                  <button
                    onClick={finalizeAttempt}
                    disabled={finalizing}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {finalizing ? 'Finalizing...' : 'Finalize Marking'}
                  </button>
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
                  const form = scoreForms[question.question_id] || { marks: '', feedback: '', saving: false };
                  const selectedOptionText = question.options.find((option) => option.id === question.answer.option_id)?.option_text;
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
                        {question.answer.answer_text && <p><span className="font-semibold">Student Text:</span> {question.answer.answer_text}</p>}
                        {correctOptionText && <p><span className="font-semibold">Correct:</span> {correctOptionText}</p>}
                        {question.answer.flagged && <p className="text-amber-700 font-semibold">Flagged by student for review</p>}
                      </div>

                      {question.requires_manual_marking ? (
                        <div className="mt-3 border-t border-gray-200 pt-3 grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                          <input
                            type="number"
                            min={0}
                            max={question.marks}
                            step="0.5"
                            value={form.marks}
                            onChange={(e) => updateForm(question.question_id, { marks: e.target.value })}
                            placeholder={`0 - ${question.marks}`}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                          <input
                            value={form.feedback}
                            onChange={(e) => updateForm(question.question_id, { feedback: e.target.value })}
                            placeholder="Feedback (optional)"
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => saveScore(question)}
                            disabled={form.saving}
                            className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                          >
                            {form.saving ? 'Saving...' : 'Save'}
                          </button>
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

