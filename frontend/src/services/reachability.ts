export type ConnectivityStatus = 'ONLINE' | 'LAN_ONLY' | 'OFFLINE';

const cloudBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const localBaseUrl = (process.env.REACT_APP_LOCAL_API_URL || cloudBaseUrl).replace(/\/$/, '');

const CHECK_TIMEOUT_LOCAL_MS = 4000;
const CHECK_TIMEOUT_CLOUD_MS = 4500;
const CHECK_CACHE_TTL_MS = 10000;
const PROBE_RETRY_COUNT = 1;
const PROBE_RETRY_DELAY_MS = 250;

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

const wait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

const probeWithRetry = async (
  url: string,
  timeoutMs: number,
  retries: number
): Promise<{ ok: boolean; reason?: string }> => {
  let lastReason = '';

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const result = await fetchWithTimeout(url, timeoutMs);
    if (result.ok) {
      return { ok: true };
    }

    lastReason = result.reason || lastReason;
    if (attempt < retries) {
      await wait(PROBE_RETRY_DELAY_MS);
    }
  }

  return { ok: false, reason: lastReason || `unreachable:${url}` };
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
      const result = await probeWithRetry(url, timeoutMs, PROBE_RETRY_COUNT);
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

  // API reachability is the single source of truth for connectivity.
  // Distinguish full online from LAN-only reachability for operational visibility.
  const status: ConnectivityStatus = cloudOk
    ? 'ONLINE'
    : localOk
      ? 'LAN_ONLY'
      : 'OFFLINE';

  return {
    status,
    canReachLocal: localOk,
    canReachCloud: cloudOk,
    reason: status === 'OFFLINE' ? (reason || 'health_check_failed') : undefined,
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

export const getCachedReachability = (): ReachabilityResult | null => lastResult;

export const getReachableBaseUrl = (result: ReachabilityResult): string | null => {
  if (result.canReachCloud) {
    return cloudBaseUrl;
  }
  if (result.canReachLocal) {
    return localBaseUrl;
  }
  return null;
};

export const getBaseUrls = () => ({
  cloudBaseUrl,
  localBaseUrl,
});
