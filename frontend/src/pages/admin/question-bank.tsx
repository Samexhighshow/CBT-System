import React, { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Alert } from '../../components/Alert';

type Subject = {
  id: number;
  subject_name: string;
  class_level: string;
  shuffle_questions: boolean;
  questions_required: number;
};

type Question = {
  id: number;
  question: string;
  question_type: string;
  points: number;
};

export default function QuestionBank() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // TODO: Replace with real fetch to subjects endpoint
    // Placeholder fetch or store integration
  }, []);

  const loadQuestions = async () => {
    if (!selectedSubject) return;
    setStatus('Loading questions...');
    setError('');
    try {
      const res = await fetch(`/api/subjects/${selectedSubject}`);
      const data = await res.json();
      setQuestions(data?.questions ?? []);
      setStatus('');
    } catch (e) {
      setError('Failed to load questions');
      setStatus('');
    }
  };

  const downloadSample = () => {
    window.open('/api/cbt/sample-csv', '_blank');
  };

  const handleUpload = async () => {
    if (!selectedSubject || !file) return;
    setStatus('Uploading CSV...');
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/cbt/subjects/${selectedSubject}/questions/import`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setStatus(`Inserted ${data.inserted} questions. ${data.invalid.length} invalid.`);
        loadQuestions();
      } else {
        setError(data.message || 'Upload failed');
      }
    } catch (e) {
      setError('Upload failed');
    } finally {
      setStatus('');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <div className="flex items-center gap-2">
          <select className="border p-2" value={selectedSubject ?? ''} onChange={e => setSelectedSubject(Number(e.target.value))}>
            <option value="">Select subject</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.subject_name} ({s.class_level})</option>
            ))}
          </select>
          <Button onClick={downloadSample}>Download Sample CSV</Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Input type="file" accept=".csv,.txt" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <Button onClick={handleUpload} disabled={!selectedSubject || !file}>Upload CSV</Button>
          <Button onClick={loadQuestions} disabled={!selectedSubject}>Refresh Questions</Button>
        </div>
        {status && <Alert type="info" message={status} />}
        {error && <Alert type="error" message={error} />}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-2">Questions</h3>
        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className="border p-2 rounded">
              <div className="font-medium">{q.question}</div>
              <div className="text-sm text-gray-600">Type: {q.question_type} • Points: {q.points}</div>
            </div>
          ))}
          {questions.length === 0 && <div className="text-gray-500">No questions yet.</div>}
        </div>
      </Card>
    </div>
  );
}
