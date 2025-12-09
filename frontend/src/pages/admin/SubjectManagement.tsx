import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input } from '../../components';
import api from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';

interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
}


interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
}

interface SchoolClass {
  id: number;
  name: string;
  code: string;
  department_id: number;
  description: string;
  capacity: number;
  is_active: boolean;
}

const SubjectManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', description: '' });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [classForm, setClassForm] = useState({ name: '', code: '', department_id: 0, description: '', capacity: 30, is_active: true });
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);

  const handleSelectAllSubjects = (checked: boolean) => {
    setSelectedSubjectIds(checked && Array.isArray(subjects) ? subjects.map((s: Subject) => s.id) : []);
  };
  const handleSelectOneSubject = (id: number, checked: boolean) => {
    setSelectedSubjectIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };
  const handleBatchDeleteSubjects = async () => {
    if (selectedSubjectIds.length === 0) return;
    const confirmed = await showDeleteConfirm(`Delete ${selectedSubjectIds.length} selected subjects?`);
    if (confirmed.isConfirmed) {
      try {
        await Promise.all(selectedSubjectIds.map(id => api.delete(`/subjects/${id}`)));
        showSuccess('Selected subjects deleted');
        setSelectedSubjectIds([]);
        loadData();
      } catch (error) {
        showError('Failed to delete selected subjects');
      }
    }
  };

  const handleSelectAllClasses = (checked: boolean) => {
    setSelectedClassIds(checked && Array.isArray(classes) ? classes.map((c: SchoolClass) => c.id) : []);
  };
  const handleSelectOneClass = (id: number, checked: boolean) => {
    setSelectedClassIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };
  const handleBatchDeleteClasses = async () => {
    if (selectedClassIds.length === 0) return;
    const confirmed = await showDeleteConfirm(`Delete ${selectedClassIds.length} selected classes?`);
    if (confirmed.isConfirmed) {
      try {
        await Promise.all(selectedClassIds.map(id => api.delete(`/classes/${id}`)));
        showSuccess('Selected classes deleted');
        setSelectedClassIds([]);
        loadClasses();
      } catch (error) {
        showError('Failed to delete selected classes');
      }
    }
  };

  useEffect(() => {
    loadData();
    loadClasses();
  }, []);


  const loadData = async () => {
    try {
      setLoading(true);
      const [subjectsRes, deptRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/departments'),
      ]);
      const subjectsData = subjectsRes.data.data || subjectsRes.data || [];
      const deptData = deptRes.data.data || deptRes.data || [];
      
      // Ensure we have arrays
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      setSubjects([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const res = await api.get('/classes');
      const classesData = res.data.data || res.data || [];
      setClasses(Array.isArray(classesData) ? classesData : []);
    } catch (error) {
      setClasses([]);
    }
  };

  const handleDeleteSubject = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this subject?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/subjects/${id}`);
        showSuccess('Subject deleted successfully');
        loadData();
      } catch (error) {
        showError('Failed to delete subject');
      }
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this department?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/departments/${id}`);
        showSuccess('Department deleted successfully');
        loadData();
      } catch (error) {
        showError('Failed to delete department');
      }
    }
  };
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subjects, Classes & Departments</h1>
          <p className="text-gray-600 mt-2">Manage academic structure</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => setShowDeptModal(true)} className="flex items-center gap-2">
            <i className='bx bx-plus-circle'></i>
            <span>Add Department</span>
          </Button>
          <Button onClick={() => setShowSubjectModal(true)} className="flex items-center gap-2">
            <i className='bx bx-plus-circle'></i>
            <span>Add Subject</span>
          </Button>
          <Button onClick={() => setShowClassModal(true)} className="flex items-center gap-2">
            <i className='bx bx-plus-circle'></i>
            <span>Add Class</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-semibold">Classes ({classes.length})</h2>
                    <Button variant="danger" disabled={selectedClassIds.length === 0} onClick={handleBatchDeleteClasses}>
                      Delete Selected ({selectedClassIds.length})
                    </Button>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <i className='bx bx-loader-alt bx-spin text-3xl text-gray-400'></i>
                    </div>
                  ) : classes.length === 0 ? (
                    <div className="text-center py-8">
                      <i className='bx bx-grid-alt text-5xl text-gray-300 mb-3'></i>
                      <p className="text-gray-500">No classes available</p>
                      <p className="text-gray-400 text-sm mt-1">Click "Add Class" to create one</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-3">
                              <input type="checkbox" checked={Array.isArray(classes) && selectedClassIds.length === classes.length && classes.length > 0} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectAllClasses(e.target.checked)} title="Select all classes" />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Array.isArray(classes) && classes.map((cls) => (
                            <tr key={cls.id}>
                              <td className="px-2 py-4">
                                <input type="checkbox" checked={selectedClassIds.includes(cls.id)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectOneClass(cls.id, e.target.checked)} title={`Select class ${cls.name}`} />
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold">{cls.name}</td>
                              <td className="px-6 py-4 text-sm">{cls.code}</td>
                              <td className="px-6 py-4 text-sm">{Array.isArray(departments) && departments.find(d => d.id === cls.department_id)?.name || 'N/A'}</td>
                              <td className="px-6 py-4 text-sm">{cls.capacity}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${cls.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{cls.is_active ? 'Active' : 'Inactive'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              {/* Add Class Modal */}
              <div className={`fixed inset-0 ${showClassModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
                <div className="absolute inset-0 bg-black/40" onClick={() => setShowClassModal(false)} />
                <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-lg font-semibold">Add Class</h3>
                    <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowClassModal(false)}>
                      <i className='bx bx-x text-2xl'></i>
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium">Name</label>
                      <input className="mt-1 w-full border rounded px-3 py-2" value={classForm.name} onChange={e => setClassForm({...classForm, name: e.target.value})} aria-label="Class name" placeholder="Class name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Code</label>
                      <input className="mt-1 w-full border rounded px-3 py-2" value={classForm.code} onChange={e => setClassForm({...classForm, code: e.target.value})} aria-label="Class code" placeholder="Class code" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Department</label>
                      <select className="mt-1 w-full border rounded px-3 py-2" value={classForm.department_id} onChange={e => setClassForm({...classForm, department_id: Number(e.target.value)})} aria-label="Department">
                        <option value={0}>Select department</option>
                        {Array.isArray(departments) && departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Description</label>
                      <textarea className="mt-1 w-full border rounded px-3 py-2" rows={2} value={classForm.description} onChange={e => setClassForm({...classForm, description: e.target.value})} aria-label="Class description" placeholder="Description" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Capacity</label>
                      <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={classForm.capacity} min={1} max={200} onChange={e => setClassForm({...classForm, capacity: Number(e.target.value)})} aria-label="Class capacity" placeholder="Capacity" />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input type="checkbox" checked={classForm.is_active} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClassForm({...classForm, is_active: e.target.checked})} title="Class is active" />
                      <span>Active</span>
                    </div>
                  </div>
                  <div className="border-t px-4 py-3 flex justify-end gap-2">
                    <button className="px-4 py-2 border rounded" onClick={() => setShowClassModal(false)}>Cancel</button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={async () => {
                      try {
                        await api.post('/classes', classForm);
                        showSuccess('Class added');
                        setShowClassModal(false);
                        loadClasses();
                      } catch (error) {
                        showError('Failed to add class');
                      }
                    }}>Save</button>
                  </div>
                </div>
              </div>
        <Card>
          <h2 className="text-xl font-semibold mb-4">Departments ({Array.isArray(departments) ? departments.length : 0})</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <i className='bx bx-loader-alt bx-spin text-3xl text-gray-400'></i>
            </div>
          ) : !Array.isArray(departments) || departments.length === 0 ? (
            <div className="text-center py-8">
              <i className='bx bx-folder-open text-5xl text-gray-300 mb-3'></i>
              <p className="text-gray-500">No departments available</p>
              <p className="text-gray-400 text-sm mt-1">Click "Add Department" to create one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {departments.map((dept) => (
                <div key={dept.id} className="border rounded p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{dept.name}</h3>
                      <p className="text-sm text-gray-600">Code: {dept.code}</p>
                    </div>
                    <button onClick={() => handleDeleteDepartment(dept.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">Subjects ({subjects.length})</h2>
            <Button variant="danger" disabled={selectedSubjectIds.length === 0} onClick={handleBatchDeleteSubjects}>
              Delete Selected ({selectedSubjectIds.length})
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <i className='bx bx-loader-alt bx-spin text-3xl text-gray-400'></i>
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8">
              <i className='bx bx-book text-5xl text-gray-300 mb-3'></i>
              <p className="text-gray-500">No subjects available</p>
              <p className="text-gray-400 text-sm mt-1">Click "Add Subject" to create one</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3">
                      <input type="checkbox" checked={Array.isArray(subjects) && selectedSubjectIds.length === subjects.length && subjects.length > 0} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectAllSubjects(e.target.checked)} title="Select all subjects" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.isArray(subjects) && subjects.map((subject) => (
                    <tr key={subject.id}>
                      <td className="px-2 py-4">
                        <input type="checkbox" checked={selectedSubjectIds.includes(subject.id)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSelectOneSubject(subject.id, e.target.checked)} title={`Select subject ${subject.name}`} />
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">{subject.name}</td>
                      <td className="px-6 py-4 text-sm">{subject.code}</td>
                      <td className="px-6 py-4 text-sm">{subject.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add Subject Modal */}
      <div className={`fixed inset-0 ${showSubjectModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowSubjectModal(false)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-lg font-semibold">Add Subject</h3>
            <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowSubjectModal(false)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={subjectForm.name} onChange={e => setSubjectForm({...subjectForm, name: e.target.value})} aria-label="Subject name" placeholder="Subject name" />
            </div>
            <div>
              <label className="block text-sm font-medium">Code</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={subjectForm.code} onChange={e => setSubjectForm({...subjectForm, code: e.target.value})} aria-label="Subject code" placeholder="Subject code" />
            </div>
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={subjectForm.description} onChange={e => setSubjectForm({...subjectForm, description: e.target.value})} aria-label="Subject description" placeholder="Description" />
            </div>
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <button className="px-4 py-2 border rounded" onClick={() => setShowSubjectModal(false)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={async () => {
              try {
                await api.post('/subjects', subjectForm);
                showSuccess('Subject added');
                setShowSubjectModal(false);
                loadData();
              } catch (error) {
                showError('Failed to add subject');
              }
            }}>Save</button>
          </div>
        </div>
      </div>

      {/* Add Department Modal */}
      <div className={`fixed inset-0 ${showDeptModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeptModal(false)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-lg font-semibold">Add Department</h3>
            <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowDeptModal(false)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} aria-label="Department name" placeholder="Department name" />
            </div>
            <div>
              <label className="block text-sm font-medium">Code</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={deptForm.code} onChange={e => setDeptForm({...deptForm, code: e.target.value})} aria-label="Department code" placeholder="Department code" />
            </div>
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} aria-label="Department description" placeholder="Description" />
            </div>
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <button className="px-4 py-2 border rounded" onClick={() => setShowDeptModal(false)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={async () => {
              try {
                await api.post('/departments', deptForm);
                showSuccess('Department added');
                setShowDeptModal(false);
                loadData();
              } catch (error) {
                showError('Failed to add department');
              }
            }}>Save</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default SubjectManagement;
