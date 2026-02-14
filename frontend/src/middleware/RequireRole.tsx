import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface Props {
  roles: string[];
  children: React.ReactNode;
}

const RequireRole: React.FC<Props> = ({ roles, children }) => {
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  // Handle both role object array and simple role string
  const allowedRoles = roles.map((r) => String(r).toLowerCase());
  const userRoles = (user?.roles?.map((r: any) => String(r?.name || r).toLowerCase()) || []);
  const hasRole = userRoles.some((role: string) => allowedRoles.includes(role));

  if (!hasRole) {
    if (userRoles.some((role: string) => ['admin', 'main admin', 'sub-admin', 'sub admin', 'moderator', 'teacher'].includes(role))) {
      return <Navigate to="/admin" replace />;
    }

    if (location.pathname.startsWith('/student')) {
      return <Navigate to="/" replace />;
    }

    return <Navigate to={userRoles.length > 0 ? '/student' : '/'} replace />;
  }

  return <>{children}</>;
};

export default RequireRole;
