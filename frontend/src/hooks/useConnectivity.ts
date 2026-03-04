import { useEffect, useState } from 'react';
import { checkReachability, ReachabilityResult, ConnectivityStatus } from '../services/reachability';

const DEFAULT_STATUS: ReachabilityResult = {
  status: 'OFFLINE',
  canReachLocal: false,
  canReachCloud: false,
  reason: undefined,
};

type StableConnectivityStatus = ConnectivityStatus | 'CHECKING';

type ConnectivityState = ReachabilityResult & {
  status: StableConnectivityStatus;
  checking: boolean;
  initialized: boolean;
  lastCheckedAt: number | null;
  lastReachableAt: number | null;
  failureStreak: number;
  successStreak: number;
  reconnectPending: boolean;
};

const NORMAL_INTERVAL_MS = 20000;
const EXAM_INTERVAL_MS = 45000;
const OFFLINE_INTERVAL_MS = 45000;
const MIN_INTERVAL_MS = 10000;
const ONLINE_CONFIRMATION_COUNT = 2;
const OFFLINE_CONFIRMATION_COUNT = 2;
const OFFLINE_TRANSITION_GRACE_MS = 25000;

let sharedState: ConnectivityState = {
  ...DEFAULT_STATUS,
  status: 'CHECKING',
  checking: false,
  initialized: false,
  lastCheckedAt: null,
  lastReachableAt: null,
  failureStreak: 0,
  successStreak: 0,
  reconnectPending: false,
};

const listeners = new Set<(state: ConnectivityState) => void>();
let pollTimer: number | null = null;
let monitorStarted = false;
let browserEventsBound = false;
let activeSubscribers = 0;
let currentPollIntervalMs = NORMAL_INTERVAL_MS;
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

  if (candidateReachable) {
    sharedState.successStreak += 1;
    sharedState.failureStreak = 0;
    sharedState.lastReachableAt = Date.now();
  } else {
    sharedState.failureStreak += 1;
    sharedState.successStreak = 0;
    sharedState.reconnectPending = false;

    const withinGracePeriod = !!sharedState.lastReachableAt
      && (Date.now() - sharedState.lastReachableAt) < OFFLINE_TRANSITION_GRACE_MS;
    if (!force && withinGracePeriod) {
      return sharedState.initialized ? sharedState.status : 'CHECKING';
    }
  }

  // Offline lock during active attempts:
  // if exam route is active and we are already offline, keep offline until manual retry.
  if (!force && isExamRoute() && sharedState.status === 'OFFLINE' && candidateReachable) {
    sharedState.reconnectPending = true;
    return 'OFFLINE';
  }

  if (candidateReachable) {
    sharedState.reconnectPending = false;
    if (sharedState.successStreak >= ONLINE_CONFIRMATION_COUNT) {
      return probe.status;
    }
    return sharedState.initialized ? sharedState.status : 'CHECKING';
  }

  if (sharedState.failureStreak >= OFFLINE_CONFIRMATION_COUNT) {
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
      reason: 'health_check_failed',
    }, force);

    sharedState = {
      ...sharedState,
      status: stabilizedStatus,
      canReachLocal: false,
      canReachCloud: false,
      reason: 'health_check_failed',
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
    void runCheck(true).then(() => {
      if (sharedState.status === 'CHECKING') {
        window.setTimeout(() => {
          void runCheck(true);
        }, 1200);
      }
    });
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

export const refreshConnectivity = async (): Promise<ConnectivityState> => {
  await runCheck(true);
  return sharedState;
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
    refresh: refreshConnectivity,
  };
};

export default useConnectivity;
