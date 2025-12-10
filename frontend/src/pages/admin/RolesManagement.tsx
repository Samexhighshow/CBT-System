import React, { useEffect, useState } from 'react';
import { Card } from '../../components';
import api from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';

interface Role { id: number; name: string; }
interface User { id: number; name: string; email: string; roles?: Role[] }

const RolesManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesRes, usersRes] = await Promise.all([
        api.get('/admin/roles'),
        api.get('/admin/users')
      ]);
      setRoles(rolesRes.data || []);
      setUsers(usersRes.data || []);
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

  return (
    <div className="app-shell section-shell">
      <h1 className="text-2xl md:text-3xl font-bold mb-4">Roles & Users</h1>
      {loading ? (
        <p className="text-sm text-gray-600">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="panel-compact">
            <h2 className="text-lg font-semibold mb-2">Roles</h2>
            <ul className="space-y-1.5">
              {roles.map(r => (
                <li key={r.id} className="px-2 py-1.5 border rounded text-sm">{r.name}</li>
              ))}
            </ul>
          </Card>

          <Card className="panel-compact">
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
        </div>
      )}
    </div>
  );
};

export default RolesManagement;
