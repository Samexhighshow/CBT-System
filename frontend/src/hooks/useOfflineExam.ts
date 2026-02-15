import { useCallback, useEffect, useState } from 'react';
import offlineDB, { AnswerRecord, AttemptRecord, ExamPackage } from '../services/offlineDB';
import syncService from '../services/syncService';

export interface OfflineAnswerInput {
  questionId: number;
  answer: any;
}

const buildReceiptCode = (attemptId: string) => {
  const short = attemptId.split('-')[0] || attemptId.slice(0, 6);
  return `EXAM-${short}-${Date.now()}`;
};

export const useOfflineExam = (examId: number, studentId: number | null) => {
  const [examPackage, setExamPackage] = useState<ExamPackage | null>(null);
  const [attempt, setAttempt] = useState<AttemptRecord | null>(null);
  const [pendingSync, setPendingSync] = useState(0);

  const loadExamPackage = useCallback(async () => {
    const pkg = await offlineDB.examPackages.get(examId);
    setExamPackage(pkg ?? null);
    return pkg ?? null;
  }, [examId]);

  const storeExamPackage = useCallback(async (pkg: ExamPackage) => {
    await offlineDB.examPackages.put(pkg);
    await loadExamPackage();
  }, [loadExamPackage]);

  const getOrCreateAttempt = useCallback(async () => {
    if (!studentId) {
      return null;
    }

    const existing = await offlineDB.attempts
      .where('examId')
      .equals(examId)
      .and((row) => row.studentId === studentId && row.status === 'IN_PROGRESS')
      .first();

    if (existing) {
      setAttempt(existing);
      return existing;
    }

    const attemptId = crypto.randomUUID();
    const now = new Date().toISOString();
    const created: AttemptRecord = {
      attemptId,
      examId,
      studentId,
      status: 'IN_PROGRESS',
      startedAt: now,
      lastSavedAt: now,
    };

    await offlineDB.attempts.put(created);
    setAttempt(created);
    return created;
  }, [examId, studentId]);

  const saveAnswer = useCallback(async (input: OfflineAnswerInput) => {
    if (!attempt) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const record: AnswerRecord = {
      attemptId: attempt.attemptId,
      questionId: input.questionId,
      answer: input.answer,
      updatedAt,
    };

    await offlineDB.answers.put(record);
    await offlineDB.attempts.update(attempt.attemptId, {
      lastSavedAt: updatedAt,
    });
  }, [attempt]);

  const loadAnswers = useCallback(async () => {
    if (!attempt) {
      return [] as AnswerRecord[];
    }

    return offlineDB.answers
      .where('attemptId')
      .equals(attempt.attemptId)
      .toArray();
  }, [attempt]);

  const submitAttempt = useCallback(async () => {
    if (!attempt) {
      return null;
    }

    const submittedAt = new Date().toISOString();
    const receiptCode = buildReceiptCode(attempt.attemptId);

    await offlineDB.attempts.update(attempt.attemptId, {
      status: 'SUBMITTED_LOCAL',
      submittedAt,
      receiptCode,
      lastSavedAt: submittedAt,
    });

    await syncService.enqueue(attempt.attemptId, 'SUBMIT_ATTEMPT');

    const updated = await offlineDB.attempts.get(attempt.attemptId);
    setAttempt(updated ?? null);
    return updated ?? null;
  }, [attempt]);

  useEffect(() => {
    const refreshPending = async () => {
      const pending = await offlineDB.syncQueue.where('status').equals('PENDING').count();
      setPendingSync(pending);
    };

    refreshPending();
    const interval = window.setInterval(refreshPending, 5000);
    return () => window.clearInterval(interval);
  }, []);

  return {
    examPackage,
    attempt,
    pendingSync,
    loadExamPackage,
    storeExamPackage,
    getOrCreateAttempt,
    saveAnswer,
    submitAttempt,
    loadAnswers,
  };
};

export default useOfflineExam;
