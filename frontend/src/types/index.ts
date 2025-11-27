// User Types
export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  roles?: Role[];
  permissions?: Permission[];
}

export interface Student {
  id: number;
  user_id: number;
  registration_number: string;
  department_id: number;
  class_level: 'JSS1' | 'JSS2' | 'JSS3' | 'SSS1' | 'SSS2' | 'SSS3';
  academic_session: string;
  phone?: string;
  guardian_phone?: string;
  address?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  department?: Department;
}

// Role and Permission Types
export interface Role {
  id: number;
  name: string;
  guard_name: string;
  created_at: string;
  updated_at: string;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  name: string;
  guard_name: string;
  created_at: string;
  updated_at: string;
}

// Department and Subject Types
export interface Department {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string;
  class_level: 'JSS1' | 'JSS2' | 'JSS3' | 'SSS1' | 'SSS2' | 'SSS3';
  department_id?: number;
  is_compulsory: boolean;
  created_at: string;
  updated_at: string;
  department?: Department;
}

// Exam Types
export interface Exam {
  id: number;
  title: string;
  subject_id: number;
  class_level: 'JSS1' | 'JSS2' | 'JSS3' | 'SSS1' | 'SSS2' | 'SSS3';
  academic_session: string;
  term: 'First Term' | 'Second Term' | 'Third Term';
  exam_type: 'Mid-Term' | 'End of Term' | 'Mock' | 'Practice';
  duration_minutes: number;
  total_marks: number;
  pass_mark: number;
  instructions?: string;
  created_by: number;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
  subject?: Subject;
  questions?: Question[];
  questions_count?: number;
}

export interface Question {
  id: number;
  exam_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'essay';
  marks: number;
  order_number: number;
  created_at: string;
  updated_at: string;
  options?: QuestionOption[];
}

export interface QuestionOption {
  id: number;
  question_id: number;
  option_text: string;
  is_correct: boolean;
  order_number: number;
  created_at: string;
  updated_at: string;
}

// Exam Attempt Types
export interface ExamAttempt {
  id: number;
  student_id: number;
  exam_id: number;
  started_at: string;
  submitted_at?: string;
  time_remaining_seconds?: number;
  status: 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned';
  score?: number;
  percentage?: number;
  passed?: boolean;
  created_at: string;
  updated_at: string;
  student?: Student;
  exam?: Exam;
  answers?: ExamAnswer[];
}

export interface ExamAnswer {
  id: number;
  exam_attempt_id: number;
  question_id: number;
  selected_option_id?: number;
  answer_text?: string;
  is_correct?: boolean;
  marks_obtained?: number;
  created_at: string;
  updated_at: string;
  question?: Question;
  selected_option?: QuestionOption;
}

// Registration Window Type
export interface RegistrationWindow {
  id: number;
  academic_session: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number;
  to: number;
}

// Authentication Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  student?: Student;
}

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  registration_number: string;
  department_id: number;
  class_level: 'JSS1' | 'JSS2' | 'JSS3' | 'SSS1' | 'SSS2' | 'SSS3';
  phone?: string;
  guardian_phone?: string;
  address?: string;
}

// Store Types
export interface AuthState {
  user: User | null;
  student: Student | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setUser: (user: User, student?: Student) => void;
}

export interface ExamState {
  currentExam: Exam | null;
  currentAttempt: ExamAttempt | null;
  answers: Record<number, ExamAnswer>;
  timeRemaining: number;
  setCurrentExam: (exam: Exam) => void;
  setCurrentAttempt: (attempt: ExamAttempt) => void;
  saveAnswer: (questionId: number, answer: ExamAnswer) => void;
  updateTimeRemaining: (seconds: number) => void;
  clearExamState: () => void;
}
