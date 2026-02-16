import React, { useEffect } from 'react';
import syncService from '../services/syncService';
import { checkReachability } from '../services/reachability';

const SyncBootstrap: React.FC = () => {
  useEffect(() => {
    syncService.start();
    syncService.runFullSync().catch(() => undefined);

    const handleMaybeReachable = async () => {
      const state = await checkReachability();
      if (state.status !== 'OFFLINE') {
        syncService.runFullSync().catch(() => undefined);
      }
    };

    window.addEventListener('online', handleMaybeReachable);
    window.addEventListener('focus', handleMaybeReachable);

    return () => {
      window.removeEventListener('online', handleMaybeReachable);
      window.removeEventListener('focus', handleMaybeReachable);
      syncService.stop();
    };
  }, []);

  return null;
};

export default SyncBootstrap;
