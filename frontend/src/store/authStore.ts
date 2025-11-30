import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hasCompletedTeacherSetup: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  completeTeacherSetup: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasCompletedTeacherSetup: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setToken: (token) => {
        if (token) {
          localStorage.setItem('auth_token', token);
        } else {
          localStorage.removeItem('auth_token');
        }
        set({ token });
      },

      login: (user, token) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ 
          user, 
          token, 
          isAuthenticated: true,
          error: null,
        });
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false,
          error: null,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      clearError: () => set({ error: null }),
      
      completeTeacherSetup: () => set({ hasCompletedTeacherSetup: true }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        hasCompletedTeacherSetup: state.hasCompletedTeacherSetup,
      }),
    }
  )
);

export default useAuthStore;
