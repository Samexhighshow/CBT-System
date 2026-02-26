import React from 'react';
import { Navigate } from 'react-router-dom';
import Loading from '../components/Loading';
import useAuthStore from '../store/authStore';
import { useRoleBasedNav } from '../hooks/useRoleBasedNav';

interface Props {
  permissionName: string;
  children: React.ReactNode;
  fallbackPath?: string;
}

const RequirePagePermission: React.FC<Props> = ({ permissionName, children, fallbackPath = '/admin/forbidden' }) => {
  const user = useAuthStore((state) => state.user);
  const { loading, canAccessPage } = useRoleBasedNav();

  if (!user) {
    return <Navigate to="/admin-login" replace />;
  }

  if (loading) {
    return <Loading fullScreen message="Checking permissions..." />;
  }

  if (!canAccessPage(permissionName)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default RequirePagePermission;
