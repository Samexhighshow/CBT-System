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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Roles & Users</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-semibold mb-3">Roles</h2>
            <ul className="space-y-2">
              {roles.map(r => (
                <li key={r.id} className="px-3 py-2 border rounded">{r.name}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-3">Users</h2>
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-sm text-gray-600">{u.email}</p>
                      <p className="text-xs text-gray-500">Roles: {u.roles?.map(r => r.name).join(', ') || 'None'}</p>
                    </div>
                    <div>
                      <select
                        className="border rounded px-2 py-1"
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
