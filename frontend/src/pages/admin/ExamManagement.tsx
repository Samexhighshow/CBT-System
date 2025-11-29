import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';

interface Exam {
  id: number;
  title: string;
  description: string;
  subject_id: number;
  duration: number;
  total_marks: number;
  passing_marks: number;
  status: string;
  start_time: string;
  end_time: string;
}

interface ExamStats {
  total: number;
  active: number;
  scheduled: number;
  completed: number;
}

const ExamManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [stats, setStats] = useState<ExamStats>({
    total: 0,
    active: 0,
    scheduled: 0,
    completed: 0,
  });

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/exams');
      if (response.data) {
        setExams(response.data);
        calculateStats(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
      // Don't show error, just show empty state
      setExams([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Exam[]) => {
    const now = new Date();
    setStats({
      total: data.length,
      active: data.filter(e => e.status === 'published' && new Date(e.start_time) <= now && new Date(e.end_time) >= now).length,
      scheduled: data.filter(e => e.status === 'published' && new Date(e.start_time) > now).length,
      completed: data.filter(e => e.status === 'completed' || new Date(e.end_time) < now).length,
    });
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this exam?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/exams/${id}`);
        showSuccess('Exam deleted successfully');
        loadExams();
      } catch (error) {
        showError('Failed to delete exam');
      }
    }
  };

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
          <h3 className="text-2xl font-bold text-blue-600 mt-1">{loading ? '...' : stats.total}</h3>
        </Card>
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">Active</p>
          <h3 className="text-2xl font-bold text-green-600 mt-1">{loading ? '...' : stats.active}</h3>
        </Card>
        <Card className="bg-orange-50">
          <p className="text-sm text-gray-600">Scheduled</p>
          <h3 className="text-2xl font-bold text-orange-600 mt-1">{loading ? '...' : stats.scheduled}</h3>
        </Card>
        <Card className="bg-gray-50">
          <p className="text-sm text-gray-600">Completed</p>
          <h3 className="text-2xl font-bold text-gray-600 mt-1">{loading ? '...' : stats.completed}</h3>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">All Exams</h2>
        {loading ? (
          <p className="text-gray-500">Loading exams...</p>
        ) : exams.length === 0 ? (
          <p className="text-gray-500">No exams yet. Create your first exam.</p>
        ) : (
          <div className="space-y-4">
            {exams.map((exam) => (
              <div key={exam.id} className="border rounded-lg p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{exam.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{exam.description}</p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      <span>⏱ {exam.duration} min</span>
                      <span>📝 {exam.total_marks} marks</span>
                      <span className={`px-2 py-1 rounded ${exam.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {exam.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/admin/exams/${exam.id}`)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                    <button onClick={() => handleDelete(exam.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ExamManagement;
