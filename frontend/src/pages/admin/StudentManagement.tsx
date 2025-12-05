/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';
import { api, API_URL } from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';

interface Student {
  id: number;
  first_name: string;
  last_name: string;
  registration_number: string;
  email: string;
  department_id: number;
  class_level: string;
  status: string;
}

interface StudentStats {
  total: number;
  jss: number;
  sss: number;
  active: number;
}

const StudentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState<Array<{id: number; name: string}>>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState<null | Student>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    registration_number: '',
    department_id: 0,
    class_level: 'JSS1',
    status: 'active',
  });
  const [stats, setStats] = useState<StudentStats>({
    total: 0,
    jss: 0,
    sss: 0,
    active: 0,
  });

  useEffect(() => {
    loadStudents();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const response = await api.get('/departments');
      if (response.data) {
        setDepartments(response.data);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    }
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/students');
      if (response.data) {
        setStudents(response.data);
        calculateStats(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch students:', error);
      // Don't show error, just show empty state
      setStudents([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Student[]) => {
    setStats({
      total: data.length,
      jss: data.filter(s => s.class_level?.startsWith('JSS')).length,
      sss: data.filter(s => s.class_level?.startsWith('SSS')).length,
      active: data.filter(s => s.status === 'active').length,
    });
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this student?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/students/${id}`);
        showSuccess('Student deleted successfully');
        loadStudents();
      } catch (error) {
        showError('Failed to delete student');
      }
    }
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSuccess(`Imported ${response.data.imported} students successfully`);
      if (response.data.errors?.length > 0) {
        console.warn('Import errors:', response.data.errors);
      }
      loadStudents();
    } catch (error) {
      showError('Failed to import students');
    }
    event.target.value = ''; // Reset file input
  };

  const downloadTemplate = () => {
    window.open(`${API_URL}/students/import/template`, '_blank');
  };

  const exportStudents = () => {
    window.open(`${API_URL}/students/export`, '_blank');
    showSuccess('Downloading student list...');
  };

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(students.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await showDeleteConfirm(`Delete ${selectedIds.length} selected students?`);
    if (confirmed.isConfirmed) {
      try {
        await Promise.all(selectedIds.map(id => api.delete(`/students/${id}`)));
        showSuccess('Selected students deleted');
        setSelectedIds([]);
        loadStudents();
      } catch (error) {
        showError('Failed to delete selected students');
      }
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-600 mt-2">View and manage students</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'></i>
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search students"
            />
          </div>
          <Button onClick={() => setShowRegisterModal(true)} className="flex items-center gap-2">
            <i className='bx bx-user-plus'></i>
            <span>Register Student</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-purple-50">
          <p className="text-sm text-gray-600">Total Students</p>
          <h3 className="text-2xl font-bold text-purple-600 mt-1">{loading ? '...' : stats.total}</h3>
        </Card>
        <Card className="bg-blue-50">
          <p className="text-sm text-gray-600">JSS Students</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1">{loading ? '...' : stats.jss}</h3>
        </Card>
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">SSS Students</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">{loading ? '...' : stats.sss}</h3>
        </Card>
        <Card className="bg-indigo-50">
          <p className="text-sm text-gray-600">Active</p>
          <h3 className="text-2xl font-bold text-indigo-600 mt-1">{loading ? '...' : stats.active}</h3>
        </Card>
      </div>

      {/* Registration Options */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Register Students</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onClick={() => setShowRegisterModal(true)} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 cursor-pointer transition">
            <div className="text-4xl mb-3">
              <i className='bx bx-user-plus text-4xl'></i>
            </div>
            <h3 className="font-semibold mb-2">Single Registration</h3>
            <p className="text-sm text-gray-600">Register one student at a time</p>
          </div>
          <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 cursor-pointer transition">
            <input type="file" accept=".csv" onChange={handleBulkUpload} className="hidden" />
            <div className="text-4xl mb-3">
              <i className='bx bx-spreadsheet text-4xl'></i>
            </div>
            <h3 className="font-semibold mb-2">Bulk Upload</h3>
            <p className="text-sm text-gray-600">Import from Excel/CSV</p>
            <button onClick={(e) => { e.stopPropagation(); downloadTemplate(); }} className="mt-2 text-xs text-blue-600 hover:underline">
              Download Template
            </button>
          </label>
          <div onClick={exportStudents} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 cursor-pointer transition">
            <div className="text-4xl mb-3">
              <i className='bx bx-download text-4xl'></i>
            </div>
            <h3 className="font-semibold mb-2">Export List</h3>
            <p className="text-sm text-gray-600">Download student records</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Student List ({students.length})</h2>
          <Button variant="danger" disabled={selectedIds.length === 0} onClick={handleBatchDelete}>
            Delete Selected ({selectedIds.length})
          </Button>
        </div>
        {loading ? (
          <p className="text-gray-500">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="text-gray-500">{searchTerm ? 'No students match your search.' : 'No students registered yet.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-3"><input type="checkbox" title="Select all students" checked={selectedIds.length === students.length && students.length > 0} onChange={e => handleSelectAll(e.target.checked)} /></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reg. Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.filter(s => 
                  searchTerm === '' || 
                  s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.registration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.email.toLowerCase().includes(searchTerm.toLowerCase())
                ).map((student) => (
                  <tr key={student.id}>
                    <td className="px-2 py-4"><input type="checkbox" title="Select student" checked={selectedIds.includes(student.id)} onChange={e => handleSelectOne(student.id, e.target.checked)} /></td>
                    <td className="px-6 py-4 text-sm text-gray-900">{student.first_name} {student.last_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.registration_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.class_level}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => setShowViewModal(student)} className="text-blue-600 hover:text-blue-800 mr-3">View</button>
                      <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Register Student Modal */}
      <div className={`fixed inset-0 ${showRegisterModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowRegisterModal(false)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-lg font-semibold">Register Student</h3>
            <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowRegisterModal(false)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">First Name</label>
                <input className="mt-1 w-full border rounded px-3 py-2" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} aria-label="First name" placeholder="First name" />
              </div>
              <div>
                <label className="block text-sm font-medium">Last Name</label>
                <input className="mt-1 w-full border rounded px-3 py-2" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} aria-label="Last name" placeholder="Last name" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input type="email" className="mt-1 w-full border rounded px-3 py-2" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} aria-label="Email" placeholder="Email" />
              </div>
              <div>
                <label className="block text-sm font-medium">Registration Number</label>
                <input className="mt-1 w-full border rounded px-3 py-2" value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value })} aria-label="Registration number" placeholder="Reg. number" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Department</label>
                <select className="mt-1 w-full border rounded px-3 py-2" value={form.department_id} onChange={e => setForm({ ...form, department_id: Number(e.target.value) })} aria-label="Department">
                  <option value={0}>Select department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Class Level</label>
                <select className="mt-1 w-full border rounded px-3 py-2" value={form.class_level} onChange={e => setForm({ ...form, class_level: e.target.value })} aria-label="Class level">
                  {['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <button className="px-4 py-2 border rounded" onClick={() => setShowRegisterModal(false)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={async () => {
              try {
                await api.post('/students', form);
                showSuccess('Student registered');
                setShowRegisterModal(false);
                loadStudents();
              } catch (error) {
                showError('Failed to register student');
              }
            }}>Save</button>
          </div>
        </div>
      </div>

      {/* View Student Modal (no subjects) */}
      <div className={`fixed inset-0 ${showViewModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowViewModal(null)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl mx-4">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-lg font-semibold">Student Details</h3>
            <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowViewModal(null)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          {showViewModal && (
            <div className="p-4 space-y-2 text-sm">
              <p><strong>Name:</strong> {showViewModal.first_name} {showViewModal.last_name}</p>
              <p><strong>Email:</strong> {showViewModal.email}</p>
              <p><strong>Reg. Number:</strong> {showViewModal.registration_number}</p>
              <p><strong>Class:</strong> {showViewModal.class_level}</p>
              <p><strong>Status:</strong> {showViewModal.status}</p>
              {/* Subjects intentionally omitted */}
            </div>
          )}
          <div className="border-t px-4 py-3 flex justify-end">
            <button className="px-4 py-2 border rounded" onClick={() => setShowViewModal(null)}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentManagement;
