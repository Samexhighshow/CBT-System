import React, { useEffect } from 'react';
import offlineCacheUpdater from '../services/offlineCacheUpdater';

const VERSION_URL = '/version.json';
const STORAGE_KEY = 'app_build_version';
const PENDING_REFRESH_KEY = 'offline_cache_refresh_pending';

const BuildVersionWatcher: React.FC = () => {
  useEffect(() => {
    let active = true;

    const refreshIfPending = async () => {
      const pending = localStorage.getItem(PENDING_REFRESH_KEY) === 'true';
      if (!pending || !navigator.onLine) {
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

          if (navigator.onLine) {
            window.location.reload();
          }
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

    const handleOnline = () => {
      refreshIfPending();
      checkVersion();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', checkVersion);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  return null;
};

export default BuildVersionWatcher;