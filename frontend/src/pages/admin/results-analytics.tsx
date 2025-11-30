import React, { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';

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
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState('');

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
    <div className="p-4 space-y-4">
      <Card>
        <div className="flex items-center gap-2">
          <input className="border p-2" placeholder="Subject ID" onChange={e => setSubjectId(Number(e.target.value))} />
          <Button onClick={loadAnalytics} disabled={!subjectId}>Load Analytics</Button>
          <Button onClick={exportPdf} disabled={!subjectId}>Export PDF</Button>
          <Button onClick={exportExcel} disabled={!subjectId}>Export Excel</Button>
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
              <div>Attempt #{a.id} • Student {a.student_id}</div>
              <div className="text-sm text-gray-600">Score: {a.score}/{a.total_marks} ({a.percentage?.toFixed(2)}%)</div>
            </div>
          ))}
          {attempts.length === 0 && <div className="text-gray-500">No attempts.</div>}
        </div>
      </Card>
    </div>
  );
}
