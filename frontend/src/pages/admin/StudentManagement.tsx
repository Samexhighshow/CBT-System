/* eslint-disable */
import React, { useState, useEffect, useMemo } from 'react';
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
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'reg_asc' | 'reg_desc' | 'class_asc' | 'class_desc'>('name_asc');
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [departments, setDepartments] = useState<Array<{id: number; name: string}>>([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState<null | Student>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
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
        setDepartments(response.data.data || response.data);
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
        const students = response.data.data || response.data;
        setStudents(students);
        calculateStats(students);
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

  const filteredSortedStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let rows = students.filter((s) =>
      term === '' ||
      s.first_name.toLowerCase().includes(term) ||
      s.last_name.toLowerCase().includes(term) ||
      s.registration_number.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term)
    );

    rows = [...rows].sort((a, b) => {
      const aName = `${a.first_name} ${a.last_name}`.toLowerCase();
      const bName = `${b.first_name} ${b.last_name}`.toLowerCase();
      switch (sortBy) {
        case 'name_desc':
          return bName.localeCompare(aName);
        case 'reg_asc':
          return a.registration_number.localeCompare(b.registration_number);
        case 'reg_desc':
          return b.registration_number.localeCompare(a.registration_number);
        case 'class_asc':
          return (a.class_level || '').localeCompare(b.class_level || '');
        case 'class_desc':
          return (b.class_level || '').localeCompare(a.class_level || '');
        case 'name_asc':
        default:
          return aName.localeCompare(bName);
      }
    });

    return rows;
  }, [students, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedStudents.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedStudents = filteredSortedStudents.slice((currentPage - 1) * perPage, currentPage * perPage);

  const getPageNumbers = (current: number, total: number): Array<number | string> => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: Array<number | string> = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (end < total - 1) pages.push('...');
    pages.push(total);
    return pages;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageIds = pagedStudents.map((s) => s.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(pagedStudents.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds(prev => checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(i => i !== id));
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

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [searchTerm, sortBy, perPage]);

  return (
    <div className="app-shell section-shell">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Student Management</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">View and manage students</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm'></i>
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search students"
            />
          </div>
          <Button onClick={() => setShowRegisterModal(true)} className="flex items-center gap-2 text-xs md:text-sm py-1.5 px-3">
            <i className='bx bx-user-plus text-sm'></i>
            <span className="hidden md:inline">Register Student</span>
            <span className="md:hidden">Register</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-4">
        <Card className="bg-purple-50 panel-compact">
          <p className="text-xs md:text-sm text-gray-600">Total Students</p>
          <h3 className="text-lg md:text-xl font-bold text-purple-600 mt-1">{loading ? '...' : stats.total}</h3>
        </Card>
        <Card className="bg-blue-50 panel-compact">
          <p className="text-xs md:text-sm text-gray-600">JSS Students</p>
          <h3 className="text-lg md:text-xl font-bold text-blue-600 mt-1">{loading ? '...' : stats.jss}</h3>
        </Card>
        <Card className="bg-green-50 panel-compact">
          <p className="text-xs md:text-sm text-gray-600">SSS Students</p>
          <h3 className="text-lg md:text-xl font-bold text-green-600 mt-1">{loading ? '...' : stats.sss}</h3>
        </Card>
        <Card className="bg-indigo-50 panel-compact">
          <p className="text-xs md:text-sm text-gray-600">Active</p>
          <h3 className="text-lg md:text-xl font-bold text-indigo-600 mt-1">{loading ? '...' : stats.active}</h3>
        </Card>
      </div>

      {/* Registration Options */}
      <Card className="panel-compact">
        <h2 className="text-lg md:text-xl font-semibold mb-3">Register Students</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div onClick={() => setShowRegisterModal(true)} className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-6 text-center hover:border-blue-500 cursor-pointer transition">
            <div className="text-3xl md:text-4xl mb-2">
              <i className='bx bx-user-plus text-3xl md:text-4xl'></i>
            </div>
            <h3 className="font-semibold text-sm md:text-base mb-1">Single Registration</h3>
            <p className="text-xs md:text-sm text-gray-600">Register one student at a time</p>
          </div>
          <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-6 text-center hover:border-green-500 cursor-pointer transition">
            <input type="file" accept=".csv" onChange={handleBulkUpload} className="hidden" />
            <div className="text-3xl md:text-4xl mb-2">
              <i className='bx bx-spreadsheet text-3xl md:text-4xl'></i>
            </div>
            <h3 className="font-semibold text-sm md:text-base mb-1">Bulk Upload</h3>
            <p className="text-xs md:text-sm text-gray-600">Import from Excel/CSV</p>
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-semibold">Student List</h2>
            <p className="text-xs text-gray-600">
              {filteredSortedStudents.length} matching students
              {filteredSortedStudents.length > 0 ? ` | Showing ${((currentPage - 1) * perPage) + 1}-${Math.min(currentPage * perPage, filteredSortedStudents.length)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
            >
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="reg_asc">Reg No A-Z</option>
              <option value="reg_desc">Reg No Z-A</option>
              <option value="class_asc">Class A-Z</option>
              <option value="class_desc">Class Z-A</option>
            </select>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <Button variant="danger" disabled={selectedIds.length === 0} onClick={handleBatchDelete}>
              Delete Selected ({selectedIds.length})
            </Button>
          </div>
        </div>

        <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                title="Select current page students"
                checked={pagedStudents.length > 0 && pagedStudents.every((s) => selectedIds.includes(s.id))}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="text-sm font-semibold text-blue-800">
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select Page'}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading students...</p>
        ) : filteredSortedStudents.length === 0 ? (
          <p className="text-gray-500">{searchTerm ? 'No students match your search.' : 'No students registered yet.'}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs border-collapse bg-white">
                <thead>
                  <tr className="sticky top-0 z-10 bg-gray-50 text-gray-700 border-b">
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        title="Select current page students"
                        checked={pagedStudents.length > 0 && pagedStudents.every((s) => selectedIds.includes(s.id))}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Reg. Number</th>
                    <th className="px-3 py-2 text-left font-semibold">Email</th>
                    <th className="px-3 py-2 text-left font-semibold">Class</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStudents.map((student, index) => (
                    <tr
                      key={student.id}
                      className={`border-b border-gray-200 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      } hover:bg-blue-50/60 ${selectedIds.includes(student.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          title="Select student"
                          checked={selectedIds.includes(student.id)}
                          onChange={(e) => handleSelectOne(student.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900">{student.first_name} {student.last_name}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{student.registration_number}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-[220px]">
                        <span className="truncate block" title={student.email}>{student.email}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">{student.class_level}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <button onClick={() => setShowViewModal(student)} className="text-blue-600 hover:text-blue-800 mr-3">View</button>
                        <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-800">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 px-1 py-3 border-t border-gray-200 bg-gray-50/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="text-gray-600">
                Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, filteredSortedStudents.length)} of {filteredSortedStudents.length}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Prev
                </button>
                {getPageNumbers(currentPage, totalPages).map((pageNum, idx) => (
                  pageNum === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum as number)}
                      className={`min-w-[34px] px-2.5 py-1.5 border rounded-md ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
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
                <input className="mt-1 w-full border rounded px-3 py-2 bg-gray-50 text-gray-500" value="Auto-generated" readOnly aria-label="Registration number auto generated" />
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
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Registration number and temporary password will be generated automatically and sent to the student's email.
            </div>
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <button className="px-4 py-2 border rounded" onClick={() => setShowRegisterModal(false)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={async () => {
              try {
                await api.post('/students', { ...form, quick_register: true });
                showSuccess('Student created and onboarding email sent');
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
