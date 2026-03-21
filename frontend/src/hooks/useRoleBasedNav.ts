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

const ROLE_PAGE_FALLBACKS: Record<string, string[]> = {
  // Keep Exams in teacher fallback so Assessments submenu does not disappear
  // during transient /admin/me/pages failures.
  'teacher': ['Overview', 'Questions', 'Exams', 'Results & Marking', 'Marking Workbench'],
  'moderator': ['Overview', 'Exams', 'Exam Access', 'Students', 'Results & Marking', 'Marking Workbench'],
  'sub-admin': ['Overview', 'Questions', 'Exams', 'Exam Access', 'Students', 'Results & Marking', 'Marking Workbench', 'Academic Management', 'Announcements'],
  'sub admin': ['Overview', 'Questions', 'Exams', 'Exam Access', 'Students', 'Results & Marking', 'Marking Workbench', 'Academic Management', 'Announcements'],
  'admin': ['Overview', 'Questions', 'Exams', 'Exam Access', 'Students', 'Results & Marking', 'Marking Workbench', 'Academic Management', 'Announcements', 'Offline Sync'],
};

const normalizePermissionName = (value: string): string => String(value || '').trim().toLowerCase();

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
  const [permissionsVersion, setPermissionsVersion] = useState<number>(() => {
    const raw = localStorage.getItem('rbac_nav_version');
    const parsed = Number.parseInt(String(raw || '0'), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const userId = user?.id || null;
  const roleSignature = useMemo(() => {
    const names = (user?.roles || [])
      .map((role: any) => String(role?.name || role || '').trim())
      .filter(Boolean)
      .sort();
    return names.join('|');
  }, [user?.roles]);
  const roleNames = useMemo(() => {
    return (user?.roles || [])
      .map((role: any) => String(role?.name || role || '').trim().toLowerCase())
      .filter(Boolean);
  }, [user?.roles]);

  const fallbackPagesFromRoles = useMemo(() => {
    const pages = new Set<string>();
    roleNames.forEach((roleName) => {
      const defaults = ROLE_PAGE_FALLBACKS[roleName] || [];
      defaults.forEach((name) => pages.add(name));
    });
    return Array.from(pages);
  }, [roleNames]);
  const isMainAdmin = useMemo(() => {
    return (user?.roles || []).some(
      (role: any) => String(role?.name || role || '').trim().toLowerCase() === 'main admin'
    );
  }, [user?.roles]);

  useEffect(() => {
    const handlePermissionsUpdated = () => {
      const raw = localStorage.getItem('rbac_nav_version');
      const parsed = Number.parseInt(String(raw || '0'), 10);
      setPermissionsVersion(Number.isFinite(parsed) ? parsed : 0);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'rbac_nav_version') {
        handlePermissionsUpdated();
      }
    };

    window.addEventListener('rbac-permissions-updated', handlePermissionsUpdated as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('rbac-permissions-updated', handlePermissionsUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let fallbackTimer: number | null = null;

    const loadUserPages = async () => {
      if (!userId) {
        if (isMounted) {
          setUserPages([]);
          setLoading(false);
        }
        return;
      }

      const userPagesCacheKey = `userPages:${userId}:${roleSignature || 'no-roles'}:v${permissionsVersion}`;
      const persistedPagesKey = `rbac_user_pages:${userId}:${roleSignature || 'no-roles'}`;
      const cachedUserPages = getCachedData<string[]>(userPagesCacheKey);
      if (cachedUserPages) {
        if (isMounted) {
          setUserPages(cachedUserPages);
          setLoading(false);
        }
        return;
      }

      const persistedRaw = localStorage.getItem(persistedPagesKey);
      if (persistedRaw && isMounted) {
        try {
          const parsed = JSON.parse(persistedRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUserPages(parsed.map((item) => String(item)).filter(Boolean));
          }
        } catch {
          // ignore invalid persisted payload
        }
      }

      if (isMounted) {
        setLoading(true);
        // Prevent indefinite loading if any permission endpoint hangs.
        fallbackTimer = window.setTimeout(() => {
          if (!isMounted) return;
          setLoading(false);
          setUserPages([]);
        }, 12000);
      }

      try {
        const myPagesResponse = await fetchWithRetry('/admin/me/pages');
        const accessiblePages = (myPagesResponse?.pages || [])
          .map((page: any) => String(page?.name || '').trim())
          .filter(Boolean);

        const effectivePages = accessiblePages.length > 0
          ? accessiblePages
          : fallbackPagesFromRoles;

        setCachedData(userPagesCacheKey, effectivePages, USER_PAGES_CACHE_TTL_MS);
        try {
          localStorage.setItem(persistedPagesKey, JSON.stringify(effectivePages));
        } catch {
          // ignore storage failures
        }
        if (isMounted) {
          setUserPages(effectivePages);
        }
      } catch (err) {
        console.error('Failed to load user pages:', err);
        if (isMounted) {
          // Prefer last known granted pages for this user; fallback to role defaults if absent.
          const persistedOnErrorRaw = localStorage.getItem(persistedPagesKey);
          if (persistedOnErrorRaw) {
            try {
              const parsed = JSON.parse(persistedOnErrorRaw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setUserPages(parsed.map((item) => String(item)).filter(Boolean));
              } else {
                setUserPages(fallbackPagesFromRoles);
              }
            } catch {
              setUserPages(fallbackPagesFromRoles);
            }
          } else {
            setUserPages(fallbackPagesFromRoles);
          }
        }
      } finally {
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUserPages();

    return () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      isMounted = false;
    };
  }, [userId, roleSignature, permissionsVersion, fallbackPagesFromRoles]);

  // Filter navigation links based on user permissions
  const filterNavLinks = useCallback((navLinks: NavLinkConfig[]): NavLinkConfig[] => {
    if (isMainAdmin) return navLinks;
    if (userPages.length === 0) return [];
    const grantedPages = new Set(userPages.map((name) => normalizePermissionName(name)));
    const canAccess = (link: NavLinkConfig) =>
      grantedPages.has(normalizePermissionName(link.permissionName || link.name));

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
  }, [isMainAdmin, userPages]);

  const canAccessPage = useCallback((permissionName: string) => {
    if (isMainAdmin) return true;
    const grantedPages = new Set(userPages.map((name) => normalizePermissionName(name)));
    return grantedPages.has(normalizePermissionName(permissionName));
  }, [isMainAdmin, userPages]);

  return { userPages, loading, filterNavLinks, canAccessPage, isMainAdmin };
};
