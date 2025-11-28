import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';

const AvailableExams: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Available Exams</h1>
        <p className="text-gray-600 mt-2">Select an exam to begin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition cursor-pointer">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">Mathematics Mid-Term</h3>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
            </div>
            <p className="text-sm text-gray-600">SSS 2 • First Term</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">⏱ 60 minutes</span>
              <span className="text-gray-600">📝 30 questions</span>
            </div>
            <Button onClick={() => navigate('/exam/1')} className="w-full">
              Start Exam
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AvailableExams;
