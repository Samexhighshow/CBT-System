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

const fetchWithTimeout = async (
  url: string,
  timeoutMs: number
): Promise<{ ok: boolean; reason?: string }> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    // Any HTTP response means backend is reachable.
    return { ok: response.status > 0 };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { ok: false, reason: `timeout:${url}` };
    }
    return { ok: false, reason: `unreachable:${url}` };
  } finally {
    window.clearTimeout(timeout);
  }
};

export interface ReachabilityResult {
  status: ConnectivityStatus;
  canReachLocal: boolean;
  canReachCloud: boolean;
  reason?: string;
}

const runReachabilityCheck = async (): Promise<ReachabilityResult> => {
  const localHealthUrls = buildHealthUrls(localBaseUrl);
  const cloudHealthUrls = buildHealthUrls(cloudBaseUrl);

  const checkAny = async (
    urls: string[],
    timeoutMs: number
  ): Promise<{ ok: boolean; reason?: string }> => {
    let lastReason = '';
    for (const url of urls) {
      const result = await fetchWithTimeout(url, timeoutMs);
      if (result.ok) {
        return { ok: true };
      }
      lastReason = result.reason || lastReason;
    }
    return { ok: false, reason: lastReason || 'unreachable' };
  };

  const sameEndpoint =
    localBaseUrl.toLowerCase() === cloudBaseUrl.toLowerCase() &&
    JSON.stringify(localHealthUrls) === JSON.stringify(cloudHealthUrls);

  let localOk = false;
  let cloudOk = false;
  let reason = '';

  if (sameEndpoint) {
    const result = await checkAny(cloudHealthUrls, Math.max(CHECK_TIMEOUT_LOCAL_MS, CHECK_TIMEOUT_CLOUD_MS));
    localOk = result.ok;
    cloudOk = result.ok;
    reason = result.reason || '';
  } else {
    const [localResult, cloudResult] = await Promise.all([
      checkAny(localHealthUrls, CHECK_TIMEOUT_LOCAL_MS),
      checkAny(cloudHealthUrls, CHECK_TIMEOUT_CLOUD_MS),
    ]);
    localOk = localResult.ok;
    cloudOk = cloudResult.ok;
    reason = cloudResult.reason || localResult.reason || '';
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
    reason: status === 'OFFLINE'
      ? (!navigator.onLine ? 'browser_offline' : (reason || 'health_check_failed'))
      : undefined,
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
