import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components';
import api from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
import { adminNavLinks } from '../../config/adminNav';

interface Role { id: number; name: string; }
interface User { id: number; name: string; email: string; roles?: Role[] }
interface Page { id: number; name: string; path: string; category?: string; permission_name: string; }
type RolePageMap = Record<number, number[]>;

const RolesManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [rolePageMap, setRolePageMap] = useState<RolePageMap>({});
  const [loading, setLoading] = useState(true);
  const [syncingPages, setSyncingPages] = useState(false);

  const flatNavPages = useMemo(() => {
    const items: { name: string; path: string; category?: string }[] = [];
    adminNavLinks.forEach((nav) => {
      items.push({ name: nav.name, path: nav.path, category: nav.subItems ? nav.name : undefined });
      if (nav.subItems) {
        nav.subItems.forEach((sub) => items.push({ name: sub.name, path: sub.path, category: nav.name }));
      }
    });
    return items;
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesRes, usersRes, pagesRes, roleMapRes] = await Promise.all([
        api.get('/admin/roles'),
        api.get('/admin/users'),
        api.get('/admin/pages'),
        api.get('/admin/pages/role-map')
      ]);
      setRoles(rolesRes.data || []);
      setUsers(usersRes.data || []);
      setPages(pagesRes.data?.pages || []);
      const map: RolePageMap = {};
      (roleMapRes.data || []).forEach((item: { role_id: number; page_ids: number[] }) => {
        map[item.role_id] = item.page_ids;
      });
      setRolePageMap(map);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load roles/users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const assignRole = async (userId: number, roleName: string) => {
    try {
      await api.post(`/admin/users/${userId}/roles`, { role: roleName });
      showSuccess('Role assigned');
      loadData();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to assign role');
    }
  };

  const toggleRolePage = async (roleId: number, pageId: number) => {
    const current = rolePageMap[roleId] || [];
    const next = current.includes(pageId)
      ? current.filter((id) => id !== pageId)
      : [...current, pageId];

    setRolePageMap({ ...rolePageMap, [roleId]: next });

    try {
      await api.post(`/admin/roles/${roleId}/pages`, { page_ids: next });
      showSuccess('Permissions updated');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to update permissions');
    }
  };

  const syncNavigationPages = async () => {
    try {
      setSyncingPages(true);
      await api.post('/admin/pages/sync', { pages: flatNavPages });
      await loadData();
      showSuccess('Navigation synced to permissions');
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to sync navigation');
    } finally {
      setSyncingPages(false);
    }
  };

  return (
    <div className="app-shell section-shell">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Roles & Permissions</h1>
        <button
          onClick={syncNavigationPages}
          className="px-3 py-2 bg-blue-600 text-white rounded text-sm flex items-center gap-2 disabled:opacity-60"
          disabled={syncingPages}
        >
          <i className={`bx ${syncingPages ? 'bx-loader-alt animate-spin' : 'bx-sync'} text-lg`}></i>
          <span>{syncingPages ? 'Syncing...' : 'Sync Navigation Pages'}</span>
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-600">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="panel-compact">
            <h2 className="text-lg font-semibold mb-2">Roles</h2>
            <ul className="space-y-1.5">
              {roles.map(r => (
                <li key={r.id} className="px-2 py-1.5 border rounded text-sm">{r.name}</li>
              ))}
            </ul>
          </Card>

          <Card className="panel-compact lg:col-span-2">
            <h2 className="text-lg font-semibold mb-2">Users</h2>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="p-2 border rounded text-sm">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-xs text-gray-600">{u.email}</p>
                      <p className="text-xs text-gray-500">Roles: {u.roles?.map(r => r.name).join(', ') || 'None'}</p>
                    </div>
                    <div>
                      <select
                        className="border rounded px-2 py-1 text-xs"
                        onChange={(e) => assignRole(u.id, e.target.value)}
                        defaultValue=""
                        aria-label={`Assign role to ${u.name}`}
                      >
                        <option value="" disabled>Assign role</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="panel-compact lg:col-span-3">
            <h2 className="text-lg font-semibold mb-2">Page Access by Role</h2>
            {pages.length === 0 ? (
              <p className="text-sm text-gray-600">No pages synced yet. Click "Sync Navigation Pages" to import.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Page</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Path</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                      {roles.map((r) => (
                        <th key={r.id} className="px-2 py-2 text-center font-medium text-gray-600">{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pages.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{p.name}</td>
                        <td className="px-3 py-2 text-gray-700">{p.path}</td>
                        <td className="px-3 py-2 text-gray-700">{p.category || '-'}</td>
                        {roles.map((r) => {
                          const checked = (rolePageMap[r.id] || []).includes(p.id);
                          return (
                            <td key={r.id} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRolePage(r.id, p.id)}
                                className="w-4 h-4"
                                aria-label={`${r.name} access to ${p.name}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default RolesManagement;
