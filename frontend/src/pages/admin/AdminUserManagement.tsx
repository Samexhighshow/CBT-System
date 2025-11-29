import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { showSuccess, showError, showConfirm } from '../../utils/alerts';

interface Role { id: number; name: string; }
interface User { id: number; name: string; email: string; email_verified_at?: string | null; roles: Role[]; }

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyApplicants, setOnlyApplicants] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/users', { params: { only_applicants: onlyApplicants ? 1 : undefined } });
      setUsers(res.data.data || res.data);
    } catch (err: any) {
      showError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [onlyApplicants]);

  const assignRole = async (userId: number, roleName: string) => {
    const confirm = await showConfirm(`Assign role "${roleName}"?`);
    if (!confirm) return;
    try {
      await axios.post(`http://127.0.0.1:8000/api/roles/assign/${userId}`, { role: roleName });
      showSuccess('Role assigned');
      fetchUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to assign role';
      showError(msg);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Admin User Management</h1>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyApplicants} onChange={e=>setOnlyApplicants(e.target.checked)} />
          Show only applicants (no roles)
        </label>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Email</th>
                <th className="p-2 border">Verified</th>
                <th className="p-2 border">Roles</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="p-2 border">{u.name}</td>
                  <td className="p-2 border">{u.email}</td>
                  <td className="p-2 border">{u.email_verified_at ? 'Yes' : 'No'}</td>
                  <td className="p-2 border">{u.roles?.map(r=>r.name).join(', ') || '-'}</td>
                  <td className="p-2 border">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 text-xs bg-green-600 text-white rounded" onClick={()=>assignRole(u.id, 'Admin')}>Make Admin</button>
                      <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded" onClick={()=>assignRole(u.id, 'Moderator')}>Moderator</button>
                      <button className="px-2 py-1 text-xs bg-purple-600 text-white rounded" onClick={()=>assignRole(u.id, 'Teacher')}>Teacher</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-600 mt-3">Only Main Admin should access this page. Ensure backend checks or middleware restrict access appropriately.</p>
    </div>
  );
};

export default AdminUserManagement;
