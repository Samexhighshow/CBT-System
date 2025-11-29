import React, { useState, useEffect } from 'react';
import { Card, Button } from '../../components';
import { api } from '../../services/api';
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

const SubjectManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subjectsRes, deptRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/departments'),
      ]);
      setSubjects(subjectsRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      // Don't show error, just show empty state
      setSubjects([]);
      setDepartments([]);
    } finally {
      setLoading(false);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subjects & Departments</h1>
          <p className="text-gray-600 mt-2">Manage academic structure</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary">+ Add Department</Button>
          <Button>+ Add Subject</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-xl font-semibold mb-4">Departments ({departments.length})</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <i className='bx bx-loader-alt bx-spin text-3xl text-gray-400'></i>
            </div>
          ) : departments.length === 0 ? (
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
          <h2 className="text-xl font-semibold mb-4">Subjects ({subjects.length})</h2>
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
            <div className="space-y-3">
              {subjects.map((subject) => (
                <div key={subject.id} className="border rounded p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{subject.name}</h3>
                      <p className="text-sm text-gray-600">Code: {subject.code}</p>
                    </div>
                    <button onClick={() => handleDeleteSubject(subject.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SubjectManagement;
