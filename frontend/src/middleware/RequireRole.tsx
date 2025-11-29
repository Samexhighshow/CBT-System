import React from 'react';
import { Navigate } from 'react-router-dom';

interface Props {
  roles: string[];
  children: React.ReactNode;
}

const RequireRole: React.FC<Props> = ({ roles, children }) => {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  // Handle both role object array and simple role string
  const userRoles = user?.roles?.map((r: any) => r.name || r) || [];
  const hasRole = userRoles.some((role: string) => roles.includes(role));

  if (!hasRole) {
    return <Navigate to={userRoles.length > 0 ? '/student' : '/'} replace />;
  }

  return <>{children}</>;
};

export default RequireRole;
