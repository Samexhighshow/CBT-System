import React from 'react';
import useConnectivity, { refreshConnectivity } from '../hooks/useConnectivity';

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

/**
 * Offline Routing Handler
 * Shows offline status only; does not control routing.
 */
const OfflineRouteHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connectivity = useConnectivity();
  const isOnline = connectivity.status === 'ONLINE' || connectivity.status === 'LAN_ONLY';
  const showOfflineBanner = !isOnline && connectivity.initialized && !connectivity.checking;

  const reasonText =
    connectivity.reason?.startsWith('timeout:')
      ? 'Server health check timed out.'
      : connectivity.reason?.startsWith('unreachable:')
        ? 'Server is unreachable (network/CORS/API URL issue).'
        : 'Backend health check failed.';

  return (
    <>
      {showOfflineBanner && (
        <div className="fixed left-0 right-0 top-0 z-50 bg-yellow-500 px-4 py-2 text-center text-white shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <i className="bx bx-wifi-off" />
            <span className="font-medium">You are currently offline. Some features may be limited.</span>
            <span className="hidden text-xs opacity-90 md:inline">({reasonText})</span>
            <button
              onClick={() => { void refreshConnectivity(); }}
              className="ml-4 rounded bg-white px-3 py-1 text-sm text-yellow-700 transition hover:bg-yellow-50"
              type="button"
            >
              <i className="bx bx-refresh" /> Retry
            </button>
          </div>
        </div>
      )}
      <div className={showOfflineBanner ? 'mt-12' : ''}>{children}</div>
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

    if (roles.some((role: string) => ['admin', 'main admin', 'teacher'].includes(role))) {
      return '/cbt';
    }

    return '/cbt';
  } catch {
    return '/cbt';
  }
};
