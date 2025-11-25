import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useExamStore from '../store/examStore';
import laravelApi from '../services/laravelApi';
import offlineSync from '../services/offlineSync';
import { Button, Card, Alert, Loading } from '../components';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { exams, fetchExams, checkPendingSync, hasPendingSync } = useExamStore();
  const [activeTab, setActiveTab] = useState('exams');
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/student-login');
      return;
    }
    
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load exams
      await fetchExams();

      // Load results
      const resultsRes = await laravelApi.get('/student/results');
      setResults(resultsRes?.data?.results || []);

      // Check for pending sync
      await checkPendingSync();
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (examId) => {
    navigate(`/exam/${examId}`);
  };

  const handleSyncNow = async () => {
    try {
      setLoading(true);
      const results = await offlineSync.syncAll();
      setSuccess(`Successfully synced ${results.length} attempt(s)`);
      await loadData();
    } catch (err) {
      setError('Failed to sync attempts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading fullScreen message="Loading your dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user?.first_name || user?.name}
            </p>
          </div>
          <Button variant="danger" onClick={() => { logout(); navigate('/student-login'); }}>
            Logout
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}
      {success && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <Alert type="success" message={success} onClose={() => setSuccess(null)} />
        </div>
      )}

      {/* Pending Sync Alert */}
      {hasPendingSync && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <Alert 
            type="warning" 
            title="Pending Sync"
            message="You have attempts waiting to sync. Click sync button below or they'll sync automatically when online."
            onClose={() => {}}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card title="Available Exams" subtitle={exams.length}>
            <p className="text-3xl font-bold text-blue-600">{exams.length}</p>
          </Card>
          <Card title="Completed Exams" subtitle={results.filter(r => r.status === 'released').length}>
            <p className="text-3xl font-bold text-green-600">{results.filter(r => r.status === 'released').length}</p>
          </Card>
          <Card title="Average Score" subtitle="From released exams">
            <p className="text-3xl font-bold text-purple-600">
              {results.length > 0 
                ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1)
                : 'N/A'}
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          {['exams', 'results', 'profile'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Available Exams Tab */}
          {activeTab === 'exams' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Available Exams</h2>
                {hasPendingSync && (
                  <Button onClick={handleSyncNow} variant="success">
                    Sync Now
                  </Button>
                )}
              </div>

              {exams.length === 0 ? (
                <Card>
                  <p className="text-gray-600 text-center py-8">No exams available yet. Check back soon!</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {exams.map(exam => (
                    <Card 
                      key={exam.id} 
                      title={exam.title}
                      subtitle={`${exam.class_level} • ${exam.duration_minutes} mins`}
                      clickable
                      onClick={() => handleExamClick(exam.id)}
                    >
                      <p className="text-sm text-gray-600 mb-3">
                        {exam.description || 'No description provided'}
                      </p>
                      <p className="text-xs text-gray-500 mb-4">
                        Questions: {exam.question_count || 0}
                      </p>
                      <Button 
                        fullWidth 
                        onClick={() => handleExamClick(exam.id)}
                      >
                        Start Exam
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Your Results</h2>

              {results.length === 0 ? (
                <Card>
                  <p className="text-gray-600 text-center py-8">No results released yet.</p>
                </Card>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Exam Title</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Score</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Duration</th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium">{result.exam_title}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              result.score >= 50 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {result.score}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">{(result.duration_seconds / 60).toFixed(0)} mins</td>
                          <td className="px-6 py-4 text-sm">
                            {new Date(result.submitted_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Personal Information">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{user?.first_name} {user?.last_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Student ID</label>
                    <p className="text-gray-900 font-mono">{user?.student_id}</p>
                  </div>
                </div>
              </Card>

              <Card title="Academic Information">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Class Level</label>
                    <p className="text-gray-900">{user?.class_level}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <p className="text-gray-900">{user?.department_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Registered On</label>
                    <p className="text-gray-900">{new Date(user?.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Personal Information">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{user?.first_name} {user?.last_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Student ID</label>
                    <p className="text-gray-900 font-mono">{user?.student_id}</p>
                  </div>
                </div>
              </Card>

              <Card title="Academic Information">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Class Level</label>
                    <p className="text-gray-900">{user?.class_level}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <p className="text-gray-900">{user?.department_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Registered On</label>
                    <p className="text-gray-900">{new Date(user?.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
