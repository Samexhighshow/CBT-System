import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cbtApi } from '../services/cbtApi';
import { CbtOpenExam } from '../types';
import { cbtFontFamily, cbtTheme } from '../theme';

const formatExamWindow = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const CbtAccessPortal: React.FC = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<CbtOpenExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExams = async () => {
      try {
        setLoadingExams(true);
        setError(null);
        const data = await cbtApi.listExams();
        setExams(data);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load available exams.');
        setExams([]);
      } finally {
        setLoadingExams(false);
      }
    };

    loadExams();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
      <div
        className="pointer-events-none absolute -left-32 -top-36 h-[420px] w-[420px] rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, rgba(37,99,235,0) 72%)' }}
      />
      <div
        className="pointer-events-none absolute -right-24 top-24 h-[340px] w-[340px] rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 74%)' }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[300px] w-[500px] -translate-x-1/2 opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0) 74%)' }}
      />

      <header className="relative border-b" style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderColor: cbtTheme.border }}>
        <div className="mx-auto flex h-[78px] w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
              style={{ background: 'linear-gradient(145deg, #2D6AF0 0%, #1D4ED8 100%)' }}
            >
              SC
            </div>
            <div>
              <p className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: cbtTheme.title }}>
                CBT System
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: cbtTheme.muted }}>
                Student Exam Portal
              </p>
            </div>
          </div>

          <div className="hidden rounded-full border px-4 py-1.5 text-xs font-semibold md:block" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
            {exams.length} Exam{exams.length === 1 ? '' : 's'} Available
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-10 md:px-6 md:pb-16 md:pt-14">
        <section
          className="rounded-[28px] border p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.28)] md:p-10"
          style={{ backgroundColor: 'rgba(255,255,255,0.78)', borderColor: '#E2E8F0' }}
        >
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#1D4ED8' }}>
              Computer Based Test
            </p>
            <h1
              className="mt-2 text-[34px] font-bold leading-[1.06] tracking-[-0.03em] md:text-[52px]"
              style={{ color: cbtTheme.title }}
            >
              Select Your Exam
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 md:text-base" style={{ color: cbtTheme.muted }}>
              Choose from published exams below and continue with your unique access code.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 md:mt-8">
            <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#D1FAE5', backgroundColor: '#ECFDF5', color: '#047857' }}>
              Secure Login
            </span>
            <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
              Auto Save Enabled
            </span>
            <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#B45309' }}>
              Session Protection Active
            </span>
          </div>
        </section>

        <section className="mx-auto mt-8 max-w-6xl md:mt-10">
          {loadingExams ? (
            <div
              className="rounded-3xl border px-6 py-12 text-center text-[15px]"
              style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border, color: cbtTheme.muted }}
            >
              Loading exams...
            </div>
          ) : error ? (
            <div
              className="rounded-3xl border px-6 py-4 text-sm"
              style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: cbtTheme.danger }}
            >
              {error}
            </div>
          ) : exams.length === 0 ? (
            <div
              className="rounded-3xl border px-6 py-12 text-center text-[15px]"
              style={{ backgroundColor: cbtTheme.cardBg, borderColor: cbtTheme.border, color: cbtTheme.muted }}
            >
              No published exams are open right now.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {exams.map((exam, idx) => {
                const examTitle = `${exam.subject || exam.title} - ${exam.class_level || 'All Classes'}`;
                const startAt = formatExamWindow(exam.start_datetime);
                const endAt = formatExamWindow(exam.end_datetime);
                const delay = idx * 45;
                return (
                  <article
                    key={exam.id}
                    className="group relative overflow-hidden rounded-3xl border p-6 shadow-[0_10px_28px_-18px_rgba(30,64,175,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_36px_-18px_rgba(30,64,175,0.36)]"
                    style={{
                      backgroundColor: cbtTheme.cardBg,
                      borderColor: '#DDE4F2',
                      animation: 'none',
                      transitionDelay: `${delay}ms`,
                    }}
                  >
                    <div
                      className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-50 blur-2xl"
                      style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 75%)' }}
                    />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                          style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                        >
                          {exam.subject || 'General'}
                        </span>
                        <span
                          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            borderColor: exam.can_access ? '#BBF7D0' : '#FDE68A',
                            backgroundColor: exam.can_access ? '#ECFDF5' : '#FFFBEB',
                            color: exam.can_access ? '#047857' : '#B45309',
                          }}
                        >
                          {exam.can_access ? 'Open' : 'Restricted'}
                        </span>
                      </div>

                      <h2 className="mt-4 text-[22px] font-semibold leading-[1.18] tracking-[-0.015em]" style={{ color: cbtTheme.title }}>
                        {examTitle}
                      </h2>

                      <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                        <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFBFD', color: cbtTheme.body }}>
                          <p className="font-medium" style={{ color: cbtTheme.muted }}>Duration</p>
                          <p className="mt-0.5 font-semibold">{exam.duration_minutes} mins</p>
                        </div>
                        <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFBFD', color: cbtTheme.body }}>
                          <p className="font-medium" style={{ color: cbtTheme.muted }}>Window</p>
                          <p className="mt-0.5 font-semibold">
                            {startAt && endAt ? `${startAt} - ${endAt}` : 'Today'}
                          </p>
                        </div>
                      </div>

                      {!exam.can_access && exam.reason && (
                        <p className="mt-3 text-xs leading-5" style={{ color: '#B45309' }}>
                          {exam.reason}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate(`/cbt/login/${exam.id}`)}
                        disabled={!exam.can_access}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition group-hover:gap-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
                      >
                        Continue
                        <span className="text-xs">Next</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default CbtAccessPortal;
