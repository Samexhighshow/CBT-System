import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useConnectivity from '../hooks/useConnectivity';

// Routes that work offline
const OFFLINE_ENABLED_ROUTES = [
  '/cbt',
  '/student',
  '/student/exams',
  '/student/results',
  '/student/allocations',
  '/student/announcements',
  '/student/profile',
  '/offline-exam/',
  '/profile',
];

// Routes that require network reachability
const ONLINE_ONLY_ROUTES = [
  '/admin',
  '/register',
];

/**
 * Offline Routing Handler
 * Redirects users from online-only routes when no backend is reachable.
 */
const OfflineRouteHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connectivity = useConnectivity();
  const isOnline = connectivity.status !== 'OFFLINE';
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isOnline) return;

    const currentPath = location.pathname;
    const isOnlineOnlyRoute = ONLINE_ONLY_ROUTES.some((route) => currentPath.startsWith(route));
    if (!isOnlineOnlyRoute) return;

    const user = localStorage.getItem('user');
    const token = localStorage.getItem('auth_token');
    if (user && token) {
      navigate('/student/exams', { replace: true });
    }
  }, [isOnline, navigate, location.pathname]);

  return (
    <>
      {!isOnline && (
        <div className="fixed left-0 right-0 top-0 z-50 bg-yellow-500 px-4 py-2 text-center text-white shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <i className="bx bx-wifi-off" />
            <span className="font-medium">You are currently offline. Some features may be limited.</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-4 rounded bg-white px-3 py-1 text-sm text-yellow-700 transition hover:bg-yellow-50"
              type="button"
            >
              <i className="bx bx-refresh" /> Retry
            </button>
          </div>
        </div>
      )}
      <div className={!isOnline ? 'mt-12' : ''}>{children}</div>
    </>
  );
};

export default OfflineRouteHandler;

/**
 * Check if a route is offline-capable
 */
export const isOfflineRoute = (path: string): boolean => {
  return OFFLINE_ENABLED_ROUTES.some((route) => path.startsWith(route));
};

/**
 * Get the best offline fallback route for current user
 */
export const getOfflineFallbackRoute = (): string => {
  const user = localStorage.getItem('user');
  if (!user) return '/cbt';

  try {
    const userData = JSON.parse(user);
    const roles = userData.roles?.map((r: any) => String(r?.name || r).toLowerCase()) || [];

    if (roles.includes('student')) {
      return '/student/exams';
    }

    return '/cbt';
  } catch {
    return '/cbt';
  }
};
