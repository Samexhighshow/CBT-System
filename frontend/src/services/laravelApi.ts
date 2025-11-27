import { api } from './api';
import { User, Student, Exam, Question, Answer, Subject, Department } from '../types';

// Auth API
export const authApi = {
  // Student auth
  login: (credentials: { email: string; password: string }) => {
    return api.post<{ token: string; user: User }>('/login', credentials);
  },

  register: (data: { 
    first_name: string; 
    last_name: string; 
    email: string; 
    password: string;
    password_confirmation: string;
    registration_number: string;
    department_id?: number;
  }) => {
    return api.post<{ token: string; user: User }>('/register', data);
  },

  logout: () => {
    return api.post('/logout');
  },

  // Admin auth
  adminLogin: (credentials: { email: string; password: string }) => {
    return api.post<{ token: string; user: User }>('/admin/login', credentials);
  },

  // Get current user
  me: () => {
    return api.get<{ user: User }>('/me');
  },

  // CSRF cookie for sanctum
  csrf: () => {
    return api.get('/sanctum/csrf-cookie');
  },
};

// Student API
export const studentApi = {
  getAll: (params?: { page?: number; per_page?: number; search?: string }) => {
    return api.get<{ data: Student[]; meta: any }>('/students', { params });
  },

  getById: (id: number) => {
    return api.get<{ data: Student }>(`/students/${id}`);
  },

  create: (data: Partial<Student>) => {
    return api.post<{ data: Student }>('/students', data);
  },

  update: (id: number, data: Partial<Student>) => {
    return api.put<{ data: Student }>(`/students/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete(`/students/${id}`);
  },

  getExams: (studentId: number) => {
    return api.get<{ data: Exam[] }>(`/students/${studentId}/exams`);
  },

  getResults: (studentId: number) => {
    return api.get<{ data: any[] }>(`/students/${studentId}/results`);
  },
};

// Exam API
export const examApi = {
  getAll: (params?: { page?: number; per_page?: number; search?: string; subject_id?: number }) => {
    return api.get<{ data: Exam[]; meta: any }>('/exams', { params });
  },

  getById: (id: number) => {
    return api.get<{ data: Exam }>(`/exams/${id}`);
  },

  create: (data: Partial<Exam>) => {
    return api.post<{ data: Exam }>('/exams', data);
  },

  update: (id: number, data: Partial<Exam>) => {
    return api.put<{ data: Exam }>(`/exams/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete(`/exams/${id}`);
  },

  getQuestions: (examId: number) => {
    return api.get<{ data: Question[] }>(`/exams/${examId}/questions`);
  },

  start: (examId: number) => {
    return api.post<{ data: { exam: Exam; questions: Question[] } }>(`/exams/${examId}/start`);
  },

  submit: (examId: number, answers: { [questionId: number]: number }) => {
    return api.post<{ data: { score: number; total: number; percentage: number } }>(
      `/exams/${examId}/submit`, 
      { answers }
    );
  },

  getAvailable: () => {
    return api.get<{ data: Exam[] }>('/exams/available');
  },
};

// Question API
export const questionApi = {
  getAll: (examId: number) => {
    return api.get<{ data: Question[] }>(`/exams/${examId}/questions`);
  },

  getById: (examId: number, questionId: number) => {
    return api.get<{ data: Question }>(`/exams/${examId}/questions/${questionId}`);
  },

  create: (examId: number, data: Partial<Question>) => {
    return api.post<{ data: Question }>(`/exams/${examId}/questions`, data);
  },

  update: (examId: number, questionId: number, data: Partial<Question>) => {
    return api.put<{ data: Question }>(`/exams/${examId}/questions/${questionId}`, data);
  },

  delete: (examId: number, questionId: number) => {
    return api.delete(`/exams/${examId}/questions/${questionId}`);
  },

  bulkCreate: (examId: number, questions: Partial<Question>[]) => {
    return api.post<{ data: Question[] }>(`/exams/${examId}/questions/bulk`, { questions });
  },
};

// Subject API
export const subjectApi = {
  getAll: () => {
    return api.get<{ data: Subject[] }>('/subjects');
  },

  getById: (id: number) => {
    return api.get<{ data: Subject }>(`/subjects/${id}`);
  },

  create: (data: Partial<Subject>) => {
    return api.post<{ data: Subject }>('/subjects', data);
  },

  update: (id: number, data: Partial<Subject>) => {
    return api.put<{ data: Subject }>(`/subjects/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete(`/subjects/${id}`);
  },
};

// Department API
export const departmentApi = {
  getAll: () => {
    return api.get<{ data: Department[] }>('/departments');
  },

  getById: (id: number) => {
    return api.get<{ data: Department }>(`/departments/${id}`);
  },

  create: (data: Partial<Department>) => {
    return api.post<{ data: Department }>('/departments', data);
  },

  update: (id: number, data: Partial<Department>) => {
    return api.put<{ data: Department }>(`/departments/${id}`, data);
  },

  delete: (id: number) => {
    return api.delete(`/departments/${id}`);
  },
};

// Results/Analytics API
export const resultsApi = {
  getStudentResults: (studentId: number) => {
    return api.get<{ data: any[] }>(`/students/${studentId}/results`);
  },

  getExamResults: (examId: number) => {
    return api.get<{ data: any[] }>(`/exams/${examId}/results`);
  },

  getAnalytics: () => {
    return api.get<{ data: any }>('/analytics/dashboard');
  },
};

// Admin API
export const adminApi = {
  getDashboardStats: () => {
    return api.get<{ 
      data: {
        total_students: number;
        total_exams: number;
        total_subjects: number;
        total_departments: number;
        recent_exams: Exam[];
        recent_students: Student[];
      }
    }>('/admin/dashboard');
  },

  getUsers: () => {
    return api.get<{ data: User[] }>('/admin/users');
  },

  createUser: (data: Partial<User>) => {
    return api.post<{ data: User }>('/admin/users', data);
  },

  updateUser: (id: number, data: Partial<User>) => {
    return api.put<{ data: User }>(`/admin/users/${id}`, data);
  },

  deleteUser: (id: number) => {
    return api.delete(`/admin/users/${id}`);
  },
};

export default {
  auth: authApi,
  students: studentApi,
  exams: examApi,
  questions: questionApi,
  subjects: subjectApi,
  departments: departmentApi,
  results: resultsApi,
  admin: adminApi,
};
