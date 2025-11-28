import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  marks: number;
  subject: string;
  class_level: string;
}

interface QuestionStats {
  total_questions: number;
  multiple_choice: number;
  true_false: number;
  essay: number;
}

const QuestionBank: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuestionStats>({
    total_questions: 0,
    multiple_choice: 0,
    true_false: 0,
    essay: 0,
  });
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/questions');
      if (response.data) {
        setQuestions(response.data);
        calculateStats(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch questions:', error);
      showError('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Question[]) => {
    setStats({
      total_questions: data.length,
      multiple_choice: data.filter(q => q.question_type === 'multiple_choice').length,
      true_false: data.filter(q => q.question_type === 'true_false').length,
      essay: data.filter(q => q.question_type === 'essay').length,
    });
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this question?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/questions/${id}`);
        showSuccess('Question deleted successfully');
        loadData();
      } catch (error) {
        showError('Failed to delete question');
      }
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/questions/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSuccess('Questions imported successfully');
      loadData();
    } catch (error) {
      showError('Failed to import questions');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/questions/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'questions.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('Questions exported successfully');
    } catch (error) {
      showError('Failed to export questions');
    }
  };

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
          <h3 className="text-2xl font-bold text-blue-600 mt-1">{loading ? '...' : stats.total_questions}</h3>
        </Card>
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">Multiple Choice</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">{loading ? '...' : stats.multiple_choice}</h3>
        </Card>
        <Card className="bg-purple-50">
          <p className="text-sm text-gray-600">True/False</p>
          <h3 className="text-2xl font-bold text-purple-600 mt-1">{loading ? '...' : stats.true_false}</h3>
        </Card>
        <Card className="bg-orange-50">
          <p className="text-sm text-gray-600">Essay</p>
          <h3 className="text-2xl font-bold text-orange-600 mt-1">{loading ? '...' : stats.essay}</h3>
        </Card>
      </div>

      {/* Upload Options */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Upload Questions</h2>
          <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 cursor-pointer transition">
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
            <div className="text-4xl mb-3">📄</div>
            <h3 className="font-semibold mb-2">Upload CSV File</h3>
            <p className="text-sm text-gray-600">Bulk upload questions from CSV</p>
          </label>
          <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 cursor-pointer transition">
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold mb-2">Upload Excel File</h3>
            <p className="text-sm text-gray-600">Import questions from Excel</p>
          </label>
          <div onClick={() => navigate('/admin/questions/create')} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 cursor-pointer transition">
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
              {loading ? (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500 text-center" colSpan={5}>
                    Loading questions...
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500 text-center" colSpan={5}>
                    No questions yet. Start by uploading or creating questions.
                  </td>
                </tr>
              ) : (
                questions.slice(0, 10).map((question) => (
                  <tr key={question.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">{question.question_text.substring(0, 80)}...</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{question.question_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{question.subject}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{question.marks}</td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => navigate(`/admin/questions/${question.id}`)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                      <button onClick={() => handleDelete(question.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default QuestionBank;
