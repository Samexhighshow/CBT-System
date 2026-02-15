import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cbtApi } from '../services/cbtApi';
import { clearStoredSession, loadStoredSession } from '../services/sessionStore';
import { CbtAttemptState, CbtQuestion } from '../types';
import { cbtFontFamily, cbtTheme } from '../theme';

type AutoSaveState = 'Saved' | 'Saving...' | 'Save failed';
type AnswerValue = {
  optionId?: number;
  optionIds?: number[];
  answerText?: string;
};

const TAB_WARNING_EVENT_TYPES = ['tab_hidden', 'window_blur', 'fullscreen_exited'] as const;

const normalizeQuestionType = (raw?: string): string => {
  const value = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (value === 'essay' || value === 'longanswer') return 'long_answer';
  if (value === 'shortanswer') return 'short_answer';
  if (value === 'multiple_choice_single' || value === 'mcq') return 'multiple_choice';
  if (value === 'multiple_choice_multiple') return 'multiple_select';
  return value;
};

const isMultiSelectType = (type: string): boolean => type === 'multiple_select';
const isSingleChoiceType = (type: string): boolean => ['multiple_choice', 'true_false'].includes(type);
const isTextType = (type: string): boolean => [
  'short_answer',
  'long_answer',
  'fill_blank',
  'calculation',
  'practical',
  'passage',
  'case_study',
  'file_upload',
  'matching',
  'ordering',
].includes(type);

const hasAnswerValue = (value?: AnswerValue, type?: string): boolean => {
  if (!value) return false;
  const normalizedType = normalizeQuestionType(type);
  if (isMultiSelectType(normalizedType)) return (value.optionIds?.length || 0) > 0;
  if (isSingleChoiceType(normalizedType)) return typeof value.optionId === 'number' || (value.answerText || '').trim() !== '';
  return (value.answerText || '').trim() !== '';
};

