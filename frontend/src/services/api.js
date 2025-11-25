import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  adminLogin: (email, password) => apiClient.post('/auth/admin/login', { email, password }),
  studentLogin: (studentId, password) => apiClient.post('/auth/student/login', { studentId, password }),
  refreshToken: (refreshToken) => apiClient.post('/auth/refresh-token', { refreshToken }),
  logout: () => apiClient.post('/auth/logout')
};

export const studentAPI = {
  register: (data) => apiClient.post('/students/register', data),
  getProfile: () => apiClient.get('/students/profile'),
  updateProfile: (data) => apiClient.put('/students/profile', data),
  getAssignedExams: () => apiClient.get('/students/assigned-exams'),
  getResults: () => apiClient.get('/students/results'),
  getRegistrationStatus: () => apiClient.get('/students/registration-status')
};

export const examAPI = {
  getAvailableExams: (studentId) => apiClient.get(`/exams/available/${studentId}`),
  getExamDetails: (examId) => apiClient.get(`/exams/${examId}`),
  getExamQuestions: (examId, studentId) => apiClient.get(`/exams/${examId}/questions/${studentId}`)
};

export const examAttemptAPI = {
  startExam: (examId) => apiClient.post(`/exam-attempts/start/${examId}`),
  saveAnswer: (attemptId, data) => apiClient.post(`/exam-attempts/${attemptId}/save-answer`, data),
  submitExam: (attemptId) => apiClient.post(`/exam-attempts/${attemptId}/submit`),
  getAttempt: (attemptId) => apiClient.get(`/exam-attempts/${attemptId}`)
};

export default apiClient;
