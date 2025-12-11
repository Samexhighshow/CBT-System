import React, { useState, useEffect } from 'react';
import { Card, Button, SkeletonCard, SkeletonList } from '../../components';
import { api, API_URL } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';

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

interface ReportCardSubject {
  attempt_id: number;
  subject_id: number;
  subject: string;
  class_level: string;
  score: number;
  total_marks: number;
  percentage: number | null;
  grade?: string | null;
  status: string;
  submitted_at?: string | null;
}

interface ReportCard {
  student_id: number;
  student_name: string;
  student_email?: string;
  class_level: string;
  average_percentage: number;
  pass_rate: number;
  total_subjects: number;
  results: ReportCardSubject[];
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
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);

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
      const params = new URLSearchParams();
      if (studentName) params.append('student_name', studentName);
      if (classLevel) params.append('class_level', classLevel);
      if (subjectId) params.append('subject_id', subjectId);

      const analyticsRes = await api.get(`/results/analytics?${params.toString()}`);
      if (analyticsRes.data) setAnalytics(analyticsRes.data);

      const resultsRes = await api.get(`/cbt/results?${params.toString()}`);
      if (resultsRes.data?.results) setAttempts(resultsRes.data.results);

      const reportCardsRes = await api.get(`/results/report-cards?${params.toString()}`);
      if (reportCardsRes.data?.report_cards) setReportCards(reportCardsRes.data.report_cards);
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      // Don't show error, just use default empty state
      setAnalytics({
        average_score: 0,
        pass_rate: 0,
        total_submissions: 0,
      });
      setAttempts([]);
      setReportCards([]);
    } finally {
      setLoading(false);
    }
  };

  const emailResults = async (studentId: number) => {
    try {
      await api.post(`/results/email/${studentId}`);
      showSuccess('Results emailed successfully');
    } catch (error: any) {
      console.error('Failed to email results:', error);
      showError('Could not email results for this student');
    }
  };

  const downloadPdf = (subjectId: number) => {
    window.open(`${API_URL}/reports/exam/${subjectId}/pdf`, '_blank');
    showSuccess('Downloading PDF report...');
  };

  const downloadExcel = (subjectId: number) => {
    window.open(`${API_URL}/reports/exam/${subjectId}/excel`, '_blank');
    showSuccess('Downloading Excel report...');
  };
  
  return (
    <div className="app-shell section-shell">
      <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Results & Analytics</h1>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">View exam results and performance metrics</p>
        </div>
        {subjectId && (
          <div className="flex flex-col md:flex-row gap-2">
            <Button onClick={() => downloadPdf(Number(subjectId))} variant="secondary" className="flex items-center gap-2 text-xs md:text-sm py-1.5 px-2">
              <i className='bx bx-download text-sm'></i>
              <span className="hidden md:inline">Download PDF</span>
              <span className="md:hidden">PDF</span>
            </Button>
            <Button onClick={() => downloadExcel(Number(subjectId))} variant="secondary" className="flex items-center gap-2 text-xs md:text-sm py-1.5 px-2">
              <i className='bx bx-spreadsheet text-sm'></i>
              <span className="hidden md:inline">Download Excel</span>
              <span className="md:hidden">Excel</span>
            </Button>
          </div>
        )}
      </div>

      <Card className="panel-compact">
        <div className="flex flex-col gap-2 flex-wrap">
          <input
            className="border p-1.5 rounded text-sm"
            placeholder="Student Name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
          <select
            className="border p-1.5 rounded text-sm"
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
            className="border p-1.5 rounded text-sm"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="Subject filter"
          >
            <option value="">All Subjects</option>
            {cbtSubjects.map(s => (
              <option key={s.id} value={s.id}>{s.subject_name} ({s.class_level})</option>
            ))}
          </select>
          <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm" onClick={loadAnalytics}>
            Refresh Analytics
          </button>
        </div>
      </Card>

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
                <h3 className="text-2xl font-bold text-green-600 mt-1">
                  {`${Number(analytics.average_score ?? 0).toFixed(1)}%`}
                </h3>
            </Card>
            <Card className="bg-blue-50">
              <p className="text-sm text-gray-600">Pass Rate</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-1">
                  {`${Number(analytics.pass_rate ?? 0).toFixed(1)}%`}
                </h3>
            </Card>
            <Card className="bg-purple-50">
              <p className="text-sm text-gray-600">Submissions</p>
                <h3 className="text-2xl font-bold text-purple-600 mt-1">
                  {Number(analytics.total_submissions ?? 0).toLocaleString()}
                </h3>
            </Card>
          </>
        )}
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Report Cards</h2>
        {loading && <SkeletonList />}
        {!loading && reportCards.length === 0 && (
          <p className="text-gray-500">No report cards found for the selected filters.</p>
        )}
        {!loading && reportCards.length > 0 && (
          <div className="space-y-4">
            {reportCards.map((rc) => (
              <div key={rc.student_id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-600">{rc.class_level || 'Class N/A'}</p>
                    <h3 className="text-lg font-semibold text-gray-900">{rc.student_name}</h3>
                    {rc.student_email && <p className="text-xs text-gray-500">{rc.student_email}</p>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="px-3 py-1 rounded bg-green-100 text-green-800">Avg: {rc.average_percentage.toFixed(1)}%</span>
                    <span className="px-3 py-1 rounded bg-blue-100 text-blue-800">Pass: {rc.pass_rate.toFixed(1)}%</span>
                    <span className="px-3 py-1 rounded bg-purple-100 text-purple-800">Subjects: {rc.total_subjects}</span>
                    <Button size="sm" variant="secondary" onClick={() => emailResults(rc.student_id)}>
                      Email Results
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto mt-3">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rc.results.map((res) => (
                        <tr key={res.attempt_id}>
                          <td className="px-3 py-2 text-sm">{res.subject}</td>
                          <td className="px-3 py-2 text-sm">{res.class_level}</td>
                          <td className="px-3 py-2 text-sm">{res.score}/{res.total_marks} ({(res.percentage ?? 0).toFixed(1)}%)</td>
                          <td className="px-3 py-2 text-sm">{res.grade ?? 'N/A'}</td>
                          <td className="px-3 py-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${res.status === 'graded' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {res.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm">{res.submitted_at ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Attempt Details</h2>
        {attempts.length === 0 && !loading && (
          <p className="text-gray-500">No attempts found for the selected filters.</p>
        )}
        {loading && <SkeletonList />}
        {!loading && attempts.length > 0 && (
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
        )}
      </Card>
    </div>
    </div>
  );
};

export default ResultsAnalytics;
