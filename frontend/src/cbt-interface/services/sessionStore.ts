import { CbtStoredSession } from '../types';

const keyForAttempt = (attemptId: number) => `cbt-session-${attemptId}`;

export const loadStoredSession = (attemptId: number): CbtStoredSession | null => {
  try {
    const raw = sessionStorage.getItem(keyForAttempt(attemptId));
    if (!raw) return null;
    return JSON.parse(raw) as CbtStoredSession;
  } catch {
    return null;
  }
};

export const saveStoredSession = (session: CbtStoredSession): void => {
  sessionStorage.setItem(keyForAttempt(session.attemptId), JSON.stringify(session));
};

export const clearStoredSession = (attemptId: number): void => {
  sessionStorage.removeItem(keyForAttempt(attemptId));
};
