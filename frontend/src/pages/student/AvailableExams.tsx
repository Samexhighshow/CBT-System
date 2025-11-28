import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';
import { api } from '../../services/api';
import { showError } from '../../utils/alerts';

interface Exam {
  id: number;
  title: string;
  description: string;
  duration: number;
  total_marks: number;
  subject: { name: string };
  class_level: string;
  start_time: string;
  end_time: string;
}

const AvailableExams: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    loadAvailableExams();
  }, []);

  const loadAvailableExams = async () => {
    try {
      setLoading(true);
      const userData = localStorage.getItem('user');
      if (!userData) return;
      
      const user = JSON.parse(userData);
      const response = await api.get(`/students/${user.id}/exams`);
      
      if (response.data) {
        setExams(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
      showError('Failed to load available exams.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Available Exams</h1>
        <p className="text-gray-600 mt-2">Select an exam to begin</p>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading available exams...</p>
      ) : exams.length === 0 ? (
        <Card>
          <p className="text-gray-500 text-center py-8">No exams available at the moment.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <Card key={exam.id} className="hover:shadow-lg transition cursor-pointer">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold">{exam.title}</h3>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
                </div>
                <p className="text-sm text-gray-600">{exam.subject?.name || 'N/A'} • {exam.class_level}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">⏱ {exam.duration} minutes</span>
                  <span className="text-gray-600">📝 {exam.total_marks} marks</span>
                </div>
                <Button onClick={() => navigate(`/exam/${exam.id}`)} className="w-full">
                  Start Exam
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailableExams;
