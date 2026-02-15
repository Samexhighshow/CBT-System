import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { NavLinkConfig } from '../config/adminNav';
import useAuthStore from '../store/authStore';

export const useRoleBasedNav = () => {
  const { user } = useAuthStore();
  const [userPages, setUserPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user's accessible pages based on their role
  const loadUserPages = useCallback(async () => {
    if (!user) {
      setUserPages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Get all pages
      const pagesRes = await api.get('/admin/pages');
      const pages = pagesRes.data?.pages || [];

      // Get role-page mappings
      const roleMapRes = await api.get('/admin/pages/role-map');
      const roleMap: Record<number, number[]> = {};
      (roleMapRes.data || []).forEach((item: { role_id: number; page_ids: number[] }) => {
        roleMap[item.role_id] = item.page_ids;
      });

      // Get user's roles and their permissions
      const userRoleNames = user.roles?.map((r: any) => r.name || r) || [];
      
      // Get all roles from backend
      const rolesRes = await api.get('/admin/roles');
      const allRoles = rolesRes.data || [];
      
      // Find permission page IDs for user's roles
      const accessiblePageIds = new Set<number>();
      
      for (const roleName of userRoleNames) {
        const role = allRoles.find((r: any) => r.name === roleName);
        if (role && roleMap[role.id]) {
          roleMap[role.id].forEach(pageId => accessiblePageIds.add(pageId));
        }
      }

      // Get page names for accessible page IDs
      const accessiblePages = pages
        .filter((p: any) => accessiblePageIds.has(p.id))
        .map((p: any) => p.name);

      console.log('User accessible pages:', accessiblePages);
      setUserPages(accessiblePages);
    } catch (err) {
      console.error('Failed to load user pages:', err);
      // Default to all pages if there's an error (fail open)
      setUserPages([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserPages();
  }, [loadUserPages]);

  // Filter navigation links based on user permissions
  const filterNavLinks = (navLinks: NavLinkConfig[]): NavLinkConfig[] => {
    if (userPages.length === 0) {
      return navLinks;
    }

    return navLinks
      .map(link => {
        if (!link.subItems) {
          return userPages.includes(link.name) ? link : null;
        }

        const subItems = link.subItems.filter(sub => userPages.includes(sub.name));
        if (subItems.length === 0) return null;

        return { ...link, subItems };
      })
      .filter((link): link is NavLinkConfig => Boolean(link));
  };

  return { userPages, loading, filterNavLinks };
};
