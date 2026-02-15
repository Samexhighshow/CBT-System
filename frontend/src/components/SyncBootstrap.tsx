import React, { useEffect } from 'react';
import syncService from '../services/syncService';

const SyncBootstrap: React.FC = () => {
  useEffect(() => {
    syncService.start();
    syncService.syncNow();

    const handleOnline = () => {
      syncService.syncNow();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      syncService.stop();
    };
  }, []);

  return null;
};

export default SyncBootstrap;
