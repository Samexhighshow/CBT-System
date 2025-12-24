import { api } from './api';
import { User, Student, Exam, Question, Subject, Department } from '../types';

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

  // Question Randomization API
  getRandomizationStats: (examId: number) => {
    return api.get(`/exams/${examId}/randomization/stats`);
  },

  updateRandomizationSettings: (examId: number, data: any) => {
    return api.put(`/exams/${examId}/randomization`, data);
  },

  previewRandomization: (examId: number) => {
    return api.get(`/exams/${examId}/randomization/preview`);
  },

  lockQuestions: (examId: number) => {
    return api.post(`/exams/${examId}/randomization/lock`);
  },

  unlockQuestions: (examId: number) => {
    return api.post(`/exams/${examId}/randomization/unlock`);
  },

  getStudentSelection: (examId: number, studentId?: number, userId?: number) => {
    return api.get(`/exams/${examId}/randomization/selection`, {
      params: { student_id: studentId, user_id: userId }
    });
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

// Question Bank API (independent of exams)
export const bankApi = {
  listQuestions: (params?: {
    q?: string;
    subject_id?: number;
    class_level?: string;
    question_type?: string;
    status?: string;
    difficulty?: string;
    page?: number;
    per_page?: number;
  }) => api.get('/bank/questions', { params }),

  getQuestion: (id: number) => api.get(`/bank/questions/${id}`),

  createQuestion: (data: any) => api.post('/bank/questions', data),

  updateQuestion: (id: number, data: any) => api.put(`/bank/questions/${id}`, data),

  deleteQuestion: (id: number) => api.delete(`/bank/questions/${id}`),

  bulkStatus: (ids: number[], status: string) => api.post('/bank/questions/bulk-status', { ids, status }),

  bulkDelete: (ids: number[]) => api.post('/bank/questions/bulk-delete', { ids }),

  duplicate: (id: number) => api.post(`/bank/questions/${id}/duplicate`),

  export: (params?: any) => api.get('/bank/questions/export', { params, responseType: 'blob' }),

  stats: () => api.get('/bank/questions/stats'),

  // Import CSV/Excel
  import: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/bank/questions/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Versions
  listVersions: (id: number) => api.get(`/bank/questions/${id}/versions`),
  compareVersions: (id: number, from: number, to: number) => api.get(`/bank/questions/${id}/versions/compare`, { params: { from, to } }),
  revertVersion: (id: number, version: number) => api.post(`/bank/questions/${id}/versions/${version}/revert`),

  // Workflow
  archive: (id: number) => api.post(`/bank/questions/${id}/archive`),
  submitForReview: (id: number) => api.post(`/bank/questions/${id}/submit-for-review`),
  approve: (id: number) => api.post(`/bank/questions/${id}/approve`),

  tags: {
    list: (params?: { q?: string; page?: number; per_page?: number }) => api.get('/bank/tags', { params }),
    create: (data: { name: string; description?: string }) => api.post('/bank/tags', data),
    update: (id: number, data: { name?: string; description?: string }) => api.put(`/bank/tags/${id}`, data),
    delete: (id: number) => api.delete(`/bank/tags/${id}`),
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

const apiServices = {
  auth: authApi,
  students: studentApi,
  exams: examApi,
  questions: questionApi,
  bank: bankApi,
  subjects: subjectApi,
  departments: departmentApi,
  results: resultsApi,
  admin: adminApi,
};

export default apiServices;
