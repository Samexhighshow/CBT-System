import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  marks: number;
  subject: string;
  class_level: string;
}

const QuestionBank: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-600 mt-2">Manage your exam questions</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={() => navigate('/admin/questions/upload')} variant="secondary">
            📤 Upload Questions
          </Button>
          <Button onClick={() => navigate('/admin/questions/create')}>
            + Create Question
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50">
          <p className="text-sm text-gray-600">Total Questions</p>
          <h3 className="text-2xl font-bold text-blue-600 mt-1">520</h3>
        </Card>
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">Multiple Choice</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">385</h3>
        </Card>
        <Card className="bg-purple-50">
          <p className="text-sm text-gray-600">True/False</p>
          <h3 className="text-2xl font-bold text-purple-600 mt-1">95</h3>
        </Card>
        <Card className="bg-orange-50">
          <p className="text-sm text-gray-600">Essay</p>
          <h3 className="text-2xl font-bold text-orange-600 mt-1">40</h3>
        </Card>
      </div>

      {/* Upload Options */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Upload Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 cursor-pointer transition">
            <div className="text-4xl mb-3">📄</div>
            <h3 className="font-semibold mb-2">Upload CSV File</h3>
            <p className="text-sm text-gray-600">Bulk upload questions from CSV</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 cursor-pointer transition">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold mb-2">Upload Excel File</h3>
            <p className="text-sm text-gray-600">Import questions from Excel</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 cursor-pointer transition">
            <div className="text-4xl mb-3">✏️</div>
            <h3 className="font-semibold mb-2">Manual Entry</h3>
            <p className="text-sm text-gray-600">Add questions one by one</p>
          </div>
        </div>
      </Card>

      {/* Recent Questions */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Recent Questions</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-500" colSpan={5}>
                  No questions yet. Start by uploading or creating questions.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default QuestionBank;
