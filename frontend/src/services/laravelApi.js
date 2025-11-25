// Laravel API client helper for the React frontend
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

client.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default {
  auth: {
    login: (payload) => client.post('/login', payload),
    register: (payload) => client.post('/register', payload),
  },
  exams: {
    list: () => client.get('/exams'),
    load: (id) => client.get(`/exams/${id}`),
    start: (id, payload) => client.post(`/exams/${id}/start`, payload),
    syncAttempt: (payload) => client.post('/exams/attempts/sync', payload)
  }
};
