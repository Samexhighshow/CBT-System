import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import useLoadingStore from '../store/loadingStore';

// Prefer localhost for Windows dev environments; still allow env override
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Export base URL for use in components
export const API_URL = API_BASE_URL;

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // In development, prefer Bearer tokens over cookies to simplify CORS
  // If you need cookie-based auth later, flip this back to true and ensure CORS/Sanctum are configured
  withCredentials: false,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const shouldTrack = !(config as any)?.skipGlobalLoading;
    if (shouldTrack) {
      useLoadingStore.getState().increment();
      (config as any).__loadingTracked = true;
    }

    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    const tracked = (response.config as any)?.__loadingTracked;
    if (tracked) {
      useLoadingStore.getState().decrement();
    }
    return response;
  },
  (error) => {
    const tracked = (error.config as any)?.__loadingTracked;
    if (tracked) {
      useLoadingStore.getState().decrement();
    }

    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      const requestUrl = error.config?.url || '';
      
      // Only trigger logout/redirect if this is an auth-related 401
      // Ignore 401s from analytics, optional features, etc.
      const criticalAuthRoutes = ['/auth/me', '/auth/verify', '/profile'];
      const isCriticalAuthFailure = criticalAuthRoutes.some(route => requestUrl.includes(route));
      
      // Don't redirect if we're already on a public route
      const publicRoutes = ['/login', '/student-login', '/admin-login', '/register', '/', '/forgot-password', '/reset-password'];
      const isPublicRoute = publicRoutes.includes(currentPath);
      
      if (isCriticalAuthFailure && !isPublicRoute) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('subjectsSelected');
        
        // Redirect based on current route
        const isAdminRoute = currentPath.startsWith('/admin');
        window.location.href = isAdminRoute ? '/admin-login' : '/student-login';
      }
    }
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // GET request
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.get<T>(url, config);
  },

  // POST request
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.post<T>(url, data, config);
  },

  // PUT request
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.put<T>(url, data, config);
  },

  // PATCH request
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.patch<T>(url, data, config);
  },

  // DELETE request
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    return apiClient.delete<T>(url, config);
  },
};

export default apiClient;
