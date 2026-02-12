import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cbtApi } from '../services/cbtApi';
import { saveStoredSession } from '../services/sessionStore';
import { CbtOpenExam } from '../types';

const getDeviceId = () => {
  const key = 'cbt-device-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const generated = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, generated);
  return generated;
};

const CbtAccessPortal: React.FC = () => {
  const navigate = useNavigate();

  const [exams, setExams] = useState<CbtOpenExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [regNumber, setRegNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  const loadExams = async (reg?: string) => {
    try {
      setLoadingExams(true);
      const data = await cbtApi.listExams(reg);
      setExams(data);
      if (data.length > 0 && !selectedExamId) {
        setSelectedExamId(data[0].id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load available exams');
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  };

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCheckAvailability = async () => {
    setError(null);
    await loadExams(regNumber.trim() || undefined);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedExamId) {
      setError('Select an exam before proceeding.');
      return;
    }

    if (!regNumber.trim() || !accessCode.trim()) {
      setError('Registration number and access code are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const verification = await cbtApi.verifyExamAccess(selectedExamId, {
        reg_number: regNumber.trim().toUpperCase(),
        access_code: accessCode.trim().toUpperCase(),
        device_id: getDeviceId(),
      });

      saveStoredSession({
        attemptId: verification.attempt_id,
        sessionToken: verification.session_token,
        endsAt: verification.ends_at,
        examTitle: verification.exam?.title,
        studentName: verification.student?.name,
        registrationNumber: verification.student?.registration_number,
      });

      navigate(`/cbt/attempt/${verification.attempt_id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to verify access code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-2xl border border-slate-700/70 bg-slate-900/80 backdrop-blur px-6 py-5 shadow-2xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">CBT Examination Portal</p>
              <h1 className="mt-1 text-2xl md:text-3xl font-bold">Secure Student Access</h1>
            </div>
            <p className="text-xs md:text-sm text-slate-300 max-w-md">
              Enter your registration number and exam access code issued from the admin Exam Access portal.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Published Exams</h2>
              <button
                type="button"
                onClick={onCheckAvailability}
                className="rounded-md border border-cyan-500/50 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/10 transition"
              >
                Refresh
              </button>
            </div>

            {loadingExams ? (
              <div className="py-12 text-center text-slate-400">Loading exams...</div>
            ) : exams.length === 0 ? (
              <div className="py-12 text-center text-slate-400">No open exams are currently available.</div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                {exams.map((exam) => {
                  const selected = exam.id === selectedExamId;
                  return (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => setSelectedExamId(exam.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        selected
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{exam.title}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {exam.subject || 'General'} • {exam.class_level || 'All Classes'} • {exam.duration_minutes} mins
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            exam.can_access
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-200'
                          }`}
                        >
                          {exam.can_access ? 'Available' : 'Restricted'}
                        </span>
                      </div>
                      {exam.reason && !exam.can_access && (
                        <p className="mt-2 text-[11px] text-amber-200">{exam.reason}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Exam Login</h2>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-300 mb-1">Selected Exam</label>
                <div className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 min-h-[42px]">
                  {selectedExam ? selectedExam.title : 'Choose an exam from the list'}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-300 mb-1">Registration Number</label>
                <input
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm uppercase outline-none focus:border-cyan-400"
                  placeholder="e.g. REG001"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-300 mb-1">Access Code</label>
                <input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-cyan-400"
                  placeholder="8-Character Code"
                  maxLength={16}
                  required
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Verifying Access...' : 'Start / Resume Exam'}
              </button>
            </form>

            <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-1">
              <p className="font-semibold">Important</p>
              <p>1. Access code comes from admin Exam Access portal.</p>
              <p>2. If your previous system hangs, login again to continue.</p>
              <p>3. Logging in on a new system automatically signs out the old session.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CbtAccessPortal;
