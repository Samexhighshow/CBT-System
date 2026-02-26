import { useEffect, useState } from 'react';
import { checkReachability, ReachabilityResult, ConnectivityStatus } from '../services/reachability';

const DEFAULT_STATUS: ReachabilityResult = {
  status: navigator.onLine ? 'LAN_ONLY' : 'OFFLINE',
  canReachLocal: navigator.onLine,
  canReachCloud: false,
  reason: navigator.onLine ? undefined : 'browser_offline',
};

type StableConnectivityStatus = ConnectivityStatus | 'CHECKING';

type ConnectivityState = ReachabilityResult & {
  status: StableConnectivityStatus;
  checking: boolean;
  initialized: boolean;
  lastCheckedAt: number | null;
  failureStreak: number;
  successStreak: number;
};

const NORMAL_INTERVAL_MS = 15000;
const EXAM_INTERVAL_MS = 45000;
const OFFLINE_INTERVAL_MS = 30000;
const MIN_INTERVAL_MS = 15000;
const ONLINE_CONFIRMATION_COUNT = 2;
const OFFLINE_CONFIRMATION_COUNT = 2;
const EXAM_OFFLINE_STICKY_MS = 30000;

let sharedState: ConnectivityState = {
  ...DEFAULT_STATUS,
  status: 'CHECKING',
  checking: false,
  initialized: false,
  lastCheckedAt: null,
  failureStreak: 0,
  successStreak: 0,
};

const listeners = new Set<(state: ConnectivityState) => void>();
let pollTimer: number | null = null;
let monitorStarted = false;
let browserEventsBound = false;
let activeSubscribers = 0;
let currentPollIntervalMs = NORMAL_INTERVAL_MS;
let onlineCandidateSince: number | null = null;

const notifyAll = () => {
  listeners.forEach((listener) => listener(sharedState));
};

const isExamRoute = (): boolean => {
  const path = window.location.pathname;
  return (
    path.startsWith('/cbt/attempt/') ||
    path.startsWith('/offline-exam/') ||
    path.startsWith('/exam/')
  );
};

const isStableReachable = (status: StableConnectivityStatus): boolean =>
  status === 'ONLINE' || status === 'LAN_ONLY';

const computePollInterval = () => {
  if (isExamRoute()) return EXAM_INTERVAL_MS;
  if (sharedState.status === 'OFFLINE') return OFFLINE_INTERVAL_MS;
  return NORMAL_INTERVAL_MS;
};

const restartPolling = (nextIntervalMs?: number) => {
  const requested = Number.isFinite(nextIntervalMs as number)
    ? Number(nextIntervalMs)
    : computePollInterval();
  const normalized = Math.max(MIN_INTERVAL_MS, requested);

  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
  }

  currentPollIntervalMs = normalized;
  pollTimer = window.setInterval(() => {
    void runCheck(false);
  }, currentPollIntervalMs);
};

const resolveStabilizedStatus = (
  probe: ReachabilityResult,
  force: boolean
): StableConnectivityStatus => {
  const candidateReachable = probe.status !== 'OFFLINE';
  const now = Date.now();

  if (candidateReachable) {
    sharedState.successStreak += 1;
    sharedState.failureStreak = 0;
  } else {
    sharedState.failureStreak += 1;
    sharedState.successStreak = 0;
    onlineCandidateSince = null;
  }

  // Sticky offline policy during active exams.
  if (isExamRoute() && sharedState.status === 'OFFLINE' && candidateReachable && !force) {
    if (!onlineCandidateSince) {
      onlineCandidateSince = now;
      return 'OFFLINE';
    }

    if (now - onlineCandidateSince < EXAM_OFFLINE_STICKY_MS) {
      return 'OFFLINE';
    }
  }

  if (candidateReachable) {
    onlineCandidateSince = null;
    if (force || sharedState.successStreak >= ONLINE_CONFIRMATION_COUNT) {
      return probe.status;
    }
    return sharedState.initialized ? sharedState.status : 'CHECKING';
  }

  if (force || sharedState.failureStreak >= OFFLINE_CONFIRMATION_COUNT) {
    return 'OFFLINE';
  }

  return sharedState.initialized ? sharedState.status : 'CHECKING';
};

const runCheck = async (force = false): Promise<void> => {
  if (sharedState.checking && !force) {
    return;
  }

  sharedState = {
    ...sharedState,
    checking: true,
  };
  notifyAll();

  try {
    const next = await checkReachability(force);
    const stabilizedStatus = resolveStabilizedStatus(next, force);

    sharedState = {
      ...sharedState,
      ...next,
      status: stabilizedStatus,
      checking: false,
      initialized: true,
      lastCheckedAt: Date.now(),
      reason: stabilizedStatus === 'OFFLINE' ? (next.reason || sharedState.reason || 'health_check_failed') : undefined,
    };
  } catch {
    const stabilizedStatus = resolveStabilizedStatus({
      status: 'OFFLINE',
      canReachLocal: false,
      canReachCloud: false,
      reason: !navigator.onLine ? 'browser_offline' : 'health_check_failed',
    }, force);

    sharedState = {
      ...sharedState,
      status: stabilizedStatus,
      canReachLocal: false,
      canReachCloud: false,
      reason: !navigator.onLine ? 'browser_offline' : 'health_check_failed',
      checking: false,
      initialized: true,
      lastCheckedAt: Date.now(),
    };
  }

  notifyAll();

  const desiredInterval = computePollInterval();
  if (desiredInterval !== currentPollIntervalMs) {
    restartPolling(desiredInterval);
  }
};

const handleNetworkSignal = () => {
  void runCheck(false);
};

const bindBrowserEvents = () => {
  if (browserEventsBound) {
    return;
  }

  window.addEventListener('online', handleNetworkSignal);
  window.addEventListener('offline', handleNetworkSignal);
  window.addEventListener('focus', handleNetworkSignal);
  browserEventsBound = true;
};

const unbindBrowserEvents = () => {
  if (!browserEventsBound) {
    return;
  }

  window.removeEventListener('online', handleNetworkSignal);
  window.removeEventListener('offline', handleNetworkSignal);
  window.removeEventListener('focus', handleNetworkSignal);
  browserEventsBound = false;
};

const startMonitor = () => {
  restartPolling(computePollInterval());
  bindBrowserEvents();

  if (!monitorStarted) {
    monitorStarted = true;
    void runCheck(true);
  }
};

const stopMonitorIfIdle = () => {
  if (activeSubscribers > 0) {
    return;
  }

  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  unbindBrowserEvents();
  monitorStarted = false;
  currentPollIntervalMs = NORMAL_INTERVAL_MS;
};

const subscribe = (listener: (state: ConnectivityState) => void) => {
  activeSubscribers += 1;
  listeners.add(listener);
  listener(sharedState);
  startMonitor();

  return () => {
    listeners.delete(listener);
    activeSubscribers = Math.max(0, activeSubscribers - 1);
    stopMonitorIfIdle();
  };
};

export const useConnectivity = () => {
  const [state, setState] = useState<ConnectivityState>(sharedState);

  useEffect(() => {
    const unsubscribe = subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    isOnline: isStableReachable(state.status),
  };
};

export default useConnectivity;
