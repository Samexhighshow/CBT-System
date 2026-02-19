import { CbtStoredSession } from '../types';

const keyForAttempt = (attemptId: number) => `cbt-session-${attemptId}`;

export const loadStoredSession = (attemptId: number): CbtStoredSession | null => {
  try {
    const key = keyForAttempt(attemptId);
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CbtStoredSession;
  } catch {
    return null;
  }
};

export const saveStoredSession = (session: CbtStoredSession): void => {
  const key = keyForAttempt(session.attemptId);
  const value = JSON.stringify(session);
  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
};

export const clearStoredSession = (attemptId: number): void => {
  const key = keyForAttempt(attemptId);
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
};
