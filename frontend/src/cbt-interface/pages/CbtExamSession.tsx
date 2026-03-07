import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cbtApi } from '../services/cbtApi';
import { clearStoredSession, loadStoredSession } from '../services/sessionStore';
import { CbtAttemptState, CbtQuestion } from '../types';
import { cbtFontFamily, cbtTheme } from '../theme';
import { defaultAssessmentDisplayConfig, fetchAssessmentDisplayConfig } from '../../services/assessmentDisplay';
import useConnectivity from '../../hooks/useConnectivity';

type AutoSaveState = 'Saved' | 'Saving...' | 'Save failed' | 'Saved offline';
type AnswerValue = {
  optionId?: number;
  optionIds?: number[];
  answerText?: string;
};

type CachedAnswerRecord = {
  value?: AnswerValue;
  flagged: boolean;
  updatedAt: string;
};

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
  const [showInstructionsMobile, setShowInstructionsMobile] = useState(false);
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startingAttempt, setStartingAttempt] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [hasReadInstructions, setHasReadInstructions] = useState(false);
  const [assessmentLabels, setAssessmentLabels] = useState(defaultAssessmentDisplayConfig.labels);
  const [showReconnectPrompt, setShowReconnectPrompt] = useState(false);
  const connectivity = useConnectivity();

  const eventThrottleRef = useRef<Record<string, number>>({});
  const sessionResumeLoggedRef = useRef(false);
  const textAutosaveTimersRef = useRef<Record<number, number>>({});
  const answerCacheKey = useMemo(() => `cbt-offline-answer-cache-${attemptId}`, [attemptId]);
  const attemptSnapshotKey = useMemo(() => `cbt-attempt-snapshot-${attemptId}`, [attemptId]);

  const isNetworkError = useCallback((err: any): boolean => {
    const message = String(err?.message || '').toLowerCase();
    const code = String(err?.code || '').toUpperCase();
    return (
      code === 'ERR_NETWORK' ||
      message.includes('network error') ||
      message.includes('failed to fetch') ||
      message.includes('timeout') ||
      !err?.response
    );
  }, []);

  const readCachedAnswers = useCallback((): Record<number, CachedAnswerRecord> => {
    try {
      const raw = localStorage.getItem(answerCacheKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, CachedAnswerRecord>;
      const normalized: Record<number, CachedAnswerRecord> = {};
      Object.entries(parsed || {}).forEach(([key, value]) => {
        const qid = Number(key);
        if (!Number.isFinite(qid) || !value) return;
        normalized[qid] = {
          value: value.value,
          flagged: !!value.flagged,
          updatedAt: value.updatedAt || new Date().toISOString(),
        };
      });
      return normalized;
    } catch {
      return {};
    }
  }, [answerCacheKey]);

  const writeCachedAnswers = useCallback((next: Record<number, CachedAnswerRecord>) => {
    if (!next || Object.keys(next).length === 0) {
      localStorage.removeItem(answerCacheKey);
      return;
    }
    localStorage.setItem(answerCacheKey, JSON.stringify(next));
  }, [answerCacheKey]);

  const cacheAnswerOffline = useCallback((questionId: number, value?: AnswerValue, forcedFlag?: boolean) => {
    const existing = readCachedAnswers();
    existing[questionId] = {
      value,
      flagged: forcedFlag ?? flagged[questionId] ?? false,
      updatedAt: new Date().toISOString(),
    };
    writeCachedAnswers(existing);
  }, [flagged, readCachedAnswers, writeCachedAnswers]);

  const clearCachedAnswer = useCallback((questionId: number) => {
    const existing = readCachedAnswers();
    if (!existing[questionId]) return;
    delete existing[questionId];
    writeCachedAnswers(existing);
  }, [readCachedAnswers, writeCachedAnswers]);

  const clearCachedSession = useCallback(() => {
    localStorage.removeItem(answerCacheKey);
    localStorage.removeItem(attemptSnapshotKey);
  }, [answerCacheKey, attemptSnapshotKey]);

  useEffect(() => {
    sessionResumeLoggedRef.current = false;
  }, [attemptId]);

  useEffect(() => {
    const loadLabels = async () => {
      const config = await fetchAssessmentDisplayConfig();
      setAssessmentLabels(config.labels);
    };

    loadLabels();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(textAutosaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      textAutosaveTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (showStartModal) {
      setHasReadInstructions(false);
    }
  }, [showStartModal]);

  const handleAttemptClosed = useCallback((message: string) => {
    clearCachedSession();
    clearStoredSession(attemptId);
    window.alert(message);
    navigate('/cbt');
  }, [attemptId, clearCachedSession, navigate]);

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



    if (options?.warningAlert) {
      // Warning alerts disabled - tab fencing removed
    }

    try {
      const response = await cbtApi.logAttemptEvent(attemptId, sessionToken, {
        event_type: eventType,
        meta,
      });

      if (response && response.event_type) {
        // Tab fencing removed - no warning count tracking
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'attempt_submitted') {
        handleAttemptClosed('This attempt is already submitted.');
      }
    }
  }, [attemptId, handleAttemptClosed, sessionToken]);

  const applyAttemptPayload = useCallback((stateData: CbtAttemptState, questionData: CbtQuestion[]) => {
    setAttemptState(stateData);
    setQuestions(questionData);
    setRemainingSeconds(stateData.remaining_seconds || 0);
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

    // Merge locally cached answers so work continues if server dropped mid-session.
    const cachedMap = readCachedAnswers();
    Object.entries(cachedMap).forEach(([rawQuestionId, cached]) => {
      const questionId = Number(rawQuestionId);
      if (!Number.isFinite(questionId)) return;
      if (cached?.value) {
        answerMap[questionId] = cached.value;
      }
      if (cached) {
        flagMap[questionId] = !!cached.flagged;
      }
    });

    setAnswers(answerMap);
    setFlagged(flagMap);
    const firstUnansweredIndex = questionData.findIndex((question) => !hasAnswerValue(answerMap[question.id], question.question_type));
    setCurrentIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0);
  }, [readCachedAnswers]);

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
      applyAttemptPayload(stateData, questionData);
      localStorage.setItem(
        attemptSnapshotKey,
        JSON.stringify({
          stateData,
          questionData,
          cachedAt: new Date().toISOString(),
        })
      );
      setError(null);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'session_revoked') {
        setSessionRevoked(true);
      } else if (code === 'attempt_submitted') {
        clearStoredSession(attemptId);
        navigate('/cbt');
        return;
      } else if (code === 'invalid_session' || code === 'missing_session_token' || err?.response?.status === 401) {
        clearStoredSession(attemptId);
        setError('Exam session expired. Return to portal and login again.');
        return;
      }
      if (isNetworkError(err)) {
        try {
          const rawSnapshot = localStorage.getItem(attemptSnapshotKey);
          if (rawSnapshot) {
            const parsed = JSON.parse(rawSnapshot) as {
              stateData?: CbtAttemptState;
              questionData?: CbtQuestion[];
            };
            if (parsed?.stateData && Array.isArray(parsed?.questionData) && parsed.questionData.length > 0) {
              applyAttemptPayload(parsed.stateData, parsed.questionData);
              setConnectionStatus('Reconnecting...');
              setAutoSaveStatus('Saved offline');
              setError('Connection lost. Continuing with cached exam data. Answers will sync once server is reachable.');
              return;
            }
          }
        } catch {
          // ignore cache parsing issues and continue to fallback message below
        }
      }
      const fallbackMessage = typeof err?.message === 'string' ? err.message : null;
      setError(err?.response?.data?.message || fallbackMessage || 'Failed to load exam session.');
    } finally {
      setLoading(false);
    }
  }, [applyAttemptPayload, attemptId, attemptSnapshotKey, isNetworkError, navigate, sessionToken]);

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
        clearCachedSession();
        clearStoredSession(attemptId);
        navigate('/cbt');
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Auto-submit failed. Contact invigilator.');
      } finally {
        setSubmitting(false);
      }
    };

    autoSubmit();
  }, [attemptId, attemptState, clearCachedSession, navigate, remainingSeconds, sessionToken, submitting]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress' || sessionResumeLoggedRef.current) return;
    sessionResumeLoggedRef.current = true;
    logAttemptEvent('session_resumed', { source: 'cbt_exam_session' }, { throttleMs: 1000 });
  }, [attemptState, logAttemptEvent]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress') {
      setShowReconnectPrompt(false);
      return;
    }

    if (connectivity.status === 'OFFLINE' && connectivity.reconnectPending) {
      setShowReconnectPrompt(true);
      return;
    }

    if (connectivity.status === 'ONLINE' || connectivity.status === 'LAN_ONLY') {
      setShowReconnectPrompt(false);
    }
  }, [attemptState, connectivity.status, connectivity.reconnectPending]);

  const handleSyncNow = useCallback(async () => {
    const next = await connectivity.refresh();
    if (next.status === 'ONLINE' || next.status === 'LAN_ONLY') {
      setConnectionStatus('Connected');
      setShowReconnectPrompt(false);
      await hydrateAttempt();
      return;
    }
    setConnectionStatus('Reconnecting...');
    setShowReconnectPrompt(true);
  }, [connectivity, hydrateAttempt]);

  const flushOfflineAnswerCache = useCallback(async (): Promise<boolean> => {
    if (!attemptState || attemptState.status !== 'in_progress' || !sessionToken) return false;
    if (!(connectivity.status === 'ONLINE' || connectivity.status === 'LAN_ONLY')) return false;

    const cached = readCachedAnswers();
    const entries = Object.entries(cached);
    if (entries.length === 0) return false;

    setAutoSaveStatus('Saving...');
    let hadFailure = false;
    const nextCache: Record<number, CachedAnswerRecord> = { ...cached };

    for (const [rawQuestionId, record] of entries) {
      const questionId = Number(rawQuestionId);
      if (!Number.isFinite(questionId)) {
        delete nextCache[questionId];
        continue;
      }

      const payload: { question_id: number; option_id?: number; option_ids?: number[]; answer_text?: string; flagged?: boolean } = {
        question_id: questionId,
        flagged: !!record.flagged,
      };

      if (typeof record.value?.optionId === 'number') payload.option_id = record.value.optionId;
      if (Array.isArray(record.value?.optionIds)) payload.option_ids = record.value.optionIds;
      if (typeof record.value?.answerText === 'string') payload.answer_text = record.value.answerText;

      try {
        // eslint-disable-next-line no-await-in-loop
        await cbtApi.saveAnswer(attemptId, sessionToken, payload);
        delete nextCache[questionId];
      } catch (err: any) {
        if (isNetworkError(err)) {
          hadFailure = true;
          setConnectionStatus('Reconnecting...');
          break;
        }
      }
    }

    writeCachedAnswers(nextCache);
    if (Object.keys(nextCache).length === 0) {
      setAutoSaveStatus('Saved');
      setError((prev) => (prev && prev.toLowerCase().includes('connection') ? null : prev));
      return true;
    }

    if (hadFailure) {
      setAutoSaveStatus('Saved offline');
    } else {
      setAutoSaveStatus('Save failed');
    }

    return false;
  }, [attemptId, attemptState, connectivity.status, isNetworkError, readCachedAnswers, sessionToken, writeCachedAnswers]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress') return;
    if (!(connectivity.status === 'ONLINE' || connectivity.status === 'LAN_ONLY')) return;
    void flushOfflineAnswerCache();
  }, [attemptState, connectivity.status, flushOfflineAnswerCache]);

  useEffect(() => {
    if (!attemptState || attemptState.status !== 'in_progress') return;
    if (!(connectivity.status === 'ONLINE' || connectivity.status === 'LAN_ONLY')) return;

    const timer = window.setInterval(() => {
      void flushOfflineAnswerCache();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [attemptState, connectivity.status, flushOfflineAnswerCache]);

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
      setError((prev) => (prev && prev.toLowerCase().includes('connection') ? null : prev));
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
    if (!showReview) return;

    window.history.pushState({ cbtReview: true }, '', window.location.href);
    const onPopState = () => {
      setShowReview(false);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [showReview]);

  const orderedQuestionIds = useMemo(() => questions.map((question) => question.id), [questions]);
  const currentQuestion = questions[currentIndex] || null;

  const answeredCount = useMemo(
    () => orderedQuestionIds.filter((id) => {
      const questionType = questions.find((q) => q.id === id)?.question_type;
      return hasAnswerValue(answers[id], questionType);
    }).length,
    [answers, orderedQuestionIds, questions]
  );

  const unansweredCount = Math.max(0, questions.length - answeredCount);

  const formatAnswerSummary = useCallback((question: CbtQuestion): string => {
    const answerValue = answers[question.id];
    const questionType = normalizeQuestionType(question.question_type);

    if (isMultiSelectType(questionType)) {
      const selected = answerValue?.optionIds || [];
      if (selected.length === 0) return 'Not answered';
      const labels = selected
        .map((id) => {
          const optionIndex = question.options.findIndex((item) => item.id === id);
          if (optionIndex < 0) return null;
          const letter = String.fromCharCode(65 + optionIndex);
          return `${letter}. ${question.options[optionIndex]?.option_text || ''}`;
        })
        .filter(Boolean) as string[];
      return labels.length > 0 ? labels.join(' | ') : 'Answered';
    }

    if (isSingleChoiceType(questionType)) {
      const selectedOptionId = answerValue?.optionId;
      const selectedOptionIndex = question.options.findIndex((item) => item.id === selectedOptionId);
      if (selectedOptionIndex >= 0) {
        const letter = String.fromCharCode(65 + selectedOptionIndex);
        return `${letter}. ${question.options[selectedOptionIndex]?.option_text || ''}`;
      }
      if ((answerValue?.answerText || '').trim() !== '') {
        return (answerValue?.answerText || '').trim();
      }
      return 'Not answered';
    }

    const text = (answerValue?.answerText || '').trim();
    return text !== '' ? text : 'Not answered';
  }, [answers]);

  const startedAtDate = attemptState?.started_at ? new Date(attemptState.started_at) : null;
  const submittedAtDate = attemptState?.submitted_at ? new Date(attemptState.submitted_at) : null;
  const effectiveEndDate = submittedAtDate || (showSubmitSuccess ? new Date() : null);
  const timeTakenSeconds = startedAtDate && effectiveEndDate
    ? Math.max(0, Math.floor((effectiveEndDate.getTime() - startedAtDate.getTime()) / 1000))
    : null;

  const persistAnswer = useCallback(async (questionId: number, value?: AnswerValue, forceFlag?: boolean) => {
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
      clearCachedAnswer(questionId);
      setAutoSaveStatus('Saved');
      setError((prev) => (prev && prev.toLowerCase().includes('connection') ? null : prev));

      await logAttemptEvent(forceFlag === undefined ? 'answer_saved' : 'flag_toggled', {
        question_id: questionId,
        has_option: typeof value?.optionId === 'number' || (value?.optionIds?.length || 0) > 0,
        has_text: (value?.answerText || '').trim() !== '',
        flagged: forceFlag ?? flagged[questionId] ?? false,
      });
    } catch (err: any) {
      if (isNetworkError(err)) {
        cacheAnswerOffline(questionId, value, forceFlag);
        setConnectionStatus('Reconnecting...');
        setAutoSaveStatus('Saved offline');
        setError('Connection lost. Your latest answer is saved locally and will sync automatically.');
        return;
      }

      setAutoSaveStatus('Save failed');
      const message = err?.response?.data?.message || 'Unable to save answer. Retry or notify invigilator.';
      setError(message);
    }
  }, [attemptId, attemptState, cacheAnswerOffline, clearCachedAnswer, flagged, isNetworkError, logAttemptEvent, sessionToken]);

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
    }, 1200);
  };

  const flushTextAnswerSave = useCallback(async (questionId: number) => {
    if (textAutosaveTimersRef.current[questionId]) {
      window.clearTimeout(textAutosaveTimersRef.current[questionId]);
      delete textAutosaveTimersRef.current[questionId];
    }
    await persistAnswer(questionId, answers[questionId]);
  }, [answers, persistAnswer]);

  const flushAllPendingTextSaves = useCallback(async () => {
    const pendingQuestionIds = Object.keys(textAutosaveTimersRef.current)
      .map((rawId) => Number(rawId))
      .filter((value) => Number.isFinite(value));

    for (const qid of pendingQuestionIds) {
      // eslint-disable-next-line no-await-in-loop
      await flushTextAnswerSave(qid);
    }
  }, [flushTextAnswerSave]);

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
      if (isNetworkError(err)) {
        setConnectionStatus('Reconnecting...');
        setAutoSaveStatus('Saved offline');
        setError('Server is unreachable. Keep this page open and retry Start when connection is restored.');
      } else {
        const message = err?.response?.data?.message || 'Unable to start attempt. Contact invigilator.';
        setError(message);
      }
    } finally {
      setStartingAttempt(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!attemptState || attemptState.status !== 'in_progress' || submitting) return;

    try {
      setSubmitting(true);
      await flushAllPendingTextSaves();

      if (connectivity.status === 'ONLINE' || connectivity.status === 'LAN_ONLY') {
        await flushOfflineAnswerCache();
      }

      const remainingOfflineAnswers = Object.keys(readCachedAnswers()).length;
      if (remainingOfflineAnswers > 0) {
        setAutoSaveStatus('Saved offline');
        setError('Cannot submit yet. Some answers are still pending sync. Reconnect and wait for auto-save to show Saved, then submit again.');
        return;
      }

      setAutoSaveStatus('Saving...');
      await cbtApi.submitAttempt(attemptId, sessionToken);
      setAutoSaveStatus('Saved');
      setShowReview(false);
      setShowSubmitSuccess(true);
      setAttemptState((prev) => (prev ? { ...prev, status: 'submitted', submitted_at: new Date().toISOString() } : prev));
      window.setTimeout(() => navigate('/cbt'), 3500);
      window.setTimeout(() => {
        clearCachedSession();
        clearStoredSession(attemptId);
      }, 3600);
    } catch (err: any) {
      if (isNetworkError(err)) {
        setConnectionStatus('Reconnecting...');
        setAutoSaveStatus('Saved offline');
        setError('Submit is pending because server is unreachable. Keep this page open and retry when connection returns.');
      } else {
        setError(err?.response?.data?.message || 'Submit failed. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    if (currentQuestionType && isTextType(currentQuestionType)) {
      void flushTextAnswerSave(currentQuestionId);
    }
    setCurrentIndex(index);
  };

  useEffect(() => {
    const onBeforeUnload = () => {
      void flushAllPendingTextSaves();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flushAllPendingTextSaves]);

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
            onClick={() => {
              clearCachedSession();
              clearStoredSession(attemptId);
              navigate('/cbt');
            }}
            className="mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: cbtTheme.primary }}
          >
            Back to {assessmentLabels.assessmentNoun} Portal
          </button>
        </div>
      </div>
    );
  }

  if (!attemptState || !currentQuestion) {
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

  if (showSubmitSuccess) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
        <header className="border-b" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
          <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-[24px] font-bold tracking-[-0.02em]" style={{ color: cbtTheme.title }}>
                {assessmentLabels.assessmentNoun} Submission Report
              </h1>
              <div className="text-sm" style={{ color: cbtTheme.muted }}>
                {storedSession?.registrationNumber || 'No Reg Number'}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border p-3" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
              <p className="text-xs" style={{ color: cbtTheme.muted }}>Total Questions</p>
              <p className="text-xl font-bold" style={{ color: cbtTheme.title }}>{questions.length}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
              <p className="text-xs" style={{ color: '#065F46' }}>Answered</p>
              <p className="text-xl font-bold" style={{ color: '#047857' }}>{answeredCount}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
              <p className="text-xs" style={{ color: '#B91C1C' }}>Unanswered</p>
              <p className="text-xl font-bold" style={{ color: '#B91C1C' }}>{unansweredCount}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
              <p className="text-xs" style={{ color: cbtTheme.muted }}>Time Taken</p>
              <p className="text-xl font-bold" style={{ color: cbtTheme.title }}>
                {timeTakenSeconds !== null ? formatDuration(timeTakenSeconds) : '-'}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
            {questions.map((question, index) => {
              const summary = formatAnswerSummary(question);
              const notAnswered = summary === 'Not answered';
              return (
                <div key={question.id} className="border-b p-4 last:border-b-0" style={{ borderColor: cbtTheme.border }}>
                  <p className="text-sm font-semibold" style={{ color: cbtTheme.title }}>
                    Q{index + 1}. {question.question_text}
                  </p>
                  <p className="mt-2 text-sm" style={{ color: notAnswered ? '#B91C1C' : '#047857' }}>
                    Selected: {summary}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/cbt')}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: cbtTheme.primary }}
            >
              Back to {assessmentLabels.assessmentNoun} Selection
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (showReview) {
    return (
      <div className="flex min-h-screen flex-col" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
        <header className="sticky top-0 z-30 border-b" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
          <div className="mx-auto w-full max-w-[1800px] px-4 py-2 md:px-6 md:py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[16px] font-bold tracking-[-0.015em]" style={{ color: cbtTheme.title }}>
                Review Before Final Submit
              </p>
              <div className="text-xs" style={{ color: cbtTheme.muted }}>
                Answered <span style={{ color: '#047857', fontWeight: 600 }}>{answeredCount}</span> / {questions.length}
              </div>
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

        <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-4 pb-2 pt-4 md:px-6 md:pt-5">
          <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(220px,20%)_minmax(0,60%)_minmax(220px,20%)]" style={{ gridAutoRows: '1fr' }}>
            <aside
              className={`${showInstructionsMobile ? 'block' : 'hidden'} h-full rounded-2xl border p-4 lg:block`}
              style={{ backgroundColor: cbtTheme.panelBg, borderColor: cbtTheme.border }}
            >
              <h2 className="text-sm font-bold uppercase tracking-[0.08em]" style={{ color: '#1F2937' }}>
                Regulations
              </h2>
              <ul className="mt-2.5 space-y-1.5 text-[11px] leading-5" style={{ color: cbtTheme.body }}>
                <li>1. Stay on this exam page throughout the session.</li>
                <li>2. Time is controlled by server and does not reset.</li>
                <li>3. Answers are auto-saved as you select or type.</li>
                <li>4. If system hangs, login again on another PC.</li>
                <li>5. New login signs out old session.</li>
              </ul>

              <div className="mt-3 rounded-xl border p-2.5 text-[11px]" style={{ backgroundColor: '#EFF6FF', borderColor: '#DBEAFE', color: '#1E40AF' }}>
                Quick timer: <span className="font-bold">{formatDuration(remainingSeconds)}</span>
              </div>
            </aside>

            <main className="flex h-full flex-col rounded-2xl border p-4" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border p-2.5" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
                  <p className="text-[11px]" style={{ color: cbtTheme.muted }}>Total Questions</p>
                  <p className="text-lg font-bold" style={{ color: cbtTheme.title }}>{questions.length}</p>
                </div>
                <div className="rounded-xl border p-2.5" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                  <p className="text-[11px]" style={{ color: '#065F46' }}>Answered</p>
                  <p className="text-lg font-bold" style={{ color: '#047857' }}>{answeredCount}</p>
                </div>
                <div className="rounded-xl border p-2.5" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
                  <p className="text-[11px]" style={{ color: '#B91C1C' }}>Unanswered</p>
                  <p className="text-lg font-bold" style={{ color: '#B91C1C' }}>{unansweredCount}</p>
                </div>
                <div className="rounded-xl border p-2.5" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
                  <p className="text-[11px]" style={{ color: cbtTheme.muted }}>Time Taken</p>
                  <p className="text-lg font-bold" style={{ color: cbtTheme.title }}>
                    {timeTakenSeconds !== null ? formatDuration(timeTakenSeconds) : '-'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
                {questions.map((question, index) => {
                  const summary = formatAnswerSummary(question);
                  const notAnswered = summary === 'Not answered';
                  return (
                    <div key={question.id} className="border-b p-2.5 last:border-b-0" style={{ borderColor: cbtTheme.border }}>
                      <p className="text-xs font-semibold" style={{ color: cbtTheme.title }}>
                        Q{index + 1}. {question.question_text}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: notAnswered ? '#B91C1C' : '#047857' }}>
                        Selected: {summary}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3" style={{ borderColor: cbtTheme.border }}>
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-semibold"
                  style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
                >
                  Back to Attempt
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: cbtTheme.primary }}
                >
                  {submitting ? 'Submitting...' : 'Final Submit'}
                </button>
              </div>
            </main>

            <aside
              className={`${showPaletteMobile ? 'block' : 'hidden'} h-full rounded-2xl border p-4 lg:block`}
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
                      onClick={() => {
                        setShowReview(false);
                        goToQuestion(index);
                      }}
                      className={`h-8 rounded-lg border text-[11px] font-semibold transition ${className}`}
                    >
                      Q{index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-1 text-[10px] leading-4" style={{ color: '#4B5563' }}>
                <p>Blue: Current</p>
                <p>Green: Answered</p>
                <p>Amber: Flagged</p>
                <p>Gray: Not answered</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
      <header className="sticky top-0 z-30 border-b" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
        <div className="mx-auto w-full max-w-[1800px] px-4 py-2 md:px-6 md:py-3">
          <div className="grid items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: cbtTheme.primary }}
              >
                SC
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold md:text-[15px]" style={{ color: cbtTheme.title }}>
                  {attemptState.exam.title}
                </p>
                <p className="text-xs leading-5" style={{ color: cbtTheme.muted }}>
                  {attemptState.exam.subject || 'General Subject'}
                </p>
              </div>
            </div>

            <div
              className={`rounded-xl px-3 py-1.5 text-xs font-bold tracking-[-0.01em] ${
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
              <span
                style={{
                  color: autoSaveStatus === 'Save failed'
                    ? cbtTheme.danger
                    : autoSaveStatus === 'Saved offline'
                      ? '#B45309'
                      : cbtTheme.body,
                  fontWeight: 600,
                }}
              >
                {autoSaveStatus}
              </span>
            </p>

            {showReconnectPrompt && (
              <div className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: '#F59E0B', backgroundColor: '#FFFBEB', color: '#92400E' }}>
                <span>Server connection restored. Sync now?</span>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  className="rounded border px-2 py-0.5 text-[11px] font-semibold"
                  style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', color: '#1F2937' }}
                >
                  Sync now
                </button>
              </div>
            )}
          </div>

          {error && (
            <div
              className="mt-2 rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: '#FBBF24', backgroundColor: '#FFFBEB', color: '#92400E' }}
            >
              {error}
            </div>
          )}

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

      <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-4 pb-2 pt-3 md:px-6 md:pb-2 md:pt-4">
        <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(220px,20%)_minmax(0,60%)_minmax(220px,20%)]" style={{ gridAutoRows: '1fr' }}>
          <aside
            className={`${showInstructionsMobile ? 'block' : 'hidden'} h-full rounded-2xl border p-4 lg:block`}
            style={{ backgroundColor: cbtTheme.panelBg, borderColor: cbtTheme.border }}
          >
            <h2 className="text-sm font-bold uppercase tracking-[0.08em]" style={{ color: '#1F2937' }}>
              Regulations
            </h2>
            <ul className="mt-2.5 space-y-1.5 text-[11px] leading-5" style={{ color: cbtTheme.body }}>
              <li>1. Stay on this exam page throughout the session.</li>
              <li>2. Time is controlled by server and does not reset.</li>
              <li>3. Answers are auto-saved as you select or type.</li>
              <li>4. If system hangs, login again on another PC.</li>
              <li>5. New login signs out old session.</li>
            </ul>

            <div className="mt-3 rounded-xl border p-2.5 text-[11px]" style={{ backgroundColor: '#EFF6FF', borderColor: '#DBEAFE', color: '#1E40AF' }}>
              Quick timer: <span className="font-bold">{formatDuration(remainingSeconds)}</span>
            </div>


          </aside>

          <main className="flex h-full flex-col rounded-2xl border p-4" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-[0.02em]" style={{ color: cbtTheme.body }}>
                QUESTION {currentIndex + 1} OF {questions.length}
              </p>
              <div className="text-xs" style={{ color: cbtTheme.muted }}>
                Answered <span style={{ color: '#047857', fontWeight: 600 }}>{answeredCount}</span> / {questions.length}
              </div>
            </div>

            <div className="mt-3 rounded-xl border p-3.5" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
              <p className="text-[16px] leading-7 md:text-[18px]" style={{ color: cbtTheme.title }}>
                {currentQuestion.question_text}
              </p>
              <p className="mt-1 text-[11px] leading-4" style={{ color: cbtTheme.muted }}>
                Marks: {currentQuestion.marks}
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {isTextType(currentQuestionType) ? (
                <div className="space-y-2">
                  {currentQuestionType === 'short_answer' || currentQuestionType === 'fill_blank' || currentQuestionType === 'calculation' ? (
                    <input
                      value={currentTextAnswer}
                      onChange={(e) => handleTextAnswerChange(currentQuestionId, e.target.value)}
                      onBlur={() => flushTextAnswerSave(currentQuestionId)}
                      placeholder="Type your answer here..."
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{ borderColor: cbtTheme.border }}
                    />
                  ) : (
                    <textarea
                      value={currentTextAnswer}
                      onChange={(e) => handleTextAnswerChange(currentQuestionId, e.target.value)}
                      onBlur={() => flushTextAnswerSave(currentQuestionId)}
                      placeholder={currentQuestionType === 'file_upload' ? 'Provide your response or file reference...' : 'Write your answer here...'}
                      rows={6}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2"
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
                      className="w-full rounded-xl border px-3 py-2 text-left transition"
                      style={{
                        borderColor: isSelected ? cbtTheme.primary : cbtTheme.border,
                        backgroundColor: isSelected ? '#DBEAFE' : cbtTheme.cardBg,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold"
                          style={{
                            borderColor: isSelected ? cbtTheme.primary : '#D1D5DB',
                            color: isSelected ? '#1D4ED8' : cbtTheme.muted,
                            backgroundColor: isSelected ? '#EFF6FF' : cbtTheme.cardBg,
                          }}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-sm leading-5" style={{ color: cbtTheme.title }}>
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
                        className="rounded-xl border px-3 py-2 text-xs font-semibold uppercase transition"
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
                <div className="rounded-xl border px-3 py-2 text-xs" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                  No answer input configured for this question type. Notify invigilator.
                </div>
              )}
            </div>

            <p className="mt-3 text-[11px] leading-4" style={{ color: cbtTheme.muted }}>
              Auto-save status: {autoSaveStatus}
            </p>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: cbtTheme.border }}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFlag}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-semibold"
                  style={{
                    borderColor: cbtTheme.warning,
                    color: currentFlagged ? cbtTheme.cardBg : '#B45309',
                    backgroundColor: currentFlagged ? cbtTheme.warning : cbtTheme.cardBg,
                  }}
                >
                  {currentFlagged ? 'Flagged' : 'Flag'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-medium disabled:opacity-40"
                  style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex + 1)}
                  disabled={currentIndex >= questions.length - 1}
                  className="rounded-lg border px-3.5 py-1.5 text-xs font-medium disabled:opacity-40"
                  style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
                >
                  Next
                </button>
              </div>
            </div>
          </main>

          <aside
            className={`${showPaletteMobile ? 'block' : 'hidden'} h-full rounded-2xl border p-4 lg:block`}
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
                    className={`h-8 rounded-lg border text-[11px] font-semibold transition ${className}`}
                  >
                    Q{index + 1}
                  </button>
                );
              })}
            </div>

            {isLastQuestion ? (
              <button
                type="button"
                onClick={() => setShowReview(true)}
                disabled={submitting}
                className="mt-4 w-full rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: cbtTheme.primary }}
              >
                {submitting ? 'Submitting...' : `Submit ${assessmentLabels.assessmentNoun}`}
              </button>
            ) : null}

            <div className="mt-3 space-y-1 text-[10px] leading-4" style={{ color: '#4B5563' }}>
              <p>Blue: Current</p>
              <p>Green: Answered</p>
              <p>Amber: Flagged</p>
              <p>Gray: Not answered</p>
            </div>
          </aside>
        </div>
      </div>

      {showStartModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-3 md:p-4" style={{ backgroundColor: cbtTheme.pageBg }}>
          <div className="mx-auto w-full max-w-[1280px] p-1 md:p-2">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
              <div>
                <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' }}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: '#1D4ED8' }}>
                    {assessmentLabels.assessmentNoun} Briefing
                  </p>
                  <h2 className="mt-2 text-[24px] font-bold leading-[1.2] tracking-[-0.02em] md:text-[30px]" style={{ color: cbtTheme.title }}>
                    Read Instructions Before You Start
                  </h2>
                  <p className="mt-2 text-sm leading-6" style={{ color: cbtTheme.muted }}>
                    Your timer starts only when you click <strong>Start Now</strong>. Ensure you are ready before proceeding.
                  </p>
                </div>

                <div className="mt-4 rounded-xl border p-4 md:p-5" style={{ borderColor: cbtTheme.border, backgroundColor: '#F8FAFC' }}>
                  <h3 className="text-sm font-bold uppercase tracking-[0.08em]" style={{ color: '#1F2937' }}>
                    Candidate Instructions
                  </h3>
                  <ul className="mt-3 space-y-2.5 text-[15px] leading-7" style={{ color: cbtTheme.body }}>
                    <li>1. Stay on this page throughout the session.</li>
                    <li>2. Answers auto-save as you select or type.</li>
                    <li>3. If a system hangs, login on another authorized device.</li>
                    <li>4. New login automatically replaces old session.</li>
                    <li>5. Review flagged/unanswered items before final submission.</li>
                  </ul>
                </div>

                <label
                  className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-3 text-sm"
                  style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', color: cbtTheme.body }}
                >
                  <input
                    type="checkbox"
                    checked={hasReadInstructions}
                    onChange={(e) => setHasReadInstructions(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>I have read and understood these instructions.</span>
                </label>
              </div>

              <aside className="rounded-xl border p-4 md:p-5" style={{ borderColor: cbtTheme.border, backgroundColor: cbtTheme.panelBg }}>
                <h3 className="text-sm font-bold uppercase tracking-[0.08em]" style={{ color: '#1F2937' }}>
                  Session Snapshot
                </h3>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' }}>
                    <p className="text-xs uppercase tracking-[0.07em]" style={{ color: cbtTheme.muted }}>Exam</p>
                    <p className="mt-1 font-semibold" style={{ color: cbtTheme.title }}>{attemptState.exam.title}</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' }}>
                    <p className="text-xs uppercase tracking-[0.07em]" style={{ color: cbtTheme.muted }}>Subject</p>
                    <p className="mt-1 font-semibold" style={{ color: cbtTheme.title }}>{attemptState.exam.subject || 'General Subject'}</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' }}>
                    <p className="text-xs uppercase tracking-[0.07em]" style={{ color: cbtTheme.muted }}>Duration</p>
                    <p className="mt-1 font-semibold" style={{ color: cbtTheme.title }}>{attemptState.exam.duration_minutes} minutes</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' }}>
                    <p className="text-xs uppercase tracking-[0.07em]" style={{ color: cbtTheme.muted }}>Candidate</p>
                    <p className="mt-1 font-semibold" style={{ color: cbtTheme.title }}>{storedSession?.registrationNumber || 'No Reg Number'}</p>
                  </div>
                  <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF' }}>
                    <p className="text-xs uppercase tracking-[0.07em]" style={{ color: cbtTheme.muted }}>Expected End</p>
                    <p className="mt-1 font-semibold" style={{ color: cbtTheme.title }}>
                      {attemptState.ends_at ? new Date(attemptState.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Server Controlled'}
                    </p>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/cbt')}
                className="rounded-lg border px-5 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
                style={{ borderColor: '#D1D5DB', color: cbtTheme.body }}
              >
                Back to {assessmentLabels.assessmentNoun} Portal
              </button>
              <button
                type="button"
                onClick={handleStartNow}
                disabled={startingAttempt || !hasReadInstructions}
                className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                style={{ backgroundColor: cbtTheme.primary }}
              >
                {startingAttempt ? 'Starting...' : 'Start Now'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default CbtExamSession;
