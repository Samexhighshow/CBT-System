import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components';
import { api } from '../../services/api';
import { showError } from '../../utils/alerts';
import { getCurrentStudentProfile } from './studentData';
import useConnectivity from '../../hooks/useConnectivity';
import offlineDB from '../../services/offlineDB';

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
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<StudentExam[]>([]);
  const connectivity = useConnectivity();

  useEffect(() => {
    const loadAvailableExams = async () => {
      try {
        setLoading(true);
        if (connectivity.status === 'OFFLINE') {
          const cached = await offlineDB.examPackages.toArray();
          const rows: StudentExam[] = cached.map((pkg) => {
            const payload = pkg.data?.exam || pkg.data || {};
            return {
              id: payload.id ?? pkg.examId,
              title: payload.title || 'Cached Exam',
              duration_minutes: payload.duration_minutes,
              subject: payload.subject,
              class_level: payload.class_level,
              start_datetime: payload.start_datetime,
              end_datetime: payload.end_datetime,
              status: 'Cached',
            };
          });
          setExams(rows);
          return;
        }

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
  }, [connectivity.status]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Available Exams</h1>
        <p className="text-sm text-slate-600 mt-1">Review open exams and use the CBT portal to begin.</p>
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => {
            const start = exam.start_datetime || exam.start_time;
            const end = exam.end_datetime || exam.end_time;

            return (
              <Card key={exam.id} className="border border-slate-200 hover:border-cyan-300 transition">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{exam.subject?.name || 'General'}</p>
                      <h2 className="text-lg font-semibold text-slate-900 leading-snug mt-1">{exam.title}</h2>
                      <p className="text-xs text-slate-600 mt-1">{exam.class_level || 'Class not set'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      {exam.status || 'Open'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 grid gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Duration</span>
                      <span>{exam.duration_minutes || 0} minutes</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total Marks</span>
                      <span>{exam.total_marks || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Start</span>
                      <span>{formatDate(start)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">End</span>
                      <span>{formatDate(end)}</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-cyan-50 border border-cyan-100 px-3 py-2 text-xs text-cyan-900">
                    Use the CBT access portal with your exam code to begin.
                    <Link to="/cbt" className="ml-2 font-semibold text-cyan-700 hover:text-cyan-800">
                      Open portal
                    </Link>
                  </div>
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
