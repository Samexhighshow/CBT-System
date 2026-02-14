import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cbtApi } from '../services/cbtApi';
import { saveStoredSession } from '../services/sessionStore';
import { CbtOpenExam } from '../types';
import { cbtFontFamily, cbtTheme } from '../theme';

const getDeviceId = () => {
  const key = 'cbt-device-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const generated = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, generated);
  return generated;
};

const CbtExamLogin: React.FC = () => {
  const { examId: examIdParam } = useParams<{ examId: string }>();
  const examId = Number(examIdParam || 0);
  const navigate = useNavigate();

  const [exam, setExam] = useState<CbtOpenExam | null>(null);
  const [loadingExam, setLoadingExam] = useState(true);
  const [regNumber, setRegNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExam = async () => {
      if (!examId) {
        setLoadingExam(false);
        setError('Invalid exam link. Please return and select an exam.');
        return;
      }

      try {
        setLoadingExam(true);
        setError(null);
        const exams = await cbtApi.listExams();
        const selected = exams.find((item) => item.id === examId) || null;
        if (!selected) {
          setError('The selected exam is not currently available.');
        }
        setExam(selected);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load exam details.');
        setExam(null);
      } finally {
        setLoadingExam(false);
      }
    };

    loadExam();
  }, [examId]);

  const examTitle = useMemo(() => {
    if (!exam) return 'Exam Verification';
    return `${exam.subject || exam.title} - ${exam.class_level || 'All Classes'}`;
  }, [exam]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!exam) {
      setError('Select an exam first.');
      return;
    }

    if (!regNumber.trim() || !accessCode.trim()) {
      setError('Registration number and access code are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const verification = await cbtApi.verifyExamAccess(exam.id, {
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

      setVerified(true);
      window.setTimeout(() => {
        navigate(`/cbt/attempt/${verification.attempt_id}`);
      }, 900);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to verify access.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
      <header className="border-b" style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}>
        <div className="mx-auto flex h-[76px] w-full max-w-6xl items-center px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: cbtTheme.primary }}
            >
              SC
            </div>
            <p className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: cbtTheme.title }}>
              CBT System
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-6xl items-center justify-center px-4 py-10 md:px-6 md:py-12">
        <section
          className="w-full max-w-[560px] rounded-2xl border p-7 shadow-sm md:p-10"
          style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border }}
        >
          <h1
            className="text-[28px] font-bold leading-[1.12] tracking-[-0.02em] md:text-[34px]"
            style={{ color: cbtTheme.title }}
          >
            {examTitle}
          </h1>
          <p className="mt-3 text-[15px] leading-6 md:text-base" style={{ color: cbtTheme.muted }}>
            Verify your details to start or resume your exam.
          </p>

          {loadingExam ? (
            <p className="mt-8 text-[15px]" style={{ color: cbtTheme.muted }}>
              Loading exam...
            </p>
          ) : (
            <form className="mt-7 space-y-5" onSubmit={onSubmit}>
              <div>
                <label
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: cbtTheme.body }}
                >
                  Registration Number
                </label>
                <input
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. REG/2026/0001"
                  className="h-11 w-full rounded-xl border px-3.5 text-sm uppercase outline-none transition focus:ring-2"
                  style={{ borderColor: cbtTheme.border }}
                  required
                  disabled={verified}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: cbtTheme.body }}
                >
                  Access Code
                </label>
                <input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="Enter exam access code"
                  className="h-11 w-full rounded-xl border px-3.5 text-sm uppercase outline-none transition focus:ring-2"
                  style={{ borderColor: cbtTheme.border }}
                  required
                  disabled={verified}
                />
              </div>

              {error && (
                <div
                  className="rounded-xl border px-3.5 py-2.5 text-sm"
                  style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: cbtTheme.danger }}
                >
                  {error}
                </div>
              )}

              {verified && (
                <div
                  className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm"
                  style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' }}
                >
                  <span className="inline-flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                    OK
                  </span>
                  Verification successful. Opening exam...
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || verified || !exam}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: cbtTheme.primary }}
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => navigate('/cbt')}
            className="mt-5 text-sm font-medium underline-offset-2 hover:underline"
            style={{ color: cbtTheme.primary }}
          >
            Back to exam selection
          </button>
        </section>
      </main>
    </div>
  );
};

export default CbtExamLogin;