const formatDuration = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const CbtExamSession: React.FC = () => {
  const navigate = useNavigate();
  const { attemptId: attemptIdParam } = useParams<{ attemptId: string }>();

  const attemptId = Number(attemptIdParam || 0);
  const storedSession = attemptId > 0 ? loadStoredSession(attemptId) : null;
  const sessionToken = storedSession?.sessionToken || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptState, setAttemptState] = useState<CbtAttemptState | null>(null);
  const [questions, setQuestions] = useState<CbtQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue | undefined>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveState>('Saved');
  const [connectionStatus, setConnectionStatus] = useState<'Connected' | 'Reconnecting...'>('Connected');
  const [submitting, setSubmitting] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  const [tabWarningCount, setTabWarningCount] = useState(0);
  const [tabWarningLimit, setTabWarningLimit] = useState(3);
  const [tabFencingAlert, setTabFencingAlert] = useState<string | null>(null);
  const [showInstructionsMobile, setShowInstructionsMobile] = useState(false);
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startingAttempt, setStartingAttempt] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);

  const eventThrottleRef = useRef<Record<string, number>>({});
  const sessionResumeLoggedRef = useRef(false);
  const textAutosaveTimersRef = useRef<Record<number, number>>({});

  useEffect(() => {
    sessionResumeLoggedRef.current = false;
  }, [attemptId]);

  useEffect(() => {
    return () => {
      Object.values(textAutosaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      textAutosaveTimersRef.current = {};
    };
  }, []);

  const handleAttemptClosed = useCallback((message: string) => {
    clearStoredSession(attemptId);
    window.alert(message);
    navigate('/cbt');
  }, [attemptId, navigate]);

  const logAttemptEvent = useCallback(async (
    eventType: string,
    meta: Record<string, unknown> = {},
    options?: { throttleMs?: number; warningAlert?: string; countAsWarning?: boolean }
  ) => {
    if (!attemptId || !sessionToken) return;

    const throttleMs = options?.throttleMs ?? 0;
    if (throttleMs > 0) {
      const lastLoggedAt = eventThrottleRef.current[eventType] || 0;
      const now = Date.now();
      if (now - lastLoggedAt < throttleMs) {
        return;
      }
      eventThrottleRef.current[eventType] = now;
    }

    if (options?.countAsWarning) {
      setTabWarningCount((prev) => prev + 1);
    }

    if (options?.warningAlert) {
      setTabFencingAlert(options.warningAlert);
    }

    try {
      const response = await cbtApi.logAttemptEvent(attemptId, sessionToken, {
        event_type: eventType,
        meta,
      });

      if (response && TAB_WARNING_EVENT_TYPES.includes(response.event_type as (typeof TAB_WARNING_EVENT_TYPES)[number])) {
        setTabWarningCount(response.tab_warning_count);
        if (response.tab_warning_limit) {
          setTabWarningLimit(response.tab_warning_limit);
        }
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'auto_submitted_tab_fencing') {
        handleAttemptClosed('Tab-fencing limit reached. Your attempt has been auto-submitted.');
        return;
      }
      if (code === 'attempt_submitted') {
        handleAttemptClosed('This attempt is already submitted.');
      }
    }
  }, [attemptId, handleAttemptClosed, sessionToken]);

  const hydrateAttempt = useCallback(async () => {
    if (!attemptId || !sessionToken) {
      setError('Session not found. Return to the portal and login again.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [stateData, questionData] = await Promise.all([
        cbtApi.getAttemptState(attemptId, sessionToken),
        cbtApi.getAttemptQuestions(attemptId, sessionToken),
      ]);

      setAttemptState(stateData);
      setQuestions(questionData);
      setRemainingSeconds(stateData.remaining_seconds || 0);
      setTabWarningCount(stateData.tab_warning_count || 0);
      setTabWarningLimit(stateData.tab_warning_limit || 3);
      setShowStartModal(stateData.status !== 'in_progress');
      setShowReview(false);

      const answerMap: Record<number, AnswerValue | undefined> = {};
      const flagMap: Record<number, boolean> = {};
      const questionTypeById = new Map<number, string>(
        questionData.map((question) => [question.id, normalizeQuestionType(question.question_type)])
      );
      stateData.answers.forEach((answer) => {
        const next: AnswerValue = {};
        const normalizedType = questionTypeById.get(answer.question_id) || '';
        if (typeof answer.option_id === 'number') {
          next.optionId = answer.option_id;
        }
        if (Array.isArray(answer.option_ids) && answer.option_ids.length > 0) {
          if (isMultiSelectType(normalizedType)) {
            next.optionIds = answer.option_ids;
          } else if (typeof next.optionId !== 'number') {
            // For bank-backed single-choice questions, backend stores selected id in option_ids JSON.
            next.optionId = answer.option_ids[0];
          }
        }
        if ((answer.answer_text || '').trim() !== '') {
          next.answerText = answer.answer_text || '';
        }
        if (hasAnswerValue(next)) {
          answerMap[answer.question_id] = next;
        }
        if (answer.flagged) {
          flagMap[answer.question_id] = true;
        }
      });

      setAnswers(answerMap);
      setFlagged(flagMap);
      const firstUnansweredIndex = questionData.findIndex((question) => !hasAnswerValue(answerMap[question.id], question.question_type));
      setCurrentIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'session_revoked') {
        setSessionRevoked(true);
      } else if (code === 'auto_submitted_tab_fencing' || code === 'attempt_submitted') {
        clearStoredSession(attemptId);
        navigate('/cbt');
        return;
      }
      setError(err?.response?.data?.message || 'Failed to load exam session.');
    } finally {
      setLoading(false);
    }
  }, [attemptId, navigate, sessionToken]);

  useEffect(() => {
    hydrateAttempt();
  }, [hydrateAttempt]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress') return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [attemptState]);

  useEffect(() => {
    if (
      !attemptState ||
      attemptState.status !== 'in_progress' ||
      remainingSeconds > 0 ||
      submitting ||
      attemptState.status === 'submitted' ||
      attemptState.status === 'completed'
    ) {
      return;
    }

    const autoSubmit = async () => {
      try {
        setSubmitting(true);
        await cbtApi.submitAttempt(attemptId, sessionToken);
        clearStoredSession(attemptId);
        navigate('/cbt');
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Auto-submit failed. Contact invigilator.');
      } finally {
        setSubmitting(false);
      }
    };

    autoSubmit();
  }, [attemptId, attemptState, navigate, remainingSeconds, sessionToken, submitting]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress' || sessionResumeLoggedRef.current) return;
    sessionResumeLoggedRef.current = true;
    logAttemptEvent('session_resumed', { source: 'cbt_exam_session' }, { throttleMs: 1000 });
  }, [attemptState, logAttemptEvent]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress' || !sessionToken) return;

    const interval = window.setInterval(async () => {
      try {
        const ping = await cbtApi.pingAttempt(attemptId, sessionToken);
        setConnectionStatus('Connected');
        if (typeof ping.remaining_seconds === 'number') {
          setRemainingSeconds((prev) => Math.min(prev, ping.remaining_seconds));
        }
      } catch (err: any) {
        const code = err?.response?.data?.code;
        if (code === 'session_revoked') {
          setSessionRevoked(true);
          return;
        }
        if (code === 'auto_submitted_tab_fencing') {
          handleAttemptClosed('Tab-fencing limit reached. Your attempt has been auto-submitted.');
          return;
        }
        if (code === 'attempt_submitted') {
          handleAttemptClosed('This attempt is already submitted.');
          return;
        }
        setConnectionStatus('Reconnecting...');
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [attemptId, attemptState, handleAttemptClosed, sessionToken]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress') return;

    const onOnline = () => {
      setConnectionStatus('Connected');
      logAttemptEvent('connection_restored', { online: true }, { throttleMs: 1500 });
    };

    const onOffline = () => {
      setConnectionStatus('Reconnecting...');
      logAttemptEvent('connection_lost', { online: false }, { throttleMs: 1500 });
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [attemptState, logAttemptEvent]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress' || !sessionToken) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        logAttemptEvent(
          'tab_hidden',
          { visibility_state: document.visibilityState },
          { throttleMs: 2000, warningAlert: 'Tab switch detected. Stay on the exam screen.', countAsWarning: true }
        );
        return;
      }
      logAttemptEvent('tab_visible', { visibility_state: document.visibilityState }, { throttleMs: 2000 });
    };

    const onWindowBlur = () => {
      logAttemptEvent(
        'window_blur',
        { reason: 'window_blur' },
        { throttleMs: 2000, warningAlert: 'Focus lost. Return to the exam window.', countAsWarning: true }
      );
    };

    const onWindowFocus = () => {
      logAttemptEvent('window_focus', { reason: 'window_focus' }, { throttleMs: 2000 });
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      logAttemptEvent('context_menu_blocked', { action: 'context_menu' }, { throttleMs: 2000 });
      setTabFencingAlert('Right-click is disabled during the exam.');
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blocked =
        key === 'f12' ||
        (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (event.ctrlKey && ['u', 'p'].includes(key));

      if (!blocked) return;

      event.preventDefault();
      logAttemptEvent(
        'keyboard_shortcut_blocked',
        {
          key: event.key,
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        },
        { throttleMs: 800 }
      );
      setTabFencingAlert('Developer and print shortcuts are blocked.');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [attemptState, logAttemptEvent, sessionToken]);

  useEffect(() => {
    if (!tabFencingAlert) return;
    const timer = window.setTimeout(() => setTabFencingAlert(null), 2800);
    return () => window.clearTimeout(timer);
  }, [tabFencingAlert]);

  const orderedQuestionIds = useMemo(() => questions.map((question) => question.id), [questions]);
  const currentQuestion = questions[currentIndex] || null;

  const answeredCount = useMemo(
    () => orderedQuestionIds.filter((id) => {
      const questionType = questions.find((q) => q.id === id)?.question_type;
      return hasAnswerValue(answers[id], questionType);
    }).length,
    [answers, orderedQuestionIds, questions]
  );

  const flaggedCount = useMemo(
    () => orderedQuestionIds.filter((id) => !!flagged[id]).length,
    [flagged, orderedQuestionIds]
  );

  const unansweredCount = Math.max(0, questions.length - answeredCount);

  const persistAnswer = async (questionId: number, value?: AnswerValue, forceFlag?: boolean) => {
    if (!sessionToken || !attemptState || attemptState.status !== 'in_progress') return;

    try {
      setAutoSaveStatus('Saving...');
      const payload: { question_id: number; option_id?: number; option_ids?: number[]; answer_text?: string; flagged?: boolean } = {
        question_id: questionId,
        flagged: forceFlag ?? flagged[questionId] ?? false,
      };

      if (typeof value?.optionId === 'number') {
        payload.option_id = value.optionId;
      }
      if (Array.isArray(value?.optionIds)) {
        payload.option_ids = value.optionIds;
      }
      if (typeof value?.answerText === 'string') {
        payload.answer_text = value.answerText;
      }

      await cbtApi.saveAnswer(attemptId, sessionToken, payload);
      setAutoSaveStatus('Saved');

      await logAttemptEvent(forceFlag === undefined ? 'answer_saved' : 'flag_toggled', {
        question_id: questionId,
        has_option: typeof value?.optionId === 'number' || (value?.optionIds?.length || 0) > 0,
        has_text: (value?.answerText || '').trim() !== '',
        flagged: forceFlag ?? flagged[questionId] ?? false,
      });
    } catch (err: any) {
      setAutoSaveStatus('Save failed');
      const message = err?.response?.data?.message || 'Unable to save answer. Retry or notify invigilator.';
      setTabFencingAlert(message);
    }
  };

  const handleSelectAnswer = async (questionId: number, optionId: number) => {
    const nextValue: AnswerValue = { optionId };
    setAnswers((prev) => ({ ...prev, [questionId]: nextValue }));
    await persistAnswer(questionId, nextValue);
  };

  const handleToggleMultiSelectAnswer = async (questionId: number, optionId: number) => {
    const existing = answers[questionId];
    const current = new Set(existing?.optionIds || []);
    if (current.has(optionId)) {
      current.delete(optionId);
    } else {
      current.add(optionId);
    }
    const nextOptionIds = Array.from(current).sort((a, b) => a - b);
    const nextValue: AnswerValue = { optionIds: nextOptionIds };
    setAnswers((prev) => ({ ...prev, [questionId]: nextValue }));
    await persistAnswer(questionId, nextValue);
  };

  const handleTextAnswerChange = (questionId: number, answerText: string) => {
    const nextValue: AnswerValue = { answerText };
    setAnswers((prev) => ({ ...prev, [questionId]: nextValue }));

    if (textAutosaveTimersRef.current[questionId]) {
      window.clearTimeout(textAutosaveTimersRef.current[questionId]);
    }
    textAutosaveTimersRef.current[questionId] = window.setTimeout(() => {
      persistAnswer(questionId, nextValue);
    }, 650);
  };

  const flushTextAnswerSave = async (questionId: number) => {
    if (textAutosaveTimersRef.current[questionId]) {
      window.clearTimeout(textAutosaveTimersRef.current[questionId]);
      delete textAutosaveTimersRef.current[questionId];
    }
    await persistAnswer(questionId, answers[questionId]);
  };

  const handleTrueFalseTextAnswer = async (questionId: number, boolText: 'true' | 'false') => {
    const nextValue: AnswerValue = { answerText: boolText };
    setAnswers((prev) => ({ ...prev, [questionId]: nextValue }));
    await persistAnswer(questionId, nextValue);
  };

  const handleToggleFlag = async () => {
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;
    const nextFlag = !flagged[questionId];
    setFlagged((prev) => ({ ...prev, [questionId]: nextFlag }));
    await persistAnswer(questionId, answers[questionId], nextFlag);
  };

  const handleStartNow = async () => {
    if (!attemptState || !sessionToken || startingAttempt) return;

    try {
      setStartingAttempt(true);
      setError(null);
      const started = await cbtApi.startAttempt(attemptId, sessionToken);
      setAttemptState((prev) => (prev ? {
        ...prev,
        status: started.status,
        started_at: started.started_at || prev.started_at,
        ends_at: started.ends_at || prev.ends_at,
      } : prev));
      setRemainingSeconds(started.remaining_seconds);
      setShowStartModal(false);
      setConnectionStatus('Connected');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Unable to start attempt. Contact invigilator.';
      setError(message);
    } finally {
      setStartingAttempt(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!attemptState || attemptState.status !== 'in_progress' || submitting) return;

    try {
      setSubmitting(true);
      setAutoSaveStatus('Saving...');
      await cbtApi.submitAttempt(attemptId, sessionToken);
      setAutoSaveStatus('Saved');
      setShowReview(false);
      setShowSubmitSuccess(true);
      clearStoredSession(attemptId);
      window.setTimeout(() => navigate('/cbt'), 3500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Submit failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
        <p className="text-[15px]" style={{ color: cbtTheme.muted }}>
          Loading exam session...
        </p>
      </div>
    );
  }

  if (sessionRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
        <div className="w-full max-w-xl rounded-2xl border p-7 text-center" style={{ backgroundColor: cbtTheme.cardBg, borderColor: '#FECACA' }}>
          <h2 className="text-[28px] font-bold tracking-[-0.02em]" style={{ color: cbtTheme.danger }}>
            Session Revoked
          </h2>
          <p className="mt-2 text-[15px] leading-6" style={{ color: cbtTheme.muted }}>
            This session is active on another device.
          </p>
          <button
            type="button"
            onClick={() => navigate('/cbt')}
            className="mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: cbtTheme.primary }}
          >
            Back to Portal
          </button>
        </div>
      </div>
    );
  }

  if (error || !attemptState || !currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
        <div className="w-full max-w-xl rounded-2xl border p-7 text-center" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
          <h2 className="text-[24px] font-bold tracking-[-0.02em]" style={{ color: cbtTheme.title }}>
            Unable to continue exam
          </h2>
          <p className="mt-2 text-[15px] leading-6" style={{ color: cbtTheme.muted }}>
            {error || 'Exam data unavailable.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/cbt')}
            className="mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: cbtTheme.primary }}
          >
            Return to Portal
          </button>
        </div>
      </div>
    );
  }

  const currentQuestionId = currentQuestion.id;
  const currentQuestionType = normalizeQuestionType(currentQuestion.question_type);
  const currentAnswer = answers[currentQuestionId] || {};
  const currentSelectedOptionIds = currentAnswer.optionIds || [];
  const currentTextAnswer = currentAnswer.answerText || '';
  const isLastQuestion = currentIndex >= questions.length - 1;
  const currentFlagged = !!flagged[currentQuestionId];
  const studentInitials = (storedSession?.studentName || 'Student')
    .split(' ')
    .map((item) => item.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
      <header className="sticky top-0 z-30 border-b" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
        <div className="mx-auto w-full max-w-[1800px] px-4 py-3 md:px-6 md:py-4">
          <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: cbtTheme.primary }}
              >
                SC
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold md:text-base" style={{ color: cbtTheme.title }}>
                  {attemptState.exam.title}
                </p>
                <p className="text-xs leading-5" style={{ color: cbtTheme.muted }}>
                  {attemptState.exam.subject || 'General Subject'}
                </p>
              </div>
            </div>

            <div
              className={`rounded-xl px-4 py-2 text-sm font-bold tracking-[-0.01em] ${
                remainingSeconds < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'
              }`}
            >
              Time Left: {formatDuration(remainingSeconds)}
            </div>

            <div className="flex items-center gap-2 lg:justify-self-end">
              <div className="text-right">
                <p className="text-xs font-semibold leading-5" style={{ color: cbtTheme.title }}>
                  {storedSession?.registrationNumber || 'No Reg Number'}
                </p>
                <p className="text-[11px] leading-4" style={{ color: cbtTheme.muted }}>
                  Candidate
                </p>
              </div>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: cbtTheme.primary }}
              >
                {studentInitials}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: cbtTheme.muted }}>
            <p>
              Connection:{' '}
              <span style={{ color: connectionStatus === 'Connected' ? '#047857' : '#B45309', fontWeight: 600 }}>
                {connectionStatus}
              </span>
            </p>
            <p>
              Auto-save:{' '}
              <span style={{ color: autoSaveStatus === 'Save failed' ? cbtTheme.danger : cbtTheme.body, fontWeight: 600 }}>
                {autoSaveStatus}
              </span>
            </p>
            <p>
              Tab warnings:{' '}
              <span style={{ color: '#B45309', fontWeight: 600 }}>
                {tabWarningCount}/{tabWarningLimit}
              </span>
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setShowInstructionsMobile((prev) => !prev)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
            >
              {showInstructionsMobile ? 'Hide' : 'Show'} Instructions
            </button>
            <button
              type="button"
              onClick={() => setShowPaletteMobile((prev) => !prev)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
            >
              {showPaletteMobile ? 'Hide' : 'Show'} Palette
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-4 pb-0 pt-4 md:px-6 md:pb-0 md:pt-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,20%)_minmax(0,60%)_minmax(240px,20%)]">
          <aside
            className={`${showInstructionsMobile ? 'block' : 'hidden'} rounded-2xl border p-5 lg:block`}
            style={{ backgroundColor: cbtTheme.panelBg, borderColor: cbtTheme.border }}
          >
            <h2 className="text-sm font-bold uppercase tracking-[0.08em]" style={{ color: '#1F2937' }}>
              Regulations
            </h2>
            <ul className="mt-3 space-y-2 text-xs leading-6" style={{ color: cbtTheme.body }}>
              <li>1. Stay on this exam page throughout the session.</li>
              <li>2. Time is controlled by server and does not reset.</li>
              <li>3. Answers are auto-saved as you select or type.</li>
              <li>4. If system hangs, login again on another PC.</li>
              <li>5. New login signs out old session.</li>
            </ul>

            <div className="mt-4 rounded-xl border p-3 text-xs" style={{ backgroundColor: '#EFF6FF', borderColor: '#DBEAFE', color: '#1E40AF' }}>
              Quick timer: <span className="font-bold">{formatDuration(remainingSeconds)}</span>
            </div>

            <div className="mt-3 rounded-xl border p-3 text-xs" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
              Tab-fencing is active. Violations may auto-submit your exam.
            </div>
          </aside>

          <main className="rounded-2xl border p-5 md:p-6" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold tracking-[0.02em]" style={{ color: cbtTheme.body }}>
                QUESTION {currentIndex + 1} OF {questions.length}
              </p>
              <div className="text-sm" style={{ color: cbtTheme.muted }}>
                Answered <span style={{ color: '#047857', fontWeight: 600 }}>{answeredCount}</span> / {questions.length}
              </div>
            </div>

            <div className="mt-4 rounded-xl border p-5" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
              <p className="text-[18px] leading-8 md:text-[21px]" style={{ color: cbtTheme.title }}>
                {currentQuestion.question_text}
              </p>
              <p className="mt-2 text-xs leading-5" style={{ color: cbtTheme.muted }}>
                Marks: {currentQuestion.marks}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {isTextType(currentQuestionType) ? (
                <div className="space-y-2">
                  {currentQuestionType === 'short_answer' || currentQuestionType === 'fill_blank' || currentQuestionType === 'calculation' ? (
                    <input
                      value={currentTextAnswer}
                      onChange={(e) => handleTextAnswerChange(currentQuestionId, e.target.value)}
                      onBlur={() => flushTextAnswerSave(currentQuestionId)}
                      placeholder="Type your answer here..."
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                      style={{ borderColor: cbtTheme.border }}
                    />
                  ) : (
                    <textarea
                      value={currentTextAnswer}
                      onChange={(e) => handleTextAnswerChange(currentQuestionId, e.target.value)}
                      onBlur={() => flushTextAnswerSave(currentQuestionId)}
                      placeholder={currentQuestionType === 'file_upload' ? 'Provide your response or file reference...' : 'Write your answer here...'}
                      rows={7}
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                      style={{ borderColor: cbtTheme.border }}
                    />
                  )}

                  {currentQuestion.max_words ? (
                    <p className="text-xs" style={{ color: cbtTheme.muted }}>
                      Words: {currentTextAnswer.trim() ? currentTextAnswer.trim().split(/\s+/).length : 0} / {currentQuestion.max_words}
                    </p>
                  ) : null}
                </div>
              ) : currentQuestion.options.length > 0 ? (
                currentQuestion.options.map((option, idx) => {
                  const isSelected = isMultiSelectType(currentQuestionType)
                    ? currentSelectedOptionIds.includes(option.id)
                    : currentAnswer.optionId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => (isMultiSelectType(currentQuestionType)
                        ? handleToggleMultiSelectAnswer(currentQuestionId, option.id)
                        : handleSelectAnswer(currentQuestionId, option.id))}
                      className="w-full rounded-xl border px-4 py-3 text-left transition"
                      style={{
                        borderColor: isSelected ? cbtTheme.primary : cbtTheme.border,
                        backgroundColor: isSelected ? '#DBEAFE' : cbtTheme.cardBg,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold"
                          style={{
                            borderColor: isSelected ? cbtTheme.primary : '#D1D5DB',
                            color: isSelected ? '#1D4ED8' : cbtTheme.muted,
                            backgroundColor: isSelected ? '#EFF6FF' : cbtTheme.cardBg,
                          }}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-sm leading-6 md:text-base" style={{ color: cbtTheme.title }}>
                          {option.option_text}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : currentQuestionType === 'true_false' ? (
                <div className="grid grid-cols-2 gap-3">
                  {['true', 'false'].map((boolText) => {
                    const selected = currentTextAnswer.toLowerCase() === boolText;
                    return (
                      <button
                        key={boolText}
                        type="button"
                        onClick={() => handleTrueFalseTextAnswer(currentQuestionId, boolText as 'true' | 'false')}
                        className="rounded-xl border px-4 py-3 text-sm font-semibold uppercase transition"
                        style={{
                          borderColor: selected ? cbtTheme.primary : cbtTheme.border,
                          backgroundColor: selected ? '#DBEAFE' : cbtTheme.cardBg,
                          color: cbtTheme.title,
                        }}
                      >
                        {boolText}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border px-4 py-3 text-sm" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                  No answer input configured for this question type. Notify invigilator.
                </div>
              )}
            </div>

            <p className="mt-4 text-xs leading-5" style={{ color: cbtTheme.muted }}>
              Auto-save status: {autoSaveStatus}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4" style={{ borderColor: cbtTheme.border }}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40"
                  style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex + 1)}
                  disabled={currentIndex >= questions.length - 1}
                  className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40"
                  style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
                >
                  Next
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFlag}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  style={{
                    borderColor: cbtTheme.warning,
                    color: currentFlagged ? cbtTheme.cardBg : '#B45309',
                    backgroundColor: currentFlagged ? cbtTheme.warning : cbtTheme.cardBg,
                  }}
                >
                  {currentFlagged ? 'Flagged' : 'Flag'}
                </button>
                {isLastQuestion ? (
                  <button
                    type="button"
                    onClick={() => setShowReview(true)}
                    disabled={submitting}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: cbtTheme.primary }}
                  >
                    Submit Exam
                  </button>
                ) : (
                  <p className="text-xs px-2" style={{ color: cbtTheme.muted }}>
                    Submit appears on last question.
                  </p>
                )}
              </div>
            </div>
          </main>

          <aside
            className={`${showPaletteMobile ? 'block' : 'hidden'} rounded-2xl border p-5 lg:block`}
            style={{ backgroundColor: cbtTheme.panelBg, borderColor: cbtTheme.border }}
          >
            <h2 className="text-sm font-bold uppercase tracking-[0.08em]" style={{ color: '#1F2937' }}>
              Question Palette
            </h2>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {questions.map((question, index) => {
                const isCurrent = index === currentIndex;
                const isFlagged = !!flagged[question.id];
                const isAnswered = hasAnswerValue(answers[question.id], question.question_type);

                let className = 'border-[#D1D5DB] bg-[#E5E7EB] text-[#374151]';
                if (isCurrent) className = 'border-[#2563EB] bg-[#2563EB] text-white';
                else if (isFlagged) className = 'border-[#F59E0B] bg-[#F59E0B] text-[#111827]';
                else if (isAnswered) className = 'border-[#10B981] bg-[#10B981] text-white';

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => goToQuestion(index)}
                    className={`h-10 rounded-lg border text-xs font-semibold transition ${className}`}
                  >
                    Q{index + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-1 text-[11px] leading-5" style={{ color: '#4B5563' }}>
              <p>Blue: Current</p>
              <p>Green: Answered</p>
              <p>Amber: Flagged</p>
              <p>Gray: Not answered</p>
            </div>
          </aside>
        </div>
      </div>

      {showStartModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border p-6 md:p-7" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
            <h2 className="text-[24px] font-bold leading-[1.2] tracking-[-0.02em]" style={{ color: cbtTheme.title }}>
              Read Instructions Before You Start
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: cbtTheme.muted }}>
              Your timer will begin only when you click <strong>Start Now</strong>.
            </p>

            <ul className="mt-4 space-y-2 text-sm leading-6" style={{ color: cbtTheme.body }}>
              <li>1. Stay on the exam page; tab switching is monitored.</li>
              <li>2. You can move to another system if one hangs.</li>
              <li>3. Answers are auto-saved as you type or select.</li>
              <li>4. Session can only run on one computer at a time.</li>
              <li>5. Submit only after reviewing all questions.</li>
            </ul>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/cbt')}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
              >
                Back to Portal
              </button>
              <button
                type="button"
                onClick={handleStartNow}
                disabled={startingAttempt}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: cbtTheme.primary }}
              >
                {startingAttempt ? 'Starting...' : 'Start Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReview && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl border p-5 md:p-6" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
            <h2 className="text-[24px] font-bold leading-[1.2] tracking-[-0.02em]" style={{ color: cbtTheme.title }}>
              Review Before Final Submit
            </h2>
            <p className="mt-1 text-sm leading-6" style={{ color: cbtTheme.muted }}>
              Confirm your answers before final submission.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border p-3" style={{ backgroundColor: cbtTheme.panelBg, borderColor: cbtTheme.border }}>
                <p className="text-xs" style={{ color: cbtTheme.muted }}>
                  Total Questions
                </p>
                <p className="text-lg font-bold" style={{ color: cbtTheme.title }}>
                  {questions.length}
                </p>
              </div>

              <div className="rounded-xl border p-3" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                <p className="text-xs" style={{ color: '#065F46' }}>
                  Answered
                </p>
                <p className="text-lg font-bold" style={{ color: '#047857' }}>
                  {answeredCount}
                </p>
              </div>

              <div className="rounded-xl border p-3" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
                <p className="text-xs" style={{ color: '#B91C1C' }}>
                  Unanswered
                </p>
                <p className="text-lg font-bold" style={{ color: '#B91C1C' }}>
                  {unansweredCount}
                </p>
              </div>

              <div className="rounded-xl border p-3" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                <p className="text-xs" style={{ color: '#92400E' }}>
                  Flagged
                </p>
                <p className="text-lg font-bold" style={{ color: '#B45309' }}>
                  {flaggedCount}
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-72 overflow-auto rounded-xl border" style={{ borderColor: cbtTheme.border }}>
              {questions.map((question, index) => {
                const answerValue = answers[question.id];
                const questionType = normalizeQuestionType(question.question_type);
                let summary = 'Not Answered';
                let summaryColor = '#B91C1C';

                if (isMultiSelectType(questionType)) {
                  const selected = answerValue?.optionIds || [];
                  if (selected.length > 0) {
                    const letters = selected
                      .map((id) => question.options.findIndex((item) => item.id === id))
                      .filter((idx) => idx >= 0)
                      .map((idx) => String.fromCharCode(65 + idx))
                      .join(', ');
                    summary = letters ? `Selected: ${letters}` : 'Answered';
                    summaryColor = '#047857';
                  }
                } else if (isSingleChoiceType(questionType)) {
                  const selectedOptionId = answerValue?.optionId;
                  const selectedOptionIndex = question.options.findIndex((item) => item.id === selectedOptionId);
                  if (selectedOptionIndex >= 0) {
                    summary = `Selected: ${String.fromCharCode(65 + selectedOptionIndex)}`;
                    summaryColor = '#047857';
                  } else if ((answerValue?.answerText || '').trim() !== '') {
                    summary = `Selected: ${answerValue?.answerText}`;
                    summaryColor = '#047857';
                  }
                } else if ((answerValue?.answerText || '').trim() !== '') {
                  const text = (answerValue?.answerText || '').trim();
                  summary = `Text saved${text.length > 40 ? ': ' + text.slice(0, 40) + '...' : ''}`;
                  summaryColor = '#047857';
                }

                return (
                  <div
                    key={question.id}
                    className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-b-0"
                    style={{ borderColor: cbtTheme.border }}
                  >
                    <p style={{ color: cbtTheme.body }}>
                      Q{index + 1} {flagged[question.id] ? '(Flagged)' : ''}
                    </p>
                    <p style={{ color: summaryColor }}>
                      {summary}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
              >
                Back to Exam
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: cbtTheme.primary }}
              >
                {submitting ? 'Submitting...' : 'Final Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubmitSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4">
          <div className="w-full max-w-md rounded-2xl border p-6 text-center" style={{ backgroundColor: cbtTheme.cardBg, borderColor: '#A7F3D0' }}>
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-base font-bold text-white"
              style={{ backgroundColor: cbtTheme.success }}
            >
              OK
            </div>
            <h3 className="mt-4 text-[24px] font-bold tracking-[-0.02em]" style={{ color: '#065F46' }}>
              Exam Submitted Successfully
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: cbtTheme.muted }}>
              Redirecting to exam selection...
            </p>
          </div>
        </div>
      )}

      {tabFencingAlert && (
        <div
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-2 text-sm font-medium shadow-lg"
          style={{ backgroundColor: cbtTheme.warning, borderColor: '#D97706', color: cbtTheme.title }}
        >
          {tabFencingAlert}
        </div>
      )}
    </div>
  );
};

export default CbtExamSession;
