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

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyApplicants, setOnlyApplicants] = useState(true);
  const [showRoleDetails, setShowRoleDetails] = useState(false);
  const [syncingPages, setSyncingPages] = useState(false);
  const [syncingRoleDefaults, setSyncingRoleDefaults] = useState(false);
  const [roleModulesState, setRoleModulesState] = useState<Record<string, string[]>>({});
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  
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
  
  // Extract available modules from actual navigation
  const availableModules = useMemo(() => {
    const modules: string[] = [];
    adminNavLinks.forEach((nav) => {
      modules.push(nav.name);
      if (nav.subItems) {
        nav.subItems.forEach((sub) => modules.push(sub.name));
      }
    });
    return modules;
  }, []);

  const flatNavPages = useMemo(() => {
    const items: { name: string; path: string; category?: string }[] = [];
    adminNavLinks.forEach((nav) => {
      items.push({ name: nav.name, path: nav.path, category: nav.subItems ? nav.name : undefined });
      if (nav.subItems) {
        nav.subItems.forEach((sub) => items.push({ name: sub.name, path: sub.path, category: nav.name }));
      }
    });
    // Add hidden pages (System Settings and Activity Logs) for role permission system
    items.push({ name: 'System Settings', path: '/admin/settings', category: undefined });
    items.push({ name: 'Activity Logs', path: '/admin/activity-logs', category: undefined });
    return items;
  }, []);

  const loadRolePermissions = useCallback(async () => {
    try {
      const [pagesRes, roleMapRes] = await Promise.all([
        api.get('/admin/pages'),
        api.get('/admin/pages/role-map')
      ]);
      
      const pages = pagesRes.data?.pages || [];
      const roleMap: Record<number, number[]> = {};
      (roleMapRes.data || []).forEach((item: { role_id: number; page_ids: number[] }) => {
        roleMap[item.role_id] = item.page_ids;
      });

      // Get roles
      const rolesRes = await api.get('/admin/roles');
      const rolesData = rolesRes.data || [];
      
      // Build role modules state from database
      const newRoleModules: Record<string, string[]> = {};
      rolesData.forEach((role: { id: number; name: string }) => {
        const pageIds = roleMap[role.id] || [];
        const rolePages = pages.filter((p: any) => pageIds.includes(p.id));
        newRoleModules[role.name] = rolePages.map((p: any) => p.name);
      });
      
      console.log('Loaded role permissions from database:', newRoleModules);
      setRoleModulesState(newRoleModules);
    } catch (err: any) {
      console.error('Failed to load role permissions:', err);
      // If loading fails, keep the current state
    }
  }, []);

  const syncNavigationPages = async () => {
    try {
      setSyncingPages(true);
      await api.post('/admin/pages/sync', { pages: flatNavPages });
      await loadRolePermissions(); // Reload permissions after sync
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

  const loadRoles = useCallback(async () => {
    try {
      const res = await api.get(`/admin/roles`);
      setRoles((res.data || []) as Role[]);
    } catch {
      setRoles([]);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    loadRoles();
    loadRolePermissions(); // Load initial permissions from database
  }, [loadRolePermissions, loadRoles]);

  const assignRole = async (userId: number, roleName: string) => {
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

    try {
      setCreatingRole(true);
      await api.post('/admin/roles', { name });
      setNewRoleName('');
      await loadRoles();
      await loadRolePermissions();
      showSuccess('Role created successfully');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  const startEditRole = (role: Role) => {
    if (!role.id) return;
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
      showSuccess('Role updated successfully');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const removeRole = async (role: Role) => {
    if (!role.id) return;

    const ok = await showConfirm(`Delete role "${role.name}"?`);
    if (!ok) return;

    try {
      setDeletingRoleId(role.id);
      await api.delete(`/admin/roles/${role.id}`);
      await loadRoles();
      await loadRolePermissions();
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
              {roles.map((role) => (
                <div key={role.id || role.name} className="flex flex-col md:flex-row md:items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2">
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
                          disabled={updatingRole || !isMainAdmin}
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
                          {role.users_count ?? 0} users • {role.permissions_count ?? 0} permissions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditRole(role)}
                          disabled={!isMainAdmin}
                          className="px-2.5 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-100 disabled:opacity-60"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => removeRole(role)}
                          disabled={deletingRoleId === role.id || !isMainAdmin}
                          className="px-2.5 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-60"
                        >
                          {deletingRoleId === role.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {!isMainAdmin && (
              <p className="text-xs text-amber-700 mt-2">
                Only Main Admin can create, rename, or delete roles.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 border-b text-left font-semibold text-xs">Role</th>
                  <th className="p-2 border-b text-left font-semibold text-xs">Accessible Modules</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(roleModulesState).map(([role, modules]) => (
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
                            return (
                              <label key={m} className="flex items-center gap-1 text-xs border rounded px-1.5 py-1">
                                <input
                                  type="checkbox"
                                  checked={checked}
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
                    await api.post('/admin/roles/modules', { role_modules: roleModulesState });
                    await loadRolePermissions(); // Reload to confirm changes
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
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No roles assigned</span>
                      )}
                    </td>
                    <td className="p-3 border-b">
                      <select
                        aria-label="Assign role"
                        className={`px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${u.id === currentUserId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onChange={(e) => e.target.value && assignRole(u.id, e.target.value)}
                        defaultValue=""
                        disabled={u.id === currentUserId}
                        title={u.id === currentUserId ? 'You cannot modify your own roles' : 'Select role to assign'}
                      >
                        <option value="" disabled>Select role to assign</option>
                        {roles
                          .filter((r) => {
                            const normalized = String(r.name || '').toLowerCase();
                            if (normalized === 'student') return false;
                            if (!isMainAdmin && normalized === 'main admin') return false;
                            return true;
                          })
                          .map((r) => (
                          <option key={r.id || r.name} value={r.name}>{r.name}</option>
                        ))}
                      </select>
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
