import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';
import { api } from '../../services/api';
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
  const [stats, setStats] = useState<StudentStats>({
    total: 0,
    jss: 0,
    sss: 0,
    active: 0,
  });

  useEffect(() => {
    loadStudents();
  }, []);

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
      showError('Failed to load students. Please try again.');
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-600 mt-2">View and manage students</p>
        </div>
        <Button onClick={() => navigate('/admin/students/register')}>
          + Register Student
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      <Card>
        <h2 className="text-xl font-semibold mb-4">Student List</h2>
        {loading ? (
          <p className="text-gray-500">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="text-gray-500">No students registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reg. Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">{student.first_name} {student.last_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.registration_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.class_level}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => navigate(`/admin/students/${student.id}`)} className="text-blue-600 hover:text-blue-800 mr-3">View</button>
                      <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default StudentManagement;
