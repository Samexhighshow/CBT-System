import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { NavLinkConfig } from '../config/adminNav';
import useAuthStore from '../store/authStore';

// Cache with TTL
interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache: Record<string, CacheEntry> = {};
const inFlightRequests: Record<string, Promise<any>> = {};
const rateLimitCooldownUntil: Record<string, number> = {};

const REQUEST_CACHE_TTL_MS = 2 * 60 * 1000;
const USER_PAGES_CACHE_TTL_MS = 5 * 60 * 1000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getCachedData = <T = unknown,>(key: string): T | null => {
  const entry = cache[key];
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    delete cache[key];
    return null;
  }

  return entry.data as T;
};

const setCachedData = (key: string, data: unknown, ttl: number = REQUEST_CACHE_TTL_MS) => {
  cache[key] = {
    data,
    timestamp: Date.now(),
    ttl,
  };
};

const fetchWithRetry = async (url: string, retries = 2): Promise<any> => {
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  const responseCacheKey = `req:${normalizedUrl}`;

  const cachedResponse = getCachedData(responseCacheKey);
  if (cachedResponse !== null) {
    return cachedResponse;
  }

  const now = Date.now();
  const cooldownUntil = rateLimitCooldownUntil[normalizedUrl] || 0;
  if (cooldownUntil > now) {
    throw new Error(`Rate limit cooldown is active for ${normalizedUrl}`);
  }

  if (inFlightRequests[normalizedUrl]) {
    return inFlightRequests[normalizedUrl];
  }

  const requestPromise = (async () => {
    let lastError: any = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await api.get(normalizedUrl, { skipGlobalLoading: true } as any);
        setCachedData(responseCacheKey, response.data, REQUEST_CACHE_TTL_MS);
        delete rateLimitCooldownUntil[normalizedUrl];
        return response.data;
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;

        if (status === 429) {
          const retryAfterRaw = err?.response?.headers?.['retry-after'];
          const retryAfterSeconds = Number.parseInt(String(retryAfterRaw || ''), 10);
          const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : 0;
          const exponentialBackoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
          const waitMs = Math.max(exponentialBackoffMs, retryAfterMs, 1500);

          rateLimitCooldownUntil[normalizedUrl] = Date.now() + waitMs;

          if (attempt < retries) {
            await sleep(waitMs);
            continue;
          }
        }

        throw err;
      }
    }

    throw lastError;
  })().finally(() => {
    delete inFlightRequests[normalizedUrl];
  });

  inFlightRequests[normalizedUrl] = requestPromise;
  return requestPromise;
};

export const useRoleBasedNav = () => {
  const user = useAuthStore((state) => state.user);
  const [userPages, setUserPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = user?.id || null;
  const roleSignature = useMemo(() => {
    const names = (user?.roles || [])
      .map((role: any) => String(role?.name || role || '').trim())
      .filter(Boolean)
      .sort();
    return names.join('|');
  }, [user?.roles]);

  useEffect(() => {
    let isMounted = true;

    const loadUserPages = async () => {
      if (!userId) {
        if (isMounted) {
          setUserPages([]);
          setLoading(false);
        }
        return;
      }

      const roleNames = roleSignature ? roleSignature.split('|') : [];
      const userPagesCacheKey = `userPages:${userId}:${roleSignature || 'no-roles'}`;
      const cachedUserPages = getCachedData<string[]>(userPagesCacheKey);
      if (cachedUserPages) {
        if (isMounted) {
          setUserPages(cachedUserPages);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
      }

      try {
        const [pagesResponse, roleMapData, allRoles] = await Promise.all([
          fetchWithRetry('/admin/pages'),
          fetchWithRetry('/admin/pages/role-map'),
          fetchWithRetry('/admin/roles'),
        ]);

        const pages = pagesResponse?.pages || [];
        const roleMap: Record<number, number[]> = {};
        (roleMapData || []).forEach((item: { role_id: number; page_ids: number[] }) => {
          roleMap[item.role_id] = item.page_ids;
        });

        const accessiblePageIds = new Set<number>();
        roleNames.forEach((roleName) => {
          const role = (allRoles || []).find((entry: any) => entry.name === roleName);
          if (role?.id && roleMap[role.id]) {
            roleMap[role.id].forEach((pageId) => accessiblePageIds.add(pageId));
          }
        });

        const accessiblePages = pages
          .filter((page: any) => accessiblePageIds.has(page.id))
          .map((page: any) => page.name);

        setCachedData(userPagesCacheKey, accessiblePages, USER_PAGES_CACHE_TTL_MS);
        if (isMounted) {
          setUserPages(accessiblePages);
        }
      } catch (err) {
        console.error('Failed to load user pages:', err);
        if (isMounted) {
          // Keep fail-open behavior if permissions endpoint is unavailable.
          setUserPages([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUserPages();

    return () => {
      isMounted = false;
    };
  }, [userId, roleSignature]);

  // Filter navigation links based on user permissions
  const filterNavLinks = useCallback((navLinks: NavLinkConfig[]): NavLinkConfig[] => {
    if (userPages.length === 0) return navLinks;
    const canAccess = (link: NavLinkConfig) => userPages.includes(link.permissionName || link.name);

    return navLinks
      .map((link) => {
        if (!link.subItems) {
          return canAccess(link) ? link : null;
        }

        const subItems = link.subItems.filter((sub) => canAccess(sub));
        if (subItems.length === 0) return null;

        return { ...link, subItems };
      })
      .filter((link): link is NavLinkConfig => Boolean(link));
  }, [userPages]);

  return { userPages, loading, filterNavLinks };
};
