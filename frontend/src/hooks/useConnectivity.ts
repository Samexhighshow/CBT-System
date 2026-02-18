import { useEffect, useState } from 'react';
import { checkReachability, ReachabilityResult } from '../services/reachability';

const DEFAULT_STATUS: ReachabilityResult = {
  status: navigator.onLine ? 'LAN_ONLY' : 'OFFLINE',
  canReachLocal: navigator.onLine,
  canReachCloud: false,
};

type ConnectivityState = ReachabilityResult & {
  checking: boolean;
  initialized: boolean;
  lastCheckedAt: number | null;
};

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 15_000;

let sharedState: ConnectivityState = {
  ...DEFAULT_STATUS,
  checking: false,
  initialized: false,
  lastCheckedAt: null,
};

const listeners = new Set<(state: ConnectivityState) => void>();
let pollTimer: number | null = null;
let monitorStarted = false;
let browserEventsBound = false;
let activeSubscribers = 0;
let pollIntervalMs = DEFAULT_INTERVAL_MS;

const notifyAll = () => {
  listeners.forEach((listener) => listener(sharedState));
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
    sharedState = {
      ...sharedState,
      ...next,
      checking: false,
      initialized: true,
      lastCheckedAt: Date.now(),
    };
  } catch {
    sharedState = {
      ...sharedState,
      checking: false,
      initialized: true,
      lastCheckedAt: Date.now(),
    };
  }

  notifyAll();
};

const restartPolling = () => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
  }

  pollTimer = window.setInterval(() => {
    void runCheck(false);
  }, pollIntervalMs);
};

const setPollingInterval = (intervalMs: number) => {
  const requested = Number.isFinite(intervalMs) ? intervalMs : DEFAULT_INTERVAL_MS;
  const normalized = Math.max(MIN_INTERVAL_MS, requested);
  const next = Math.min(pollIntervalMs, normalized);

  if (next === pollIntervalMs && pollTimer !== null) {
    return;
  }

  pollIntervalMs = next;
  restartPolling();
};

const handleNetworkSignal = () => {
  void runCheck(true);
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

const startMonitor = (intervalMs: number) => {
  setPollingInterval(intervalMs);
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
  pollIntervalMs = DEFAULT_INTERVAL_MS;
};

const subscribe = (listener: (state: ConnectivityState) => void, intervalMs: number) => {
  activeSubscribers += 1;
  listeners.add(listener);
  listener(sharedState);
  startMonitor(intervalMs);

  return () => {
    listeners.delete(listener);
    activeSubscribers = Math.max(0, activeSubscribers - 1);
    stopMonitorIfIdle();
  };
};

export const useConnectivity = (intervalMs: number = DEFAULT_INTERVAL_MS) => {
  const [state, setState] = useState<ConnectivityState>(sharedState);

  useEffect(() => {
    const unsubscribe = subscribe(setState, intervalMs);
    return () => {
      unsubscribe();
    };
  }, [intervalMs]);

  return state;
};

export default useConnectivity;
