const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const ensureApiSuffix = (value: string): string => {
  const base = stripTrailingSlash(value);
  return /\/api$/i.test(base) ? base : `${base}/api`;
};

const getRuntimeHost = (): string => {
  if (typeof window === 'undefined') {
    return 'localhost';
  }
  return window.location.hostname || 'localhost';
};

const shouldSwapLocalhost = (hostname: string, runtimeHost: string): boolean => {
  if (!LOCAL_HOSTS.has(hostname.toLowerCase())) {
    return false;
  }
  return !LOCAL_HOSTS.has(runtimeHost.toLowerCase());
};

export const resolveApiBaseUrl = (configuredUrl?: string, fallbackPort = 8000): string => {
  const runtimeHost = getRuntimeHost();
  const fallbackUrl = `http://${runtimeHost}:${fallbackPort}`;
  const raw = (configuredUrl || '').trim() || fallbackUrl;

  try {
    const parsed = new URL(raw);

    if (shouldSwapLocalhost(parsed.hostname, runtimeHost)) {
      parsed.hostname = runtimeHost;
    }

    if (!parsed.port) {
      parsed.port = String(fallbackPort);
    }

    return ensureApiSuffix(parsed.toString());
  } catch {
    return ensureApiSuffix(fallbackUrl);
  }
};

export default resolveApiBaseUrl;
