import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import { api } from '../../services/api';
import { showError } from '../../utils/alerts';

interface Subject {
  id: number;
  name: string;
  code: string;
}

interface SchoolClass {
  id: number;
  name: string;
  code: string;
}

type Summary = {
  highest: number;
  lowest: number;
  average: number;
};

type Attempt = {
  id: number;
  student_id: number;
  score: number;
  total_marks: number;
  percentage?: number;
};

export default function ResultsAnalytics() {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/preferences/options');
      setSubjects(res.data?.subjects || []);
      setClasses(res.data?.classes || []);
    } catch (err) {
      showError('Failed to load subjects and classes');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!subjectId) return;
    setError('');
    try {
      const res = await fetch(`/api/results/subject/${subjectId}`);
      const data = await res.json();
      setSummary(data?.summary ?? null);
      setAttempts(data?.attempts ?? []);
    } catch (e) {
      setError('Failed to load results');
    }
  };

  const exportPdf = () => {
    if (!subjectId) return;
    window.open(`/api/reports/subject/${subjectId}/pdf`, '_blank');
  };

  const exportExcel = () => {
    if (!subjectId) return;
    window.open(`/api/reports/subject/${subjectId}/excel`, '_blank');
  };

  return (
    <div className="app-shell section-shell">
      <h1 className="text-2xl font-bold mb-4">Results & Analytics</h1>
      
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class (Optional)
            </label>
            <select
              value={classId || ''}
              onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">-- All Classes --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.code ? `(${cls.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <select
              value={subjectId || ''}
              onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : null)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">-- Select Subject --</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={loadAnalytics} disabled={!subjectId || loading} className="flex-1">
              Load Analytics
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={exportPdf} disabled={!subjectId} variant="outline" size="sm">
            <i className="bx bx-file-blank mr-1"></i> Export PDF
          </Button>
          <Button onClick={exportExcel} disabled={!subjectId} variant="outline" size="sm">
            <i className="bx bx-spreadsheet mr-1"></i> Export Excel
          </Button>
        </div>
      </Card>

      {error && <Alert type="error" message={error} />}

      {summary && (
        <Card>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Highest</div>
              <div className="text-2xl font-bold">{summary.highest}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Lowest</div>
              <div className="text-2xl font-bold">{summary.lowest}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Average</div>
              <div className="text-2xl font-bold">{summary.average.toFixed(2)}</div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold mb-2">Attempts</h3>
        <div className="space-y-2">
          {attempts.map(a => (
            <div key={a.id} className="border p-2 rounded">
              <div>Attempt {a.id} • Student {a.student_id}</div>
              <div className="text-sm text-gray-600">Score: {a.score}/{a.total_marks} ({a.percentage?.toFixed(2)}%)</div>
            </div>
          ))}
          {attempts.length === 0 && <div className="text-gray-500">No attempts.</div>}
        </div>
      </Card>
    </div>
  );
}
