import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { showSuccess, showError, showConfirm } from '../../utils/alerts';
import { Card } from '../../components';
import { adminNavLinks } from '../../config/adminNav';

interface Role {
  id?: number;
  name: string;
  users_count?: number;
  permissions_count?: number;
}
interface User { id: number; name: string; email: string; email_verified_at?: string | null; roles: Role[]; }
interface ScopeOption { id: number; name: string; }
interface RoleScopeRecord {
  id: number;
  user_id: number;
  role_name?: string | null;
  status?: 'pending' | 'approved' | 'rejected' | string;
  subject_id?: number | null;
  class_id?: number | null;
  exam_id?: number | null;
  academic_session?: string | null;
  term?: string | null;
  is_active: boolean;
  user?: { id: number; name: string; email: string };
  subject?: { id: number; name: string; code?: string };
  school_class?: { id: number; name: string };
  exam?: { id: number; title: string };
  rejected_reason?: string | null;
}

interface TeacherScopeRequest {
  batch_id: string;
  user: { id: number; name: string; email: string };
  reason: string;
  requested_at: string;
  requested_scopes: Array<{
    id: number;
    subject_id: number;
    subject_name: string;
    class_id: number;
    class_name: string;
  }>;
  current_approved_scopes: Array<{
    id: number;
    subject_id: number;
    subject_name: string;
    class_id: number;
    class_name: string;
  }>;
}

const hasStudentRole = (user: User): boolean =>
  (user.roles || []).some((role) => String(role?.name || '').toLowerCase() === 'student');

const CORE_ADMIN_ROLE_NAMES = ['Main Admin', 'Admin', 'Teacher'];
const PROTECTED_ROLE_NAMES = ['Main Admin', 'Student'];

const ROLE_DISPLAY_PRIORITY: Record<string, number> = {
  'teacher': 0,
  'admin': 1,
  'main admin': 2,
};

const compareRoleNames = (left: string, right: string): number => {
  const leftKey = String(left || '').trim().toLowerCase();
  const rightKey = String(right || '').trim().toLowerCase();
  const leftPriority = ROLE_DISPLAY_PRIORITY[leftKey] ?? 999;
  const rightPriority = ROLE_DISPLAY_PRIORITY[rightKey] ?? 999;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.localeCompare(right);
};

