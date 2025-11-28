import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';

const ExamManagement: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exam Management</h1>
          <p className="text-gray-600 mt-2">Create and manage exams</p>
        </div>
        <Button onClick={() => navigate('/admin/exams/create')}>
          + Create New Exam
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50">
          <p className="text-sm text-gray-600">Total Exams</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1">28</h3>
        </Card>
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">Active</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">5</h3>
        </Card>
        <Card className="bg-orange-50">
          <p className="text-sm text-gray-600">Scheduled</p>
          <h3 className="text-2xl font-bold text-orange-600 mt-1">3</h3>
        </Card>
        <Card className="bg-gray-50">
          <p className="text-sm text-gray-600">Completed</p>
          <h3 className="text-2xl font-bold text-gray-600 mt-1">20</h3>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">All Exams</h2>
        <p className="text-gray-500">Exam list will appear here</p>
      </Card>
    </div>
  );
};

export default ExamManagement;
