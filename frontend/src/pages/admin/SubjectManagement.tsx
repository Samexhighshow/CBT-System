import React from 'react';
import { Card, Button } from '../../components';

const SubjectManagement: React.FC = () => {
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
          <h2 className="text-xl font-semibold mb-4">Departments</h2>
          <p className="text-gray-500">Department list will appear here</p>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold mb-4">Subjects</h2>
          <p className="text-gray-500">Subject list will appear here</p>
        </Card>
      </div>
    </div>
  );
};

export default SubjectManagement;
