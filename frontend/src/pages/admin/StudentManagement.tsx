import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';

const StudentManagement: React.FC = () => {
  const navigate = useNavigate();

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
          <h3 className="text-2xl font-bold text-purple-600 mt-1">245</h3>
        </Card>
        <Card className="bg-blue-50">
          <p className="text-sm text-gray-600">JSS Students</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1">120</h3>
        </Card>
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">SSS Students</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">125</h3>
        </Card>
        <Card className="bg-indigo-50">
          <p className="text-sm text-gray-600">Active</p>
          <h3 className="text-2xl font-bold text-indigo-600 mt-1">238</h3>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Student List</h2>
        <p className="text-gray-500">Student records will appear here</p>
      </Card>
    </div>
  );
};

export default StudentManagement;
