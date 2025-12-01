import React, { useState, useEffect } from 'react';
import { Card, Button, SkeletonCard, SkeletonList } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface Result {
  id: number;
  exam: { title: string; total_marks: number };
  score: number;
  completed_at: string;
  passed: boolean;
}

interface ResultStats {
  average_score: number;
  total_exams: number;
  pass_rate: number;
}

const MyResults: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Result[]>([]);
  const [stats, setStats] = useState<ResultStats>({
    average_score: 0,
    total_exams: 0,
    pass_rate: 0,
  });

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      const userData = localStorage.getItem('user');
      if (!userData) return;
      
      const user = JSON.parse(userData);
      const [resultsRes, statsRes] = await Promise.all([
        api.get(`/students/${user.id}/results`),
        api.get(`/analytics/student/${user.id}/dashboard`),
      ]);
      
      if (resultsRes.data) {
        setResults(resultsRes.data);
      }
      
      if (statsRes.data) {
        setStats({
          average_score: statsRes.data.average_score || 0,
          total_exams: statsRes.data.total_exams_taken || 0,
          pass_rate: statsRes.data.pass_rate || 0,
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch results:', error);
      showError('Failed to load your results.');
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onRefresh: loadResults,
  });

  const downloadPdf = () => {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    const user = JSON.parse(userData);
    window.open(`${api.defaults.baseURL}/reports/student/${user.id}/pdf`, '_blank');
    showSuccess('Downloading PDF report...');
  };

  const downloadExcel = () => {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    const user = JSON.parse(userData);
    window.open(`${api.defaults.baseURL}/reports/student/${user.id}/excel`, '_blank');
    showSuccess('Downloading Excel report...');
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Results</h1>
          <p className="text-gray-600 mt-2">View your exam performance</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadPdf} variant="secondary" className="flex items-center gap-2">
            <i className='bx bx-download'></i>
            <span>Download PDF</span>
          </Button>
          <Button onClick={downloadExcel} variant="secondary" className="flex items-center gap-2">
            <i className='bx bx-spreadsheet'></i>
            <span>Download Excel</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card className="bg-green-50">
              <p className="text-sm text-gray-600">Average Score</p>
              <h3 className="text-2xl font-bold text-green-600 mt-1">{`${stats.average_score.toFixed(1)}%`}</h3>
            </Card>
            <Card className="bg-blue-50">
              <p className="text-sm text-gray-600">Exams Taken</p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">{stats.total_exams}</h3>
            </Card>
            <Card className="bg-purple-50">
              <p className="text-sm text-gray-600">Pass Rate</p>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">{`${stats.pass_rate.toFixed(1)}%`}</h3>
            </Card>
          </>
        )}
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Recent Results</h2>
        {loading ? (
          <SkeletonList items={5} />
        ) : results.length === 0 ? (
          <p className="text-gray-500">No exam results yet. Take your first exam!</p>
        ) : (
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold">{result.exam.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Completed on {new Date(result.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {result.score}/{result.exam.total_marks}
                    </p>
                    <p className="text-sm">
                      <span className={result.passed ? 'text-green-600' : 'text-red-600'}>
                        {result.passed ? '✓ Passed' : '✗ Failed'}
                      </span>
                    </p>
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

export default MyResults;
