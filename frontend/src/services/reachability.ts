export type ConnectivityStatus = 'ONLINE' | 'LAN_ONLY' | 'OFFLINE';

const cloudBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const localBaseUrl = (process.env.REACT_APP_LOCAL_API_URL || cloudBaseUrl).replace(/\/$/, '');

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
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
  const [localOk, cloudOk] = await Promise.all([
    fetchWithTimeout(`${localBaseUrl}/health`, 1500),
    fetchWithTimeout(`${cloudBaseUrl}/health`, 2000),
  ]);

  let status: ConnectivityStatus = 'OFFLINE';
  if (cloudOk) {
    status = 'ONLINE';
  } else if (localOk) {
    status = 'LAN_ONLY';
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
