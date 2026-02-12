import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cbtApi } from '../services/cbtApi';
import { clearStoredSession, loadStoredSession } from '../services/sessionStore';
import { CbtAttemptState, CbtQuestion } from '../types';

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

type AutoSaveState = 'Saved' | 'Saving...' | 'Save failed';

const TAB_WARNING_EVENT_TYPES = ['tab_hidden', 'window_blur', 'fullscreen_exited'] as const;

const CbtExamSession: React.FC = () => {
  const navigate = useNavigate();
  const { attemptId: attemptIdParam } = useParams<{ attemptId: string }>();

  const attemptId = Number(attemptIdParam || 0);
  const storedSession = attemptId > 0 ? loadStoredSession(attemptId) : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptState, setAttemptState] = useState<CbtAttemptState | null>(null);
  const [questions, setQuestions] = useState<CbtQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | undefined>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveState>('Saved');
  const [connectionStatus, setConnectionStatus] = useState<'Connected' | 'Reconnecting...'>('Connected');
  const [submitting, setSubmitting] = useState(false);
  const [showInstructionsMobile, setShowInstructionsMobile] = useState(false);
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);
  const [sessionRevoked, setSessionRevoked] = useState(false);
  const [tabWarningCount, setTabWarningCount] = useState(0);
  const [tabWarningLimit, setTabWarningLimit] = useState(3);
  const [tabFencingAlert, setTabFencingAlert] = useState<string | null>(null);

  const eventThrottleRef = useRef<Record<string, number>>({});
  const sessionResumeLoggedRef = useRef(false);

  const sessionToken = storedSession?.sessionToken || '';

  useEffect(() => {
    sessionResumeLoggedRef.current = false;
  }, [attemptId]);

  const hydrateAttempt = useCallback(async () => {
    if (!attemptId || !sessionToken) {
      setError('Session not found. Please return to access portal.');
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

      const answerMap: Record<number, number | undefined> = {};
      const flagMap: Record<number, boolean> = {};

      stateData.answers.forEach((answer) => {
        if (answer.option_id) {
          answerMap[answer.question_id] = answer.option_id;
        }
        if (answer.flagged) {
          flagMap[answer.question_id] = true;
        }
      });

      setAnswers(answerMap);
      setFlagged(flagMap);

      const firstUnansweredIndex = questionData.findIndex((question) => !answerMap[question.id]);
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
    if (!attemptState) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = Math.max(0, prev - 1);
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [attemptState]);

  useEffect(() => {
    if (!attemptState || remainingSeconds > 0 || submitting || attemptState.status === 'submitted' || attemptState.status === 'completed') {
      return;
    }

    const autoSubmit = async () => {
      try {
        setSubmitting(true);
        await cbtApi.submitAttempt(attemptId, sessionToken);
        clearStoredSession(attemptId);
        navigate('/cbt');
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Auto-submit failed. Contact invigilator immediately.');
      } finally {
        setSubmitting(false);
      }
    };

    autoSubmit();
  }, [attemptId, attemptState, navigate, remainingSeconds, sessionToken, submitting]);

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
        return;
      }
    }
  }, [attemptId, handleAttemptClosed, sessionToken]);

  useEffect(() => {
    if (!attemptState || sessionResumeLoggedRef.current) return;
    sessionResumeLoggedRef.current = true;
    logAttemptEvent('session_resumed', { source: 'cbt_exam_session' }, { throttleMs: 1000 });
  }, [attemptState, logAttemptEvent]);

  useEffect(() => {
    if (!attemptState || !sessionToken) return;

    const interval = setInterval(async () => {
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

    return () => clearInterval(interval);
  }, [attemptId, attemptState, handleAttemptClosed, sessionToken]);

  useEffect(() => {
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
  }, [logAttemptEvent]);

  useEffect(() => {
    if (!attemptState || !sessionToken) return;

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
        { throttleMs: 2000, warningAlert: 'Focus lost. Return to the exam window now.', countAsWarning: true }
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

      if (blocked) {
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
        setTabFencingAlert('Developer and print shortcuts are blocked during the exam.');
      }
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
    () => orderedQuestionIds.filter((id) => !!answers[id]).length,
    [answers, orderedQuestionIds]
  );

  const persistAnswer = async (questionId: number, optionId?: number, forceFlag?: boolean) => {
    if (!sessionToken) return;

    try {
      setAutoSaveStatus('Saving...');
      await cbtApi.saveAnswer(attemptId, sessionToken, {
        question_id: questionId,
        option_id: optionId,
        flagged: forceFlag ?? flagged[questionId] ?? false,
      });
      setAutoSaveStatus('Saved');
      await logAttemptEvent(forceFlag === undefined ? 'answer_saved' : 'flag_toggled', {
        question_id: questionId,
        has_option: typeof optionId === 'number',
        flagged: forceFlag ?? flagged[questionId] ?? false,
      });
    } catch {
      setAutoSaveStatus('Save failed');
    }
  };

  const handleSelectAnswer = async (questionId: number, optionId: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    await persistAnswer(questionId, optionId);
  };

  const handleToggleFlag = async () => {
    if (!currentQuestion) return;
    const questionId = currentQuestion.id;
    const nextFlag = !flagged[questionId];

    setFlagged((prev) => ({ ...prev, [questionId]: nextFlag }));
    await persistAnswer(questionId, answers[questionId], nextFlag);
  };

  const handleSubmit = async () => {
    if (!attemptState || submitting) return;

    const confirmSubmit = window.confirm('Submit exam now? You will not be able to edit answers afterwards.');
    if (!confirmSubmit) return;

    try {
      setSubmitting(true);
      setAutoSaveStatus('Saving...');
      await cbtApi.submitAttempt(attemptId, sessionToken);
      setAutoSaveStatus('Saved');
      clearStoredSession(attemptId);
      navigate('/cbt');
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p className="mt-3 text-sm text-slate-300">Loading exam session...</p>
        </div>
      </div>
    );
  }

  if (sessionRevoked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-red-500/40 bg-red-900/20 p-6 text-center">
          <h2 className="text-xl font-bold text-red-200">Session Revoked</h2>
          <p className="mt-2 text-sm text-red-100">
            This exam session has moved to another device. Return to the access portal if you need to continue.
          </p>
          <button
            type="button"
            onClick={() => navigate('/cbt')}
            className="mt-5 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
          >
            Back to Portal
          </button>
        </div>
      </div>
    );
  }

  if (error || !attemptState || !currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
          <h2 className="text-lg font-semibold">Unable to continue exam</h2>
          <p className="mt-2 text-sm text-slate-300">{error || 'Exam data is unavailable.'}</p>
          <button
            type="button"
            onClick={() => navigate('/cbt')}
            className="mt-5 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-400"
          >
            Return to Portal
          </button>
        </div>
      </div>
    );
  }

  const currentQuestionId = currentQuestion.id;
  const currentFlagged = !!flagged[currentQuestionId];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto max-w-[1800px] px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-bold">
                SC
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">School CBT Center</p>
                <p className="truncate text-sm md:text-base font-semibold">{attemptState.exam.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${remainingSeconds < 300 ? 'bg-red-500/20 text-red-200' : 'bg-cyan-500/20 text-cyan-100'}`}>
                Remaining: {formatDuration(remainingSeconds)}
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${connectionStatus === 'Connected' ? 'bg-emerald-400' : 'bg-amber-300 animate-pulse'}`} />
                <span className="text-slate-300">{connectionStatus}</span>
              </div>

              <div className="hidden sm:block text-xs text-slate-300">Auto-save: <span className={autoSaveStatus === 'Save failed' ? 'text-red-300' : 'text-emerald-300'}>{autoSaveStatus}</span></div>

              <div className="hidden md:block text-xs text-slate-300">
                Tab fencing: <span className="text-cyan-200 font-semibold">Active</span> | Warnings: <span className="text-amber-200 font-semibold">{tabWarningCount}/{tabWarningLimit}</span>
              </div>

              <div className="h-9 w-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold">
                {(storedSession?.studentName || 'ST').split(' ').map((n) => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setShowInstructionsMobile((prev) => !prev)}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs"
            >
              {showInstructionsMobile ? 'Hide' : 'Show'} Instructions
            </button>
            <button
              type="button"
              onClick={() => setShowPaletteMobile((prev) => !prev)}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs"
            >
              {showPaletteMobile ? 'Hide' : 'Show'} Question Palette
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-4 py-4 md:px-6 lg:py-5">
        <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)_270px]">
          <aside className={`${showInstructionsMobile ? 'block' : 'hidden'} lg:block rounded-xl border border-slate-700 bg-slate-900/75 p-4 h-fit`}>
            <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-wide">Regulations</h2>
            <ul className="mt-3 space-y-2 text-xs text-slate-200 leading-relaxed">
              <li>1. Do not open other tabs or windows during the exam.</li>
              <li>2. Your timer is controlled by the server and does not reset.</li>
              <li>3. Answers are auto-saved continuously.</li>
              <li>4. If your system hangs, login again with your code to resume.</li>
              <li>5. Logging in on another system signs out the previous session.</li>
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              Session replacement is active for this exam.
            </div>
            <div className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 text-xs">
              <p className="text-cyan-100 font-semibold">Tab Fencing</p>
              <p className="text-slate-200 mt-1">Stay on this exam screen. Leaving the tab or window is logged.</p>
              <p className="mt-2 text-amber-200">Warnings logged: {tabWarningCount} of {tabWarningLimit}</p>
            </div>
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs">
              <p className="text-slate-400">Quick timer view</p>
              <p className="mt-1 text-lg font-bold text-cyan-200">{formatDuration(remainingSeconds)}</p>
            </div>
          </aside>

          <main className="rounded-xl border border-slate-700 bg-slate-900/75 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Question {currentIndex + 1} of {questions.length}
              </p>
              <div className="text-xs text-slate-300">
                Answered <span className="font-semibold text-emerald-300">{answeredCount}</span> / {questions.length}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950/40 p-4">
              <p className="text-base md:text-lg leading-relaxed">{currentQuestion.question_text}</p>
              <p className="mt-2 text-xs text-slate-400">Marks: {currentQuestion.marks}</p>
            </div>

            <div className="mt-4 space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = answers[currentQuestionId] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectAnswer(currentQuestionId, option.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/15'
                        : 'border-slate-700 bg-slate-950/35 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-7 w-7 rounded-full border flex items-center justify-center text-xs font-bold ${isSelected ? 'border-cyan-300 bg-cyan-500 text-slate-900' : 'border-slate-500 text-slate-300'}`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm md:text-base">{option.option_text}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 border-t border-slate-700 pt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="rounded-md border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex + 1)}
                  disabled={currentIndex >= questions.length - 1}
                  className="rounded-md border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFlag}
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${currentFlagged ? 'bg-amber-500 text-slate-900' : 'border border-amber-400 text-amber-200'}`}
                >
                  {currentFlagged ? 'Flagged' : 'Flag'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Submit Exam'}
                </button>
              </div>
            </div>
          </main>

          <aside className={`${showPaletteMobile ? 'block' : 'hidden'} lg:block rounded-xl border border-slate-700 bg-slate-900/75 p-4 h-fit`}>
            <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-wide">Question Palette</h2>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {questions.map((question, index) => {
                const isCurrent = index === currentIndex;
                const isFlagged = !!flagged[question.id];
                const isAnswered = !!answers[question.id];

                let className = 'border-slate-600 bg-slate-800 text-slate-200';
                if (isCurrent) className = 'border-blue-300 bg-blue-500 text-slate-900';
                else if (isFlagged) className = 'border-amber-300 bg-amber-500 text-slate-900';
                else if (isAnswered) className = 'border-emerald-300 bg-emerald-500 text-slate-900';

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => goToQuestion(index)}
                    className={`h-10 rounded-md border text-xs font-semibold transition ${className}`}
                  >
                    Q{index + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-1 text-[11px] text-slate-300">
              <p><span className="inline-block h-2 w-2 rounded-full bg-blue-400 mr-1" /> Current</p>
              <p><span className="inline-block h-2 w-2 rounded-full bg-emerald-400 mr-1" /> Answered</p>
              <p><span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1" /> Flagged</p>
              <p><span className="inline-block h-2 w-2 rounded-full bg-slate-400 mr-1" /> Not answered</p>
            </div>
          </aside>
        </div>
      </div>

      {tabFencingAlert && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm rounded-lg border border-amber-400/40 bg-amber-600/90 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg">
          {tabFencingAlert}
        </div>
      )}
    </div>
  );
};

export default CbtExamSession;
