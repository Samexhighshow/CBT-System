import create from 'zustand';
import laravelApi from '../services/laravelApi';

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  // Initialize from localStorage
  init: () => {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('auth_user');
    
    if (token && user) {
      set({
        token,
        user: JSON.parse(user)
      });
    }
  },

  // Login
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await laravelApi.auth.login(email, password);
      
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('auth_user', JSON.stringify(response.user));
      
      set({
        token: response.token,
        user: response.user,
        loading: false
      });

      return { success: true };
    } catch (err) {
      const error = err.response?.data?.message || 'Login failed';
      set({ error, loading: false });
      return { success: false, error };
    }
  },

  // Register
  register: async (formData) => {
    set({ loading: true, error: null });
    try {
      const response = await laravelApi.auth.register(formData);
      
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('auth_user', JSON.stringify(response.user));
      
      set({
        token: response.token,
        user: response.user,
        loading: false
      });

      return { success: true };
    } catch (err) {
      const error = err.response?.data?.message || 'Registration failed';
      set({ error, loading: false });
      return { success: false, error };
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    set({
      user: null,
      token: null,
      error: null
    });
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return get().token !== null;
  },

  // Check if user has a specific role
  hasRole: (role) => {
    const user = get().user;
    if (!user || !user.roles) return false;
    
    if (Array.isArray(role)) {
      return role.some(r => user.roles.includes(r));
    }
    
    return user.roles.includes(role);
  },

  // Check if user has specific permission
  hasPermission: (permission) => {
    const user = get().user;
    if (!user || !user.permissions) return false;
    
    if (Array.isArray(permission)) {
      return permission.some(p => user.permissions.includes(p));
    }
    
    return user.permissions.includes(permission);
  },

  // Clear error message
  clearError: () => {
    set({ error: null });
  }
}));

export default useAuthStore;
