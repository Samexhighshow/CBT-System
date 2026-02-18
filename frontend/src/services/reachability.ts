export type ConnectivityStatus = 'ONLINE' | 'LAN_ONLY' | 'OFFLINE';

const cloudBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const localBaseUrl = (process.env.REACT_APP_LOCAL_API_URL || cloudBaseUrl).replace(/\/$/, '');

const CHECK_TIMEOUT_LOCAL_MS = 4500;
const CHECK_TIMEOUT_CLOUD_MS = 5500;
const GRACE_WINDOW_MS = 30000;
const CHECK_CACHE_TTL_MS = 4000;

let lastKnownOnlineAt = 0;
let lastKnownStatus: ConnectivityStatus = 'OFFLINE';
let lastCheckAt = 0;
let lastResult: ReachabilityResult | null = null;
let inFlightCheck: Promise<ReachabilityResult> | null = null;

const buildHealthUrls = (baseUrl: string): string[] => {
  const urls = new Set<string>();
  const base = baseUrl.replace(/\/$/, '');

  // Always use /api/health endpoint
  if (!base.endsWith('/api')) {
    urls.add(`${base}/api/health`);
  } else {
    urls.add(`${base}/health`);
  }

  return Array.from(urls);
};

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    // Any HTTP response means the backend is reachable.
    // Non-2xx (e.g. 401/403/404/429/500) should not be treated as offline.
    return response.status > 0;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
};

export interface ReachabilityResult {
  status: ConnectivityStatus;
  canReachLocal: boolean;
  canReachCloud: boolean;
}

const runReachabilityCheck = async (): Promise<ReachabilityResult> => {
  const localHealthUrls = buildHealthUrls(localBaseUrl);
  const cloudHealthUrls = buildHealthUrls(cloudBaseUrl);

  const checkAny = async (urls: string[], timeoutMs: number): Promise<boolean> => {
    for (const url of urls) {
      const ok = await fetchWithTimeout(url, timeoutMs);
      if (ok) {
        return true;
      }
    }
    return false;
  };

  const sameEndpoint =
    localBaseUrl.toLowerCase() === cloudBaseUrl.toLowerCase() &&
    JSON.stringify(localHealthUrls) === JSON.stringify(cloudHealthUrls);

  let localOk = false;
  let cloudOk = false;

  if (sameEndpoint) {
    const ok = await checkAny(cloudHealthUrls, Math.max(CHECK_TIMEOUT_LOCAL_MS, CHECK_TIMEOUT_CLOUD_MS));
    localOk = ok;
    cloudOk = ok;
  } else {
    [localOk, cloudOk] = await Promise.all([
      checkAny(localHealthUrls, CHECK_TIMEOUT_LOCAL_MS),
      checkAny(cloudHealthUrls, CHECK_TIMEOUT_CLOUD_MS),
    ]);
  }

  let status: ConnectivityStatus = 'OFFLINE';
  if (cloudOk) {
    status = 'ONLINE';
  } else if (localOk) {
    status = 'LAN_ONLY';
  } else if (navigator.onLine && Date.now() - lastKnownOnlineAt < GRACE_WINDOW_MS) {
    status = lastKnownStatus === 'OFFLINE' ? 'LAN_ONLY' : lastKnownStatus;
  }

  if (status !== 'OFFLINE') {
    lastKnownOnlineAt = Date.now();
    lastKnownStatus = status;
  }

  return {
    status,
    canReachLocal: localOk,
    canReachCloud: cloudOk,
  };
};

export const checkReachability = async (force = false): Promise<ReachabilityResult> => {
  const now = Date.now();

  if (!force && lastResult && now - lastCheckAt < CHECK_CACHE_TTL_MS) {
    return lastResult;
  }

  if (!force && inFlightCheck) {
    return inFlightCheck;
  }

  inFlightCheck = runReachabilityCheck()
    .then((result) => {
      lastResult = result;
      lastCheckAt = Date.now();
      return result;
    })
    .finally(() => {
      inFlightCheck = null;
    });

  return inFlightCheck;
};

export const getReachableBaseUrl = (result: ReachabilityResult): string | null => {
  if (result.status === 'ONLINE') {
    return cloudBaseUrl;
  }
  if (result.status === 'LAN_ONLY') {
    return localBaseUrl;
  }
  return null;
};

export const getBaseUrls = () => ({
  cloudBaseUrl,
  localBaseUrl,
});
