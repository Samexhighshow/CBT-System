import React, { useState, useEffect } from 'react';
import { Card } from '../../components';
import { api } from '../../services/api';
// import { showError } from '../../utils/alerts';

interface AnalyticsData {
  average_score: number;
  pass_rate: number;
  total_submissions: number;
}

interface AttemptSummary {
  id: number;
  student_name: string;
  subject: string;
  class_level: string;
  score: number;
  total_marks: number;
  percentage?: number;
  status: string;
}

interface CbtSubject {
  id: number;
  subject_name: string;
  class_level: string;
}

const ResultsAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    average_score: 0,
    pass_rate: 0,
    total_submissions: 0,
  });
  const [subjectId, setSubjectId] = useState<string>('');
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [studentName, setStudentName] = useState<string>('');
  const [classLevel, setClassLevel] = useState<string>('');
  const [cbtSubjects, setCbtSubjects] = useState<CbtSubject[]>([]);

  useEffect(() => {
    loadAnalytics();
    loadCbtSubjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCbtSubjects = async () => {
    try {
      const response = await api.get('/cbt/subjects');
      if (response.data?.subjects) {
        setCbtSubjects(response.data.subjects);
      }
    } catch (error: any) {
      console.error('Failed to fetch CBT subjects:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Global analytics
      const response = await api.get('/results/analytics');
      if (response.data) setAnalytics(response.data);

      // Load filtered results
      const params = new URLSearchParams();
      if (studentName) params.append('student_name', studentName);
      if (classLevel) params.append('class_level', classLevel);
      if (subjectId) params.append('subject_id', subjectId);

      const resultsRes = await api.get(`/cbt/results?${params.toString()}`);
      if (resultsRes.data?.results) {
        setAttempts(resultsRes.data.results);
      }
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      // Don't show error, just use default empty state
      setAnalytics({
        average_score: 0,
        pass_rate: 0,
        total_submissions: 0,
      });
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Results & Analytics</h1>
        <p className="text-gray-600 mt-2">View exam results and performance metrics</p>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            className="border p-2 rounded"
            placeholder="Student Name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
          <select
            className="border p-2 rounded"
            value={classLevel}
            onChange={(e) => setClassLevel(e.target.value)}
            aria-label="Class level filter"
          >
            <option value="">All Classes</option>
            <option value="JSS1">JSS1</option>
            <option value="JSS2">JSS2</option>
            <option value="JSS3">JSS3</option>
            <option value="SSS1">SSS1</option>
            <option value="SSS2">SSS2</option>
            <option value="SSS3">SSS3</option>
          </select>
          <select
            className="border p-2 rounded"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="Subject filter"
          >
            <option value="">All Subjects</option>
            {cbtSubjects.map(s => (
              <option key={s.id} value={s.id}>{s.subject_name} ({s.class_level})</option>
            ))}
          </select>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={loadAnalytics}>
            Refresh Analytics
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50">
          <p className="text-sm text-gray-600">Average Score</p>
            <h3 className="text-2xl font-bold text-green-600 mt-1">
              {loading ? '...' : `${Number(analytics.average_score ?? 0).toFixed(1)}%`}
            </h3>
        </Card>
        <Card className="bg-blue-50">
          <p className="text-sm text-gray-600">Pass Rate</p>
            <h3 className="text-2xl font-bold text-blue-600 mt-1">
              {loading ? '...' : `${Number(analytics.pass_rate ?? 0).toFixed(1)}%`}
            </h3>
        </Card>
        <Card className="bg-purple-50">
          <p className="text-sm text-gray-600">Submissions</p>
            <h3 className="text-2xl font-bold text-purple-600 mt-1">
              {loading ? '...' : Number(analytics.total_submissions ?? 0).toLocaleString()}
            </h3>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Performance Analytics</h2>
        <p className="text-gray-500 mb-4">Charts and analytics will appear here</p>
        {attempts.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Results ({attempts.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attempts.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 text-sm">{a.student_name}</td>
                      <td className="px-4 py-2 text-sm">{a.subject}</td>
                      <td className="px-4 py-2 text-sm">{a.class_level}</td>
                      <td className="px-4 py-2 text-sm">{a.score}/{a.total_marks} ({(a.percentage ?? 0).toFixed(1)}%)</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${a.status === 'graded' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ResultsAnalytics;
