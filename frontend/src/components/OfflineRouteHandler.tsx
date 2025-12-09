import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Routes that work offline
const OFFLINE_ENABLED_ROUTES = [
  '/student/overview',
  '/student/exams',
  '/student/results',
  '/offline-exam/',
  '/profile',
];

// Routes that require online connection
const ONLINE_ONLY_ROUTES = [
  '/admin',
  '/register',
];

/**
 * Offline Routing Handler
 * Redirects users to offline-capable pages when network is unavailable
 */
const OfflineRouteHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Network connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Network connection lost');
      
      // Check if current route requires online connection
      const currentPath = location.pathname;
      const isOnlineOnlyRoute = ONLINE_ONLY_ROUTES.some(route => 
        currentPath.startsWith(route)
      );
      
      // If on online-only route while offline AND user is logged in, redirect to student dashboard
      if (isOnlineOnlyRoute) {
        const user = localStorage.getItem('user');
        const token = localStorage.getItem('auth_token');
        if (user && token) {
          console.log('Offline: Redirecting from online-only route to student dashboard');
          navigate('/student/exams', { replace: true });
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [navigate, location.pathname]);

  // Show offline indicator at top of app when offline
  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white py-2 px-4 text-center z-50 shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <i className='bx bx-wifi-off'></i>
            <span className="font-medium">You are currently offline. Some features may be limited.</span>
            <button 
              onClick={() => window.location.reload()} 
              className="ml-4 px-3 py-1 bg-white text-yellow-600 rounded hover:bg-yellow-50 transition text-sm"
            >
              <i className='bx bx-refresh'></i> Retry
            </button>
          </div>
        </div>
      )}
      <div className={!isOnline ? 'mt-12' : ''}>
        {children}
      </div>
    </>
  );
};

export default OfflineRouteHandler;

/**
 * Check if a route is offline-capable
 */
export const isOfflineRoute = (path: string): boolean => {
  return OFFLINE_ENABLED_ROUTES.some(route => path.startsWith(route));
};

/**
 * Get the best offline fallback route for current user
 */
export const getOfflineFallbackRoute = (): string => {
  const user = localStorage.getItem('user');
  
  if (!user) {
    return '/offline.html';
  }
  
  try {
    const userData = JSON.parse(user);
    const roles = userData.roles?.map((r: any) => r.name || r) || [];
    
    // Students go to exams page
    if (roles.includes('Student')) {
      return '/student/exams';
    }
    
    // Admin/teachers can't access admin features offline
    return '/offline.html';
  } catch {
    return '/offline.html';
  }
};
