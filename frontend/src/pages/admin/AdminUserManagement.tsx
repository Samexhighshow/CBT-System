import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { showSuccess, showError, showConfirm } from '../../utils/alerts';
import { Card } from '../../components';

interface Role { name: string; }
interface User { id: number; name: string; email: string; email_verified_at?: string | null; roles: Role[]; }

// Define module access for each role (Student role is managed separately)
const roleModules: Record<string, string[]> = {
  'Main Admin': ['Dashboard', 'Users', 'Roles', 'System Settings', 'Questions', 'Exams', 'Students', 'Subjects', 'Results', 'Reports', 'Analytics'],
  'Admin': ['Dashboard', 'Questions', 'Exams', 'Students', 'Subjects', 'Results', 'Reports', 'Analytics'],
  'Sub-Admin': ['Dashboard', 'Questions', 'Exams', 'Students', 'Results', 'Analytics'],
  'Moderator': ['Dashboard', 'Exams', 'Students', 'Results', 'Analytics'],
  'Teacher': ['Dashboard', 'Questions', 'Results', 'Analytics']
};

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyApplicants, setOnlyApplicants] = useState(true);
  const [showRoleDetails, setShowRoleDetails] = useState(false);
  const navigate = useNavigate();
  
  // Get current logged-in user ID
  const currentUserId = (() => {
    try {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData).id : null;
    } catch {
      return null;
    }
  })();

  // Use shared api client which injects `auth_token` automatically
  const [editMode, setEditMode] = useState(false);
  const availableModules = ['Dashboard','Users','Roles','System Settings','Questions','Exams','Students','Subjects','Results','Reports','Analytics','Profile','Classes'];
  const [roleModulesState, setRoleModulesState] = useState<Record<string, string[]>>(roleModules);

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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const res = await api.get(`/roles`);
        setRoles(res.data as any);
      } catch (e) {
        // ignore
      }
    };
    loadRoles();
  }, []);

  const assignRole = async (userId: number, roleName: string) => {
    // Prevent assigning role to current user
    if (userId === currentUserId) {
      showError('You cannot modify your own roles');
      return;
    }
    
    const confirm = await showConfirm(`Assign role "${roleName}"?`);
    if (!confirm) return;
    try {
      await api.post(`/roles/assign/${userId}`, { role: roleName });
      showSuccess('Role assigned');
      fetchUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to assign role';
      showError(msg);
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/admin/roles-permissions')}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs md:text-sm"
          >
            Open Roles & Permissions
          </button>
          <button
            onClick={() => setShowRoleDetails(!showRoleDetails)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs md:text-sm"
          >
            {showRoleDetails ? 'Hide' : 'View'} Role Permissions
          </button>
        </div>
      </div>

      {/* Role Permissions Card */}
      {showRoleDetails && (
        <Card className="panel-compact">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-3">
            <h2 className="text-lg md:text-xl font-semibold">Role Module Access</h2>
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-2 py-1.5 text-xs md:text-sm border rounded hover:bg-gray-50"
            >
              {editMode ? 'Done' : 'Edit Role Permissions'}
            </button>
          </div>
          <p className="text-xs md:text-sm text-gray-600 mb-3">
            This table shows which modules each role can access in the system.
          </p>
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
                    await api.post('/admin/roles/modules', roleModulesState);
                    showSuccess('Role permissions updated');
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
                        {roles.filter(r => r !== 'Student').map(r => (
                          <option key={r} value={r}>{r}</option>
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
