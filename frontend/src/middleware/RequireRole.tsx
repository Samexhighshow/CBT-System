import React from 'react';
import { Navigate } from 'react-router-dom';

interface Props {
  roles: string[];
  children: React.ReactNode;
}

const RequireRole: React.FC<Props> = ({ roles, children }) => {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const userRole = user?.role || user?.roles?.[0] || null;

  if (!userRole || !roles.includes(userRole)) {
    return <Navigate to={userRole ? '/student' : '/'} replace />;
  }

  return <>{children}</>;
};

export default RequireRole;
