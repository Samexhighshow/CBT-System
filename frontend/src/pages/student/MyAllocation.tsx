import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components';
import { api } from '../../services/api';
import { showError } from '../../utils/alerts';
import { getCurrentStudentProfile } from './studentData';

interface ExamOption {
  id: number;
  title: string;
  start_datetime?: string;
  end_datetime?: string;
  start_time?: string;
  end_time?: string;
  subject?: { name?: string };
}

interface AllocationPayload {
  id: number;
  hall?: {
    id: number;
    name?: string;
    code?: string;
    building?: string;
    floor?: string;
    notes?: string;
  };
  row: number;
  column: number;
  seat_number: number;
}

const formatDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString();
};

const MyAllocation: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [fetchingAllocation, setFetchingAllocation] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [allocation, setAllocation] = useState<AllocationPayload | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const student = await getCurrentStudentProfile();
        setStudentId(student.id);

        const examResponse = await api.get(`/students/${student.id}/exams`);
        const rows: ExamOption[] = examResponse.data?.data || examResponse.data || [];
        const normalizedRows = Array.isArray(rows) ? rows : [];
        setExams(normalizedRows);

        if (normalizedRows.length > 0) {
          setSelectedExamId(normalizedRows[0].id);
        } else {
          setMessage('No available exams found to display seat allocation.');
        }
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Failed to load your exam allocations.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const fetchAllocation = async () => {
      if (!selectedExamId || !studentId) return;

      try {
        setFetchingAllocation(true);
        setMessage('');
        const response = await api.get(`/allocations/student/${selectedExamId}/${studentId}`);
        setAllocation(response.data?.allocation || null);
        if (!response.data?.allocation) {
          setMessage('No seat allocation found yet for this exam.');
        }
      } catch (error: any) {
        setAllocation(null);
        setMessage(error?.response?.data?.message || 'No seat allocation found yet for this exam.');
      } finally {
        setFetchingAllocation(false);
      }
    };

    fetchAllocation();
  }, [selectedExamId, studentId]);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Seat Allocation</h1>
        <p className="text-sm text-slate-600 mt-1">Select an exam to view your hall and assigned seat.</p>
      </div>

      {loading ? (
        <Card><p className="text-sm text-slate-500">Loading allocation data...</p></Card>
      ) : (
        <>
          <Card>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Exam</label>
            <select
              value={selectedExamId || ''}
              onChange={(e) => setSelectedExamId(Number(e.target.value) || null)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
            >
              <option value="">Select exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.title}</option>
              ))}
            </select>
          </Card>

          {selectedExam && (
            <Card className="bg-slate-50 border border-slate-200">
              <p className="text-sm font-semibold text-slate-900">{selectedExam.title}</p>
              <p className="text-xs text-slate-600 mt-1">
                {selectedExam.subject?.name || 'General'} • Start: {formatDate(selectedExam.start_datetime || selectedExam.start_time)} • End: {formatDate(selectedExam.end_datetime || selectedExam.end_time)}
              </p>
            </Card>
          )}

          {fetchingAllocation ? (
            <Card><p className="text-sm text-slate-500">Checking your seat allocation...</p></Card>
          ) : allocation ? (
            <>
              <Card className="border border-cyan-200 bg-cyan-50">
                <h2 className="text-xl font-bold text-cyan-900">Allocated Seat</h2>
                <div className="grid gap-3 sm:grid-cols-2 mt-3 text-sm">
                  <div>
                    <p className="text-slate-500">Hall</p>
                    <p className="font-semibold text-slate-900">{allocation.hall?.name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Seat Number</p>
                    <p className="font-semibold text-slate-900">{allocation.seat_number}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Row</p>
                    <p className="font-semibold text-slate-900">{allocation.row}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Column</p>
                    <p className="font-semibold text-slate-900">{allocation.column}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Important Instructions</h3>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>Arrive at least 15 minutes before exam start time.</li>
                  <li>Bring your valid student identification.</li>
                  <li>Sit only at your allocated seat to avoid malpractice flags.</li>
                  <li>Follow invigilator instructions throughout the exam.</li>
                </ul>
              </Card>
            </>
          ) : (
            <Card><p className="text-sm text-slate-500">{message || 'No seat allocation is available for the selected exam.'}</p></Card>
          )}
        </>
      )}
    </div>
  );
};

export default MyAllocation;
