import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  // Block access if no token or no user
  if (!token || !user) {
    // Decide redirect based on path
    const isAdminRoute = location.pathname.startsWith('/admin');
    return <Navigate to={isAdminRoute ? '/admin-login' : '/student-login'} replace />;
  }

  // Note: Email verification check removed to prevent redirect loops
  // Backend should handle email verification requirements
  
  return <>{children}</>;
};

export default RequireAuth;
