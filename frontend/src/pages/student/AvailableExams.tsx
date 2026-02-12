import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components';
import { api } from '../../services/api';
import { showError } from '../../utils/alerts';
import { getCurrentStudentProfile } from './studentData';

interface StudentExam {
  id: number;
  title: string;
  description?: string;
  duration_minutes?: number;
  total_marks?: number;
  passing_marks?: number;
  subject?: { name?: string };
  class_level?: string;
  start_datetime?: string;
  end_datetime?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
}

const formatDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString();
};

const AvailableExams: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<StudentExam[]>([]);

  useEffect(() => {
    const loadAvailableExams = async () => {
      try {
        setLoading(true);
        const student = await getCurrentStudentProfile();
        const response = await api.get(`/students/${student.id}/exams`);
        const rows: StudentExam[] = response.data?.data || response.data || [];
        setExams(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.error('Failed to fetch student exams', error);
        showError('Failed to load available exams for your account.');
        setExams([]);
      } finally {
        setLoading(false);
      }
    };

    loadAvailableExams();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Available Exams</h1>
        <p className="text-sm text-slate-600 mt-1">Start any currently open exam from this list.</p>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading available exams...</p>
        </Card>
      ) : exams.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <i className="bx bx-info-circle text-3xl text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">No available exams right now.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => {
            const start = exam.start_datetime || exam.start_time;
            const end = exam.end_datetime || exam.end_time;

            return (
              <Card key={exam.id} className="border border-slate-200 hover:border-cyan-300 transition">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-slate-900 leading-snug">{exam.title}</h2>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {exam.status || 'Open'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    {exam.subject?.name || 'General'} • {exam.class_level || 'Class not set'}
                  </p>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                    <p><span className="font-semibold">Duration:</span> {exam.duration_minutes || 0} minutes</p>
                    <p><span className="font-semibold">Total Marks:</span> {exam.total_marks || 0}</p>
                    <p><span className="font-semibold">Start:</span> {formatDate(start)}</p>
                    <p><span className="font-semibold">End:</span> {formatDate(end)}</p>
                  </div>

                  <Button onClick={() => navigate(`/exam/${exam.id}`)} className="w-full">
                    Start Exam
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AvailableExams;
