import { useEffect, useState } from 'react';
import { checkReachability, ReachabilityResult } from '../services/reachability';

const DEFAULT_STATUS: ReachabilityResult = {
  status: navigator.onLine ? 'LAN_ONLY' : 'OFFLINE',
  canReachLocal: navigator.onLine,
  canReachCloud: false,
};

export const useConnectivity = (intervalMs: number = 30000) => {
  const [result, setResult] = useState<ReachabilityResult>(DEFAULT_STATUS);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;

    const runCheck = async () => {
      setChecking(true);
      const next = await checkReachability();
      if (mounted) {
        setResult(next);
        setChecking(false);
      }
    };

    runCheck();
    const interval = window.setInterval(runCheck, intervalMs);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [intervalMs]);

  return { ...result, checking };
};

export default useConnectivity;