const normalizeList = <T,>(payload: any, keys: string[] = []): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && Array.isArray(payload.data)) return payload.data as T[];
  for (const key of keys) {
    if (payload && Array.isArray(payload[key])) return payload[key] as T[];
  }
  return [];
};

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [scopeUsers, setScopeUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyApplicants, setOnlyApplicants] = useState(true);
  const [showRoleDetails, setShowRoleDetails] = useState(false);
  const [syncingPages, setSyncingPages] = useState(false);
  const [syncingRoleDefaults, setSyncingRoleDefaults] = useState(false);
  const [roleModulesState, setRoleModulesState] = useState<Record<string, string[]>>({});
  const [permissionPages, setPermissionPages] = useState<Array<{ id: number; name: string; path: string; category?: string }>>([]);
  const [rolePermissionsLoaded, setRolePermissionsLoaded] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [roleScopes, setRoleScopes] = useState<RoleScopeRecord[]>([]);
  const [roleScopesLoading, setRoleScopesLoading] = useState(false);
  const [roleScopeSaving, setRoleScopeSaving] = useState(false);
  const [updatingScopeId, setUpdatingScopeId] = useState<number | null>(null);
  const [scopeStatusFilter, setScopeStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [scopeTab, setScopeTab] = useState<'requests' | 'active' | 'assign'>('requests');
  const [scopeSubjects, setScopeSubjects] = useState<ScopeOption[]>([]);
  const [scopeClasses, setScopeClasses] = useState<ScopeOption[]>([]);
  const [scopeExams, setScopeExams] = useState<ScopeOption[]>([]);
  const [pendingScopeRequests, setPendingScopeRequests] = useState<TeacherScopeRequest[]>([]);
  const [scopeSearch, setScopeSearch] = useState('');
  const [editingScopeId, setEditingScopeId] = useState<number | null>(null);
  const [scopeForm, setScopeForm] = useState({
    user_id: '',
    role_name: 'teacher',
    subject_id: '',
    class_id: '',
    exam_id: '',
    academic_session: '',
    term: '',
    is_active: true,
  });
  const bumpNavPermissionVersion = useCallback(() => {
    const current = Number.parseInt(String(localStorage.getItem('rbac_nav_version') || '0'), 10);
    const next = (Number.isFinite(current) ? current : 0) + 1;
    localStorage.setItem('rbac_nav_version', String(next));
    window.dispatchEvent(new Event('rbac-permissions-updated'));
  }, []);
  
  // Get current logged-in user info
  const currentUser = (() => {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  })();
  const currentUserId = currentUser?.id ?? null;
  const isMainAdmin = Boolean(
    currentUser?.roles?.some((role: any) => String(role?.name || role).toLowerCase() === 'main admin')
  );

  // Use shared api client which injects `auth_token` automatically
  const [editMode, setEditMode] = useState(false);
  
  const flatNavPages = useMemo(() => {
    const items: { name: string; path: string; category?: string }[] = [];
    adminNavLinks.forEach((nav) => {
      if (!nav.subItems) {
        items.push({ name: nav.name, path: nav.path, category: undefined });
      }
      if (nav.subItems) {
        nav.subItems.forEach((sub) => items.push({ name: sub.name, path: sub.path, category: nav.name }));
      }
    });
    // Add hidden pages (System Settings and Activity Logs) for role permission system
    items.push({ name: 'System Settings', path: '/admin/settings', category: undefined });
    items.push({ name: 'Activity Logs', path: '/admin/activity-logs', category: undefined });
    return items;
  }, []);

  const fallbackModules = useMemo(() => {
    return Array.from(
      new Set(
        flatNavPages
          .map((item) => String(item.name || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [flatNavPages]);

  // Extract available modules from canonical synced permission pages (fallback to nav-derived modules)
  const availableModules = useMemo(() => {
    const fromPermissions = permissionPages
      .map((page) => String(page.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return fromPermissions.length > 0 ? fromPermissions : fallbackModules;
  }, [permissionPages, fallbackModules]);

  const loadRolePermissions = useCallback(async () => {
    try {
      setRolePermissionsLoaded(false);

      const matrixRes = await api.get('/admin/roles/modules-matrix');
      const matrix = matrixRes?.data || {};

      const rolesData = normalizeList<{ id: number; name: string }>(matrix.roles, ['roles']);
      const pages = normalizeList<any>(matrix.pages, ['pages']);
      const roleModules = (matrix.role_modules || {}) as Record<string, string[]>;

      if (rolesData.length > 0) {
        setRoles(rolesData);
      }

      setPermissionPages(
        pages.map((page: any) => ({
          id: Number(page.id),
          name: String(page.name || ''),
          path: String(page.path || ''),
          category: page.category || undefined,
        }))
      );

      const newRoleModules: Record<string, string[]> = {};
      rolesData.forEach((role) => {
        const roleName = String(role.name || '').trim();
        if (!roleName) return;
        newRoleModules[roleName] = Array.isArray(roleModules[roleName]) ? roleModules[roleName] : [];
      });

      setRoleModulesState(newRoleModules);
      setRolePermissionsLoaded(true);
      return;
    } catch (matrixErr: any) {
      console.warn('Primary role modules matrix load failed, falling back:', matrixErr);
    }

    try {
      const [pagesResult, roleMapResult, rolesResult] = await Promise.allSettled([
        api.get('/admin/pages'),
        api.get('/admin/pages/role-map'),
        api.get('/admin/roles')
      ]);

      const pages =
        pagesResult.status === 'fulfilled'
          ? normalizeList<any>(pagesResult.value.data, ['pages'])
          : [];

      setPermissionPages(
        pages.map((page: any) => ({
          id: Number(page.id),
          name: String(page.name || ''),
          path: String(page.path || ''),
          category: page.category || undefined,
        }))
      );

      const roleMap: Record<number, number[]> = {};
      if (roleMapResult.status === 'fulfilled') {
        normalizeList<{ role_id: number; page_ids: number[] }>(roleMapResult.value.data).forEach((item) => {
          const roleId = Number(item.role_id);
          roleMap[roleId] = (item.page_ids || []).map((id: any) => Number(id)).filter((id) => Number.isFinite(id));
        });
      }

      const rolesData = rolesResult.status === 'fulfilled'
        ? normalizeList<{ id: number; name: string }>(rolesResult.value.data, ['roles'])
        : [];

      if (rolesResult.status === 'fulfilled' && rolesData.length > 0) {
        setRoles(rolesData);
      }

      // Check if we have at least pages or roles - don't require both to succeed
      const hasPages = pagesResult.status === 'fulfilled' && pages.length > 0;
      const hasRoles = rolesData.length > 0;
      
      if (!hasPages && !hasRoles) {
        // Only show error if we truly have NO data from ANY source
        const err: any = (pagesResult as PromiseRejectedResult)?.reason
          || (roleMapResult as PromiseRejectedResult)?.reason
          || (rolesResult as PromiseRejectedResult)?.reason;
        console.error('Failed to load role permissions:', err);
        // Suppress error popup but mark as loaded with empty state
        setRolePermissionsLoaded(true);
        return;
      }

      // Build role modules state from database, preserving protected role expectations.
      const newRoleModules: Record<string, string[]> = {};
      rolesData.forEach((role) => {
        const roleName = String(role.name || '').trim();
        if (!roleName) return;

        if (roleName.toLowerCase() === 'main admin') {
          newRoleModules[roleName] = pages.map((p: any) => String(p.name || '')).filter(Boolean);
          return;
        }

        const pageIds = roleMap[Number(role.id)] || [];
        const rolePages = pages.filter((p: any) => pageIds.includes(Number(p.id)));
        newRoleModules[roleName] = rolePages.map((p: any) => p.name);
      });

      setRoleModulesState(newRoleModules);
      setRolePermissionsLoaded(true);

    } catch (err: any) {
      console.error('Failed to load role permissions:', err);
      // Still mark as loaded so page can render
      setRolePermissionsLoaded(true);
    } finally {
      setRolePermissionsLoaded(true);
    }
  }, []);

  const syncNavigationPages = async () => {
    try {
      setSyncingPages(true);
      await api.post('/admin/pages/sync', { pages: flatNavPages });
      await loadRolePermissions(); // Reload permissions after sync
      bumpNavPermissionVersion();
      showSuccess('Navigation synced successfully! Role permissions updated.');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to sync navigation');
    } finally {
      setSyncingPages(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users`, { params: { only_applicants: onlyApplicants ? 1 : undefined } });
      setUsers((res.data as any).data || res.data);
    } catch (err: any) {
      showError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [onlyApplicants]);

  const fetchScopeUsers = useCallback(async () => {
    if (!isMainAdmin) return;
    try {
      const res = await api.get('/admin/users');
      const data = (res.data as any).data || res.data || [];
      setScopeUsers(Array.isArray(data) ? data : []);
    } catch {
      setScopeUsers([]);
    }
  }, [isMainAdmin]);

  const loadRoleScopes = useCallback(async () => {
    if (!isMainAdmin) return;
    setRoleScopesLoading(true);
    try {
      const params: Record<string, any> = { per_page: 200 };
      if (scopeStatusFilter !== 'all') {
        params.status = scopeStatusFilter;
      }
      const res = await api.get('/admin/role-scopes', { params });
      const rows = normalizeList<RoleScopeRecord>(res.data, ['data']);
      setRoleScopes(rows);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load role scopes');
      setRoleScopes([]);
    } finally {
      setRoleScopesLoading(false);
    }
  }, [isMainAdmin, scopeStatusFilter]);

  const loadPendingScopeRequests = useCallback(async () => {
    if (!isMainAdmin) return;
    try {
      const res = await api.get('/admin/teacher-scope-requests');
      const rows = normalizeList<TeacherScopeRequest>(res.data?.pending_requests ?? res.data, ['pending_requests']);
      setPendingScopeRequests(rows);
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      if (status !== 403 && status !== 404) {
        showError(err?.response?.data?.message || 'Failed to load scope requests');
      }
      setPendingScopeRequests([]);
    }
  }, [isMainAdmin]);

  const loadScopeOptions = useCallback(async () => {
    if (!isMainAdmin) return;
    try {
      const [preferencesRes, examsRes] = await Promise.all([
        api.get('/preferences/options'),
        api.get('/exams', { params: { per_page: 100 } }),
      ]);

      const prefData = preferencesRes?.data || {};
      const subjects = normalizeList<any>(prefData.subjects, ['subjects'])
        .map((row: any) => ({ id: Number(row.id), name: String(row.name || row.subject_name || '') }))
        .filter((row: ScopeOption) => Number.isFinite(row.id) && row.name);
      const classes = normalizeList<any>(prefData.classes, ['classes'])
        .map((row: any) => ({ id: Number(row.id), name: String(row.name || '') }))
        .filter((row: ScopeOption) => Number.isFinite(row.id) && row.name);
      const examsPayload = examsRes?.data || {};
      const exams = normalizeList<any>(examsPayload, ['data'])
        .map((row: any) => ({ id: Number(row.id), name: String(row.title || `Exam #${row.id}`) }))
        .filter((row: ScopeOption) => Number.isFinite(row.id) && row.name);

      setScopeSubjects(subjects);
      setScopeClasses(classes);
      setScopeExams(exams);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load scope options');
      setScopeSubjects([]);
      setScopeClasses([]);
      setScopeExams([]);
    }
  }, [isMainAdmin]);

  const loadRoles = useCallback(async () => {
    try {
      const res = await api.get(`/admin/roles`);
      const loaded = normalizeList<Role>(res.data, ['roles']);
      setRoles(loaded);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load roles');
      setRoles([]);
    }
  }, []);

  const roleOptions = useMemo(() => {
    const options = new Set<string>();

    roles.forEach((role) => {
      const name = String(role.name || '').trim();
      if (!name) return;
      const normalized = name.toLowerCase();
      if (normalized === 'student') return;
      if (!isMainAdmin && normalized === 'main admin') return;
      options.add(name);
    });

    CORE_ADMIN_ROLE_NAMES.forEach((roleName) => {
      const normalized = roleName.toLowerCase();
      if (normalized === 'student') return;
      if (!isMainAdmin && normalized === 'main admin') return;
      options.add(roleName);
    });

    return Array.from(options).sort(compareRoleNames);
  }, [roles, isMainAdmin]);

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => compareRoleNames(String(a.name || ''), String(b.name || '')));
  }, [roles]);

  const displayRoleModules = useMemo<Record<string, string[]>>(() => {
    const merged: Record<string, string[]> = {};

    // 1) Start with roles from API
    roles.forEach((role) => {
      const roleName = String(role.name || '').trim();
      if (!roleName) return;
      merged[roleName] = roleName.toLowerCase() === 'main admin' ? [...availableModules] : [];
    });

    // 2) Guarantee core admin roles
    CORE_ADMIN_ROLE_NAMES.forEach((roleName) => {
      if (!merged[roleName]) {
        merged[roleName] = roleName.toLowerCase() === 'main admin' ? [...availableModules] : [];
      }
    });

    // 3) Overlay current editable state (preserves all existing rows)
    Object.entries(roleModulesState).forEach(([roleName, modules]) => {
      merged[roleName] = Array.isArray(modules) ? modules : [];
    });

    return merged;
  }, [roleModulesState, roles, availableModules]);

  const sortedDisplayRoleModules = useMemo(() => {
    return Object.entries(displayRoleModules).sort(([leftRole], [rightRole]) => compareRoleNames(leftRole, rightRole));
  }, [displayRoleModules]);

  const activeApprovedScopes = useMemo(
    () => roleScopes.filter((scope) => String(scope.status || '').toLowerCase() === 'approved' && Boolean(scope.is_active)),
    [roleScopes]
  );

  const filteredActiveApprovedScopes = useMemo(() => {
    const query = scopeSearch.trim().toLowerCase();
    const statusFilteredScopes = roleScopes.filter((scope) => {
      if (scopeStatusFilter === 'all') return true;
      return String(scope.status || '').toLowerCase() === scopeStatusFilter;
    });

    if (!query) return statusFilteredScopes;
    return statusFilteredScopes.filter((scope) => {
      const haystack = [
        scope.user?.name || '',
        scope.user?.email || '',
        scope.role_name || '',
        scope.subject?.name || '',
        scope.school_class?.name || '',
        scope.exam?.title || '',
        scope.term || '',
        scope.academic_session || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [roleScopes, scopeSearch, scopeStatusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    loadRoles();
    loadRolePermissions(); // Load initial permissions from database
  }, [loadRolePermissions, loadRoles]);
  useEffect(() => {
    if (!isMainAdmin || !showRoleDetails) return;

    loadRoleScopes();
    loadScopeOptions();
    fetchScopeUsers();
    loadPendingScopeRequests();
  }, [isMainAdmin, showRoleDetails, loadRoleScopes, loadScopeOptions, fetchScopeUsers, loadPendingScopeRequests]);

  const assignRole = async (userId: number, roleName: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser && hasStudentRole(targetUser)) {
      showError('Student accounts cannot be assigned admin roles from this page.');
      return;
    }

    // Prevent assigning role to current user
    if (userId === currentUserId) {
      showError('You cannot modify your own roles');
      return;
    }
    
    const confirm = await showConfirm(`Assign role "${roleName}"?`);
    if (!confirm) return;
    try {
      await api.post(`/admin/users/${userId}/roles`, { role: roleName });
      showSuccess('Role assigned');
      fetchUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to assign role';
      showError(msg);
    }
  };

  const createRole = async () => {
    const name = newRoleName.trim();
    if (!name) {
      showError('Role name is required');
      return;
    }

    const exists = roles.some((role) => String(role.name || '').toLowerCase() === name.toLowerCase());
    if (exists) {
      showError(`Role "${name}" already exists.`);
      return;
    }

    try {
      setCreatingRole(true);
      await api.post('/admin/roles', { name });
      setNewRoleName('');
      await loadRoles();
      await loadRolePermissions();
      bumpNavPermissionVersion();
      showSuccess('Role created successfully');
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      const firstError = errors ? Object.values(errors)[0] as string[] : null;
      const detail = Array.isArray(firstError) ? firstError[0] : null;
      showError(detail || err?.response?.data?.message || 'Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  const startEditRole = (role: Role) => {
    if (!role.id) return;
    if (PROTECTED_ROLE_NAMES.includes(String(role.name || '').trim())) {
      showError('This role is protected and cannot be renamed.');
      return;
    }
    setEditingRoleId(role.id);
    setEditingRoleName(role.name);
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setEditingRoleName('');
  };

  const saveEditRole = async () => {
    if (!editingRoleId) return;

    const name = editingRoleName.trim();
    if (!name) {
      showError('Role name is required');
      return;
    }

    try {
      setUpdatingRole(true);
      await api.put(`/admin/roles/${editingRoleId}`, { name });
      cancelEditRole();
      await loadRoles();
      await loadRolePermissions();
      bumpNavPermissionVersion();
      showSuccess('Role updated successfully');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const removeRole = async (role: Role) => {
    if (!role.id) return;
    if (PROTECTED_ROLE_NAMES.includes(String(role.name || '').trim())) {
      showError('This role is protected and cannot be deleted.');
      return;
    }

    const ok = await showConfirm(`Delete role "${role.name}"?`);
    if (!ok) return;

    try {
      setDeletingRoleId(role.id);
      await api.delete(`/admin/roles/${role.id}`);
      await loadRoles();
      await loadRolePermissions();
      bumpNavPermissionVersion();
      showSuccess('Role deleted successfully');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to delete role');
    } finally {
      setDeletingRoleId(null);
    }
  };

  const syncRoleDefaults = async () => {
    try {
      setSyncingRoleDefaults(true);
      await api.post('/admin/roles/sync-defaults');
      await loadRolePermissions();
      bumpNavPermissionVersion();
      showSuccess('Role defaults synced from navigation permissions');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to sync role defaults');
    } finally {
      setSyncingRoleDefaults(false);
    }
  };
  
  const deleteUser = async (userId: number) => {
    // Prevent deleting current user
    if (userId === currentUserId) {
      showError('You cannot delete your own account');
      return;
    }
    
    const confirm = await showConfirm('Delete this user? This action cannot be undone.');
    if (!confirm) return;
    try {
      await api.delete(`/users/${userId}`);
      showSuccess('User deleted successfully');
      fetchUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete user';
      showError(msg);
    }
  };

  const saveRoleScope = async () => {
    if (!isMainAdmin) {
      showError('Only Main Admin can manage role scopes');
      return;
    }

    const payload = {
      user_id: Number(scopeForm.user_id),
      role_name: scopeForm.role_name?.trim() || null,
      subject_id: scopeForm.subject_id ? Number(scopeForm.subject_id) : null,
      class_id: scopeForm.class_id ? Number(scopeForm.class_id) : null,
      exam_id: scopeForm.exam_id ? Number(scopeForm.exam_id) : null,
      academic_session: scopeForm.academic_session?.trim() || null,
      term: scopeForm.term || null,
      is_active: scopeForm.is_active,
    };

    if (!Number.isFinite(payload.user_id) || payload.user_id <= 0) {
      showError('Select a user for scope assignment');
      return;
    }
    if (!payload.subject_id && !payload.class_id && !payload.exam_id) {
      showError('Select at least one scope target (Subject, Class, or Exam)');
      return;
    }

    try {
      setRoleScopeSaving(true);
      if (editingScopeId) {
        await api.put(`/admin/role-scopes/${editingScopeId}`, payload);
      } else {
        await api.post('/admin/role-scopes', payload);
      }
      await loadRoleScopes();
      setScopeForm((prev) => ({
        ...prev,
        user_id: '',
        role_name: 'teacher',
        subject_id: '',
        class_id: '',
        exam_id: '',
        academic_session: '',
        term: '',
        is_active: true,
      }));
      setEditingScopeId(null);
      showSuccess(editingScopeId ? 'Role scope updated successfully' : 'Role scope saved successfully');
    } catch (err: any) {
      showError(err?.response?.data?.message || (editingScopeId ? 'Failed to update role scope' : 'Failed to save role scope'));
    } finally {
      setRoleScopeSaving(false);
    }
  };

  const editRoleScope = (scope: RoleScopeRecord) => {
    setEditingScopeId(scope.id);
    setScopeForm({
      user_id: String(scope.user_id || ''),
      role_name: String(scope.role_name || 'teacher'),
      subject_id: scope.subject_id ? String(scope.subject_id) : '',
      class_id: scope.class_id ? String(scope.class_id) : '',
      exam_id: scope.exam_id ? String(scope.exam_id) : '',
      academic_session: scope.academic_session || '',
      term: scope.term || '',
      is_active: Boolean(scope.is_active),
    });
    setScopeTab('assign');
  };

  const cancelEditRoleScope = () => {
    setEditingScopeId(null);
    setScopeForm({
      user_id: '',
      role_name: 'teacher',
      subject_id: '',
      class_id: '',
      exam_id: '',
      academic_session: '',
      term: '',
      is_active: true,
    });
  };

  const deleteRoleScope = async (scopeId: number) => {
    if (!isMainAdmin) return;

    const ok = await showConfirm('Delete this scope assignment?');
    if (!ok) return;

    try {
      setUpdatingScopeId(scopeId);
      await api.delete(`/admin/role-scopes/${scopeId}`);
      await loadRoleScopes();
      if (editingScopeId === scopeId) {
        cancelEditRoleScope();
      }
      showSuccess('Role scope deleted');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to delete role scope');
    } finally {
      setUpdatingScopeId(null);
    }
  };

  const removeUserRole = async (user: User, roleName: string) => {
    if (user.id === currentUserId) {
      showError('You cannot modify your own roles');
      return;
    }

    const ok = await showConfirm(`Remove role "${roleName}" from ${user.name}?`);
    if (!ok) return;

    try {
      await api.delete(`/admin/users/${user.id}/roles/${encodeURIComponent(roleName)}`);
      showSuccess('Role removed successfully');
      await fetchUsers();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to remove role');
    }
  };

  const approveScopeRequestBatch = async (batchId: string) => {
    if (!isMainAdmin) return;
    const ok = await showConfirm('Approve this scope request batch? Current approved scopes will be replaced.');
    if (!ok) return;
    try {
      setUpdatingScopeId(-1);
      await api.post(`/admin/teacher-scope-requests/${batchId}/approve`);
      await Promise.all([loadPendingScopeRequests(), loadRoleScopes()]);
      showSuccess('Scope request approved successfully');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to approve scope request');
    } finally {
      setUpdatingScopeId(null);
    }
  };

  const rejectScopeRequestBatch = async (batchId: string) => {
    if (!isMainAdmin) return;
    const reason = window.prompt('Enter rejection reason:')?.trim() || '';
    if (!reason) {
      showError('Rejection reason is required');
      return;
    }
    try {
      setUpdatingScopeId(-1);
      await api.post(`/admin/teacher-scope-requests/${batchId}/reject`, { reason });
      await loadPendingScopeRequests();
      showSuccess('Scope request rejected');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to reject scope request');
    } finally {
      setUpdatingScopeId(null);
    }
  };

  return (
    <div className="app-shell section-shell">
      <div className="space-y-4">
      {/* Header with Role Permissions Button */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Admin User Management</h2>
        <button
          onClick={() => setShowRoleDetails(!showRoleDetails)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs md:text-sm"
        >
          {showRoleDetails ? 'Hide' : 'View'} Role Permissions
        </button>
      </div>

      {/* Role Permissions Card */}
      {showRoleDetails && (
        <Card className="panel-compact">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-3">
            <h2 className="text-lg md:text-xl font-semibold">Role Module Access</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={syncNavigationPages}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs md:text-sm flex items-center gap-2 disabled:opacity-60 hover:bg-emerald-700"
                disabled={syncingPages}
              >
                <i className={`bx ${syncingPages ? 'bx-loader-alt animate-spin' : 'bx-sync'} text-lg`}></i>
                <span>{syncingPages ? 'Syncing...' : 'Sync Navigation Modules'}</span>
              </button>
              <button
                onClick={syncRoleDefaults}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs md:text-sm flex items-center gap-2 disabled:opacity-60 hover:bg-indigo-700"
                disabled={syncingRoleDefaults || !isMainAdmin}
                title={isMainAdmin ? 'Sync role defaults' : 'Only Main Admin can sync role defaults'}
              >
                <i className={`bx ${syncingRoleDefaults ? 'bx-loader-alt animate-spin' : 'bx-refresh'} text-lg`}></i>
                <span>{syncingRoleDefaults ? 'Syncing...' : 'Sync Role Defaults'}</span>
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                className="px-2 py-1.5 text-xs md:text-sm border rounded hover:bg-gray-50"
              >
                {editMode ? 'Done' : 'Edit Role Permissions'}
              </button>
            </div>
          </div>
          <p className="text-xs md:text-sm text-gray-600 mb-3">
            This table shows which modules each role can access in the system.
          </p>
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Dynamic Role CRUD</p>
            <div className="flex flex-col md:flex-row gap-2">
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Create new role (e.g. Exam Supervisor)"
                disabled={!isMainAdmin}
              />
              <button
                onClick={createRole}
                disabled={creatingRole || !isMainAdmin}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-60"
                title={isMainAdmin ? 'Create role' : 'Only Main Admin can create roles'}
              >
                {creatingRole ? 'Creating...' : 'Create Role'}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {sortedRoles.map((role) => (
                <div key={role.id || role.name} className="flex flex-col md:flex-row md:items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2">
                  {(() => {
                    const isProtected = PROTECTED_ROLE_NAMES.includes(String(role.name || '').trim());
                    return (
                  <>
                  {editingRoleId === role.id ? (
                    <>
                      <input
                        value={editingRoleName}
                        onChange={(e) => setEditingRoleName(e.target.value)}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveEditRole}
                          disabled={updatingRole || !isMainAdmin || isProtected}
                          className="px-2.5 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {updatingRole ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEditRole}
                          className="px-2.5 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{role.name}</p>
                        <p className="text-xs text-gray-500">
                          {role.users_count ?? 0} users â€¢ {role.permissions_count ?? 0} permissions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditRole(role)}
                          disabled={!isMainAdmin || isProtected}
                          className="px-2.5 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-100 disabled:opacity-60"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => removeRole(role)}
                          disabled={deletingRoleId === role.id || !isMainAdmin || isProtected}
                          className="px-2.5 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-60"
                        >
                          {deletingRoleId === role.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </>
                  )}
                  </>
                    );
                  })()}
                </div>
              ))}
            </div>
            {!isMainAdmin && (
              <p className="text-xs text-amber-700 mt-2">
                Only Main Admin can create, rename, or delete roles.
              </p>
            )}
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Role Scope Management</p>
                <p className="text-xs text-gray-500 mt-1">Use requests for approvals, active assignments for audits, and manual assign for direct overrides.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  loadPendingScopeRequests();
                  loadRoleScopes();
                  loadScopeOptions();
                  fetchScopeUsers();
                }}
                className="px-2.5 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Refresh Scopes
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {[
                { key: 'requests', label: `Requests (${pendingScopeRequests.length})` },
                { key: 'active', label: `Active Assignments (${activeApprovedScopes.length})` },
                { key: 'assign', label: 'Manual Assign' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setScopeTab(tab.key as 'requests' | 'active' | 'assign')}
                  className={`px-3 py-1.5 rounded text-xs md:text-sm border ${
                    scopeTab === tab.key
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {scopeTab === 'requests' && (
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 border-b text-left font-semibold">Teacher</th>
                      <th className="p-2 border-b text-left font-semibold">Requested Scope</th>
                      <th className="p-2 border-b text-left font-semibold">Current Approved</th>
                      <th className="p-2 border-b text-left font-semibold">Reason</th>
                      <th className="p-2 border-b text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingScopeRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-gray-500">No pending scope requests.</td>
                      </tr>
                    ) : (
                      pendingScopeRequests.map((request) => (
                        <tr key={request.batch_id} className="hover:bg-gray-50">
                          <td className="p-2 border-b">
                            <div className="font-medium text-gray-800">{request.user?.name || '-'}</div>
                            <div className="text-gray-500">{request.user?.email || '-'}</div>
                          </td>
                          <td className="p-2 border-b">
                            <div className="flex flex-wrap gap-1">
                              {request.requested_scopes.map((scope) => (
                                <span key={scope.id} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                  {scope.subject_name} • {scope.class_name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-2 border-b">
                            <div className="flex flex-wrap gap-1">
                              {(request.current_approved_scopes || []).length === 0 ? (
                                <span className="text-gray-400">None</span>
                              ) : (
                                request.current_approved_scopes.map((scope) => (
                                  <span key={scope.id} className="px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                    {scope.subject_name} • {scope.class_name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="p-2 border-b text-gray-700">{request.reason || '-'}</td>
                          <td className="p-2 border-b">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => approveScopeRequestBatch(request.batch_id)}
                                disabled={!isMainAdmin || updatingScopeId === -1}
                                className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectScopeRequestBatch(request.batch_id)}
                                disabled={!isMainAdmin || updatingScopeId === -1}
                                className="px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {scopeTab === 'active' && (
              <>
                <div className="mb-2 flex flex-col md:flex-row gap-2">
                  <select
                    value={scopeStatusFilter}
                  onChange={(e) => setScopeStatusFilter(e.target.value as 'all' | 'approved' | 'rejected')}
                  className="px-2 py-1.5 text-xs border border-gray-300 rounded"
                >
                  <option value="all">All</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  </select>
                  <input
                    type="text"
                    value={scopeSearch}
                    onChange={(e) => setScopeSearch(e.target.value)}
                    placeholder="Search user/subject/class/exam..."
                    className="rounded border border-gray-300 px-3 py-1.5 text-xs md:text-sm flex-1"
                  />
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-2 border-b text-left font-semibold">User</th>
                        <th className="p-2 border-b text-left font-semibold">Role</th>
                        <th className="p-2 border-b text-left font-semibold">Subject</th>
                        <th className="p-2 border-b text-left font-semibold">Class</th>
                        <th className="p-2 border-b text-left font-semibold">Exam</th>
                        <th className="p-2 border-b text-left font-semibold">Session/Term</th>
                        <th className="p-2 border-b text-left font-semibold">Status</th>
                        <th className="p-2 border-b text-left font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleScopesLoading ? (
                        <tr><td colSpan={8} className="p-3 text-center text-gray-500">Loading role scopes...</td></tr>
                      ) : filteredActiveApprovedScopes.length === 0 ? (
                        <tr><td colSpan={8} className="p-3 text-center text-gray-500">No matching assignments.</td></tr>
                      ) : (
                        filteredActiveApprovedScopes.map((scope) => (
                          <tr key={scope.id} className="hover:bg-gray-50">
                            <td className="p-2 border-b"><div className="font-medium text-gray-800">{scope.user?.name || `User #${scope.user_id}`}</div><div className="text-gray-500">{scope.user?.email || '-'}</div></td>
                            <td className="p-2 border-b">{scope.role_name || '-'}</td>
                            <td className="p-2 border-b">{scope.subject?.name || '-'}</td>
                            <td className="p-2 border-b">{scope.school_class?.name || '-'}</td>
                            <td className="p-2 border-b">{scope.exam?.title || '-'}</td>
                            <td className="p-2 border-b">{(scope.academic_session || '-')}{' / '}{(scope.term || '-')}</td>
                            <td className="p-2 border-b">
                              <span className={`px-2 py-0.5 rounded ${String(scope.status || '').toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' : String(scope.status || '').toLowerCase() === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                {String(scope.status || 'pending').toLowerCase()}
                              </span>
                            </td>
                            <td className="p-2 border-b">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => editRoleScope(scope)}
                                  disabled={!isMainAdmin}
                                  className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRoleScope(scope.id)}
                                  disabled={!isMainAdmin || updatingScopeId === scope.id}
                                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60"
                                >
                                  {updatingScopeId === scope.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {scopeTab === 'assign' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                  <select value={scopeForm.user_id} onChange={(e) => setScopeForm((prev) => ({ ...prev, user_id: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" disabled={!isMainAdmin}>
                    <option value="">Select user</option>
                    {scopeUsers.filter((u) => !hasStudentRole(u)).map((u) => (<option key={u.id} value={u.id}>{u.name} ({u.email})</option>))}
                  </select>
                  <select value={scopeForm.role_name} onChange={(e) => setScopeForm((prev) => ({ ...prev, role_name: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" disabled={!isMainAdmin}>
                    <option value="">Role (optional)</option>
                    {roleOptions.map((name) => (<option key={name} value={name.toLowerCase()}>{name}</option>))}
                  </select>
                  <select value={scopeForm.term} onChange={(e) => setScopeForm((prev) => ({ ...prev, term: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" disabled={!isMainAdmin}>
                    <option value="">Term (optional)</option><option value="First Term">First Term</option><option value="Second Term">Second Term</option><option value="Third Term">Third Term</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                  <select value={scopeForm.subject_id} onChange={(e) => setScopeForm((prev) => ({ ...prev, subject_id: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" disabled={!isMainAdmin}>
                    <option value="">Subject scope (optional)</option>
                    {scopeSubjects.map((subject) => (<option key={subject.id} value={subject.id}>{subject.name}</option>))}
                  </select>
                  <select value={scopeForm.class_id} onChange={(e) => setScopeForm((prev) => ({ ...prev, class_id: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" disabled={!isMainAdmin}>
                    <option value="">Class scope (optional)</option>
                    {scopeClasses.map((schoolClass) => (<option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>))}
                  </select>
                  <select value={scopeForm.exam_id} onChange={(e) => setScopeForm((prev) => ({ ...prev, exam_id: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" disabled={!isMainAdmin}>
                    <option value="">Exam scope (optional)</option>
                    {scopeExams.map((exam) => (<option key={exam.id} value={exam.id}>{exam.name}</option>))}
                  </select>
                  <input type="text" value={scopeForm.academic_session} onChange={(e) => setScopeForm((prev) => ({ ...prev, academic_session: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Academic session (optional)" disabled={!isMainAdmin} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={scopeForm.is_active} onChange={(e) => setScopeForm((prev) => ({ ...prev, is_active: e.target.checked }))} disabled={!isMainAdmin} />Active scope</label>
                  <div className="flex items-center gap-2">
                    {editingScopeId && (
                      <button
                        type="button"
                        onClick={cancelEditRoleScope}
                        className="px-3 py-1.5 border border-gray-300 rounded text-xs md:text-sm hover:bg-gray-50"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button type="button" onClick={saveRoleScope} disabled={!isMainAdmin || roleScopeSaving} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs md:text-sm hover:bg-blue-700 disabled:opacity-60">{roleScopeSaving ? (editingScopeId ? 'Updating...' : 'Saving...') : (editingScopeId ? 'Update Scope' : 'Add Scope')}</button>
                  </div>
                </div>
              </>
            )}
          </div><div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 border-b text-left font-semibold text-xs">Role</th>
                  <th className="p-2 border-b text-left font-semibold text-xs">Accessible Modules</th>
                </tr>
              </thead>
              <tbody>
                {sortedDisplayRoleModules.map(([role, modules]) => (
                  <tr key={role} className="hover:bg-gray-50">
                    <td className="p-2 border-b">
                      <span className="font-medium text-blue-600 text-xs md:text-sm">{role}</span>
                    </td>
                    <td className="p-2 border-b">
                      {!editMode ? (
                        <div className="flex flex-wrap gap-1">
                          {modules.map(module => (
                            <span
                              key={module}
                              className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                            >
                              {module}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                          {availableModules.map(m => {
                            const checked = modules.includes(m);
                            const isProtected = PROTECTED_ROLE_NAMES.includes(role);
                            return (
                              <label key={m} className="flex items-center gap-1 text-xs border rounded px-1.5 py-1">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isProtected}
                                  onChange={(e) => {
                                    setRoleModulesState(prev => {
                                      const next = { ...prev };
                                      const arr = [...(next[role] || [])];
                                      if (e.target.checked && !arr.includes(m)) arr.push(m);
                                      if (!e.target.checked) {
                                        const idx = arr.indexOf(m);
                                        if (idx >= 0) arr.splice(idx, 1);
                                      }
                                      next[role] = arr;
                                      return next;
                                    });
                                  }}
                                  aria-label={`Allow ${role} to access ${m}`}
                                />
                                <span>{m}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editMode && (
            <div className="mt-3 flex justify-end">
              <button
                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs md:text-sm"
                onClick={async () => {
                  try {
                    if (!rolePermissionsLoaded) {
                      showError('Role permissions are still loading. Please wait and retry.');
                      return;
                    }

                    const payload: Record<string, string[]> = {};
                    Object.entries(displayRoleModules).forEach(([roleName, modules]) => {
                      const normalized = roleName.toLowerCase();
                      if (normalized === 'student' || normalized === 'main admin') {
                        return;
                      }

                      payload[roleName] = Array.from(new Set((modules || []).filter((name) => availableModules.includes(name))));
                    });

                    await api.post('/admin/roles/modules', { role_modules: payload });
                    await loadRolePermissions(); // Reload to confirm changes
                    bumpNavPermissionVersion();
                    showSuccess('Role permissions updated successfully');
                    setEditMode(false);
                  } catch (err: any) {
                    showError(err?.response?.data?.message || 'Failed to update role permissions');
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          )}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Main Admin has full system access including user management and system settings.
            </p>
          </div>
        </Card>
      )}

      {/* User Management Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Users & Applicants</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyApplicants}
              onChange={e => setOnlyApplicants(e.target.checked)}
              className="w-4 h-4"
            />
            Show only applicants (no roles)
          </label>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 border-b text-left font-semibold text-sm">Name</th>
                  <th className="p-3 border-b text-left font-semibold text-sm">Email</th>
                  <th className="p-3 border-b text-left font-semibold text-sm">Verified</th>
                  <th className="p-3 border-b text-left font-semibold text-sm">Current Roles</th>
                  <th className="p-3 border-b text-left font-semibold text-sm">Assign Role</th>
                  <th className="p-3 border-b text-left font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="p-3 border-b">{u.name}</td>
                    <td className="p-3 border-b">{u.email}</td>
                    <td className="p-3 border-b">
                      {u.email_verified_at ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          Verified
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                          Not Verified
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-b">
                      {u.roles?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map(r => (
                            <span
                              key={r.name}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium inline-flex items-center gap-1"
                            >
                              {r.name}
                              {!hasStudentRole(u) && u.id !== currentUserId && (
                                <button
                                  type="button"
                                  onClick={() => removeUserRole(u, r.name)}
                                  className="text-blue-700 hover:text-red-700 font-bold"
                                  title={`Remove ${r.name}`}
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No roles assigned</span>
                      )}
                    </td>
                    <td className="p-3 border-b">
                      {hasStudentRole(u) ? (
                        <span className="text-xs text-gray-500">Not applicable for student accounts</span>
                      ) : (
                        <select
                          aria-label="Assign role"
                          className={`px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${u.id === currentUserId ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onChange={(e) => e.target.value && assignRole(u.id, e.target.value)}
                          defaultValue=""
                          disabled={u.id === currentUserId}
                          title={u.id === currentUserId ? 'You cannot modify your own roles' : 'Select role to assign'}
                        >
                          <option value="" disabled>Select role to assign</option>
                          {roleOptions.map((roleName) => (
                            <option key={roleName} value={roleName}>{roleName}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-3 border-b">
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={u.id === currentUserId}
                        className={`px-3 py-1 text-sm rounded ${u.id === currentUserId ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                        title={u.id === currentUserId ? 'You cannot delete your own account' : 'Delete user'}
                      >
                        <i className='bx bx-trash'></i> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Access Control:</strong> Only Main Admin should access this page. Backend middleware ensures this restriction is enforced.
        </p>
        <p className="text-sm text-blue-800 mt-2">
          <strong>Note:</strong> Student accounts are managed separately through the Student Management section and student registration portal.
        </p>
      </div>
    </div>
    </div>
  );
};

export default AdminUserManagement;

