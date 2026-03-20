import axios from 'axios';
import { CbtAttemptEventLogResponse, CbtAttemptState, CbtAttemptVerifyResponse, CbtOpenExam, CbtQuestion } from '../types';
import { API_URL } from '../../services/api';
import { resolveApiBaseUrl } from '../../services/apiBase';

const CBT_API_BASE_URL = resolveApiBaseUrl(
  process.env.REACT_APP_CBT_API_URL || API_URL || process.env.REACT_APP_API_URL
);

const cbtClient = axios.create({
  baseURL: CBT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: false,
});

const resolveBaseUrl = async (): Promise<string> => {
  return CBT_API_BASE_URL;
};

const withSessionHeader = (sessionToken: string) => ({
  headers: {
    'X-CBT-Session': sessionToken,
  },
});

const stableHash = (value: any): string => {
  const raw = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const cbtApi = {
  listExams: async (regNumber?: string): Promise<CbtOpenExam[]> => {
    const baseURL = await resolveBaseUrl();
    const response = await cbtClient.get<{ data: CbtOpenExam[] }>('/cbt/exams', {
      baseURL,
      params: regNumber ? { reg_number: regNumber.toUpperCase() } : undefined,
    });
    return response.data?.data || [];
  },

  verifyExamAccess: async (examId: number, payload: { reg_number: string; access_code: string; device_id?: string; sitting_id?: number }): Promise<CbtAttemptVerifyResponse> => {
    const baseURL = await resolveBaseUrl();
    const response = await cbtClient.post<{ data: CbtAttemptVerifyResponse }>(`/cbt/exams/${examId}/verify`, payload, { baseURL });
    return response.data.data;
  },

  startAttempt: async (
    attemptId: number,
    sessionToken: string
  ): Promise<{ attempt_id: number; status: string; started_at?: string | null; ends_at?: string | null; remaining_seconds: number }> => {
    const baseURL = await resolveBaseUrl();
    const response = await cbtClient.post<{ data: { attempt_id: number; status: string; started_at?: string | null; ends_at?: string | null; remaining_seconds: number } }>(
      `/cbt/attempts/${attemptId}/start`,
      {},
      {
        ...withSessionHeader(sessionToken),
        baseURL,
      }
    );
    return response.data.data;
  },

  getAttemptState: async (attemptId: number, sessionToken: string): Promise<CbtAttemptState> => {
    const baseURL = await resolveBaseUrl();
    const response = await cbtClient.get<{ data: CbtAttemptState }>(`/cbt/attempts/${attemptId}/state`, {
      ...withSessionHeader(sessionToken),
      baseURL,
    });
    return response.data.data;
  },

  getAttemptQuestions: async (attemptId: number, sessionToken: string): Promise<CbtQuestion[]> => {
    const baseURL = await resolveBaseUrl();
    const response = await cbtClient.get<{ data: CbtQuestion[] }>(`/cbt/attempts/${attemptId}/questions`, {
      ...withSessionHeader(sessionToken),
      baseURL,
    });
    return response.data.data || [];
  },

  saveAnswer: async (
    attemptId: number,
    sessionToken: string,
    payload: { question_id: number; option_id?: number; option_ids?: number[]; answer_text?: string; flagged?: boolean }
  ): Promise<void> => {
    const baseURL = await resolveBaseUrl();
    const idempotencyKey = `answer-${attemptId}-${payload.question_id}-${stableHash(payload)}`;
    await cbtClient.post(`/cbt/attempts/${attemptId}/answer`, payload, {
      headers: {
        ...withSessionHeader(sessionToken).headers,
        'Idempotency-Key': idempotencyKey,
      },
      baseURL,
    });
  },

  logAttemptEvent: async (
    attemptId: number,
    sessionToken: string,
    payload: { event_type: string; meta?: Record<string, unknown> }
  ): Promise<CbtAttemptEventLogResponse | null> => {
    const baseURL = await resolveBaseUrl();
    const response = await cbtClient.post<{ data: CbtAttemptEventLogResponse }>(
      `/cbt/attempts/${attemptId}/event`,
      payload,
      {
        ...withSessionHeader(sessionToken),
        baseURL,
      }
    );
    return response.data?.data || null;
  },

  submitAttempt: async (attemptId: number, sessionToken: string) => {
    const baseURL = await resolveBaseUrl();
    const response = await cbtClient.post(`/cbt/attempts/${attemptId}/submit`, {}, {
      headers: {
        ...withSessionHeader(sessionToken).headers,
        'Idempotency-Key': `submit-${attemptId}`,
      },
      baseURL,
    });
    return response.data?.data;
  },

  pingAttempt: async (attemptId: number, sessionToken: string): Promise<{ status?: string; remaining_seconds: number; code?: string }> => {
    const baseURL = await resolveBaseUrl();
    const response = await cbtClient.post<{ status?: string; remaining_seconds: number; code?: string }>(`/cbt/attempts/${attemptId}/ping`, {}, {
      ...withSessionHeader(sessionToken),
      baseURL,
    });
    return response.data;
  },
};

export default cbtClient;
