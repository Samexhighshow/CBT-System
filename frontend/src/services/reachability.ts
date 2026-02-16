export type ConnectivityStatus = 'ONLINE' | 'LAN_ONLY' | 'OFFLINE';

const cloudBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const localBaseUrl = (process.env.REACT_APP_LOCAL_API_URL || cloudBaseUrl).replace(/\/$/, '');

const CHECK_TIMEOUT_LOCAL_MS = 4500;
const CHECK_TIMEOUT_CLOUD_MS = 5500;
const GRACE_WINDOW_MS = 30000;

let lastKnownOnlineAt = 0;
let lastKnownStatus: ConnectivityStatus = 'OFFLINE';

const buildHealthUrls = (baseUrl: string): string[] => {
  const urls = new Set<string>();
  const base = baseUrl.replace(/\/$/, '');

  urls.add(`${base}/health`);

  if (!base.endsWith('/api')) {
    urls.add(`${base}/api/health`);
  } else {
    const root = base.replace(/\/api$/, '');
    urls.add(`${root}/api/health`);
    urls.add(`${root}/health`);
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
    return response.ok;
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

export const checkReachability = async (): Promise<ReachabilityResult> => {
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

  const [localOk, cloudOk] = await Promise.all([
    checkAny(localHealthUrls, CHECK_TIMEOUT_LOCAL_MS),
    checkAny(cloudHealthUrls, CHECK_TIMEOUT_CLOUD_MS),
  ]);

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
