export interface CbtOpenExam {
  id: number;
  title: string;
  assessment_type?: string;
  subject?: string;
  class_level?: string;
  duration_minutes: number;
  status: string;
  start_datetime?: string | null;
  end_datetime?: string | null;
  can_access: boolean;
  reason?: string | null;
}

export interface CbtAttemptVerifyResponse {
  attempt_id: number;
  session_token: string;
  status?: string;
  started_at?: string | null;
  ends_at?: string | null;
  remaining_seconds: number;
  switch_count: number;
  exam: {
    id: number;
    title: string;
    subject?: string;
    class_level?: string;
    duration_minutes: number;
  };
  student: {
    id: number;
    registration_number: string;
    name: string;
  };
}

export interface CbtAttemptState {
  attempt_id: number;
  status: string;
  started_at?: string | null;
  ends_at?: string | null;
  submitted_at?: string | null;
  remaining_seconds: number;
  switch_count: number;
  tab_warning_count?: number;
  tab_warning_limit?: number;
  score?: number | null;
  exam: {
    id: number;
    title: string;
    subject?: string;
    class_level?: string;
    duration_minutes: number;
  };
  answers: Array<{
    question_id: number;
    option_id?: number | null;
    option_ids?: number[];
    answer_text?: string | null;
    flagged: boolean;
    saved_at?: string | null;
    marks_awarded?: number | null;
  }>;
  question_order: number[];
}

export interface CbtQuestionOption {
  id: number;
  option_text: string;
}

export interface CbtQuestion {
  id: number;
  question_text: string;
  question_type: string;
  marks: number;
  max_words?: number | null;
  options: CbtQuestionOption[];
}

export interface CbtAttemptEventLogResponse {
  attempt_id: number;
  event_type: string;
  tab_warning_count: number;
  tab_warning_limit?: number;
  logged_at: string;
}

export interface CbtStoredSession {
  attemptId: number;
  sessionToken: string;
  endsAt?: string | null;
  examTitle?: string;
  studentName?: string;
  registrationNumber?: string;
}
