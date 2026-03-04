import React, { useEffect } from 'react';
import offlineCacheUpdater from '../services/offlineCacheUpdater';
import { checkReachability } from '../services/reachability';

const VERSION_URL = '/version.json';
const STORAGE_KEY = 'app_build_version';
const PENDING_REFRESH_KEY = 'offline_cache_refresh_pending';

const BuildVersionWatcher: React.FC = () => {
  useEffect(() => {
    let active = true;

    const refreshIfPending = async () => {
      const pending = localStorage.getItem(PENDING_REFRESH_KEY) === 'true';
      if (!pending) {
        return;
      }

      const reachability = await checkReachability();
      if (reachability.status === 'OFFLINE') {
        return;
      }

      await offlineCacheUpdater.refreshAllCachedExamPackages();
      if (active) {
        localStorage.removeItem(PENDING_REFRESH_KEY);
      }
    };

    const checkVersion = async () => {
      try {
        const res = await fetch(VERSION_URL, { cache: 'no-store' });
        if (!res.ok) {
          return;
        }

        const payload = await res.json();
        const version = String(payload?.version || '');
        if (!version) {
          return;
        }

        const previous = localStorage.getItem(STORAGE_KEY);
        if (previous && previous !== version) {
          localStorage.setItem(STORAGE_KEY, version);
          localStorage.setItem(PENDING_REFRESH_KEY, 'true');
          // Keep runtime stable. Do not auto-reload during active sessions.
          window.dispatchEvent(new Event('app_update_ready'));
          return;
        }

        if (!previous) {
          localStorage.setItem(STORAGE_KEY, version);
        }
      } catch (error) {
        console.warn('Failed to check build version:', error);
      }
    };

    refreshIfPending();
    checkVersion();

    const handleOnlineSignal = () => {
      refreshIfPending();
      checkVersion();
    };

    window.addEventListener('online', handleOnlineSignal);
    window.addEventListener('focus', checkVersion);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnlineSignal);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  return null;
};

export default BuildVersionWatcher;
