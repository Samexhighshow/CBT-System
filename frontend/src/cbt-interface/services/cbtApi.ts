import axios from 'axios';
import { CbtAttemptEventLogResponse, CbtAttemptState, CbtAttemptVerifyResponse, CbtOpenExam, CbtQuestion } from '../types';

const CBT_API_BASE_URL = process.env.REACT_APP_CBT_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const cbtClient = axios.create({
  baseURL: CBT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: false,
});

const withSessionHeader = (sessionToken: string) => ({
  headers: {
    'X-CBT-Session': sessionToken,
  },
});

export const cbtApi = {
  listExams: async (regNumber?: string): Promise<CbtOpenExam[]> => {
    const response = await cbtClient.get<{ data: CbtOpenExam[] }>('/cbt/exams', {
      params: regNumber ? { reg_number: regNumber.toUpperCase() } : undefined,
    });
    return response.data?.data || [];
  },

  verifyExamAccess: async (examId: number, payload: { reg_number: string; access_code: string; device_id?: string }): Promise<CbtAttemptVerifyResponse> => {
    const response = await cbtClient.post<{ data: CbtAttemptVerifyResponse }>(`/cbt/exams/${examId}/verify`, payload);
    return response.data.data;
  },

  getAttemptState: async (attemptId: number, sessionToken: string): Promise<CbtAttemptState> => {
    const response = await cbtClient.get<{ data: CbtAttemptState }>(`/cbt/attempts/${attemptId}/state`, withSessionHeader(sessionToken));
    return response.data.data;
  },

  getAttemptQuestions: async (attemptId: number, sessionToken: string): Promise<CbtQuestion[]> => {
    const response = await cbtClient.get<{ data: CbtQuestion[] }>(`/cbt/attempts/${attemptId}/questions`, withSessionHeader(sessionToken));
    return response.data.data || [];
  },

  saveAnswer: async (
    attemptId: number,
    sessionToken: string,
    payload: { question_id: number; option_id?: number; answer_text?: string; flagged?: boolean }
  ): Promise<void> => {
    await cbtClient.post(`/cbt/attempts/${attemptId}/answer`, payload, withSessionHeader(sessionToken));
  },

  logAttemptEvent: async (
    attemptId: number,
    sessionToken: string,
    payload: { event_type: string; meta?: Record<string, unknown> }
  ): Promise<CbtAttemptEventLogResponse | null> => {
    const response = await cbtClient.post<{ data: CbtAttemptEventLogResponse }>(
      `/cbt/attempts/${attemptId}/event`,
      payload,
      withSessionHeader(sessionToken)
    );
    return response.data?.data || null;
  },

  submitAttempt: async (attemptId: number, sessionToken: string) => {
    const response = await cbtClient.post(`/cbt/attempts/${attemptId}/submit`, {}, withSessionHeader(sessionToken));
    return response.data?.data;
  },

  pingAttempt: async (attemptId: number, sessionToken: string): Promise<{ remaining_seconds: number }> => {
    const response = await cbtClient.post<{ remaining_seconds: number }>(`/cbt/attempts/${attemptId}/ping`, {}, withSessionHeader(sessionToken));
    return response.data;
  },
};

export default cbtClient;
