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

const formatExamDate = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
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

  const availableCount = exams.filter((exam) => exam.can_access).length;

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
      <div
        className="pointer-events-none absolute -left-24 top-12 h-[300px] w-[300px] rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.17) 0%, rgba(37,99,235,0) 72%)' }}
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-8 h-[280px] w-[280px] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, rgba(16,185,129,0) 74%)' }}
      />

      <header className="relative border-b bg-white/95 backdrop-blur" style={{ borderColor: cbtTheme.border }}>
        <div className="flex h-[72px] w-full items-center justify-between px-5 md:px-10">
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
              style={{ background: 'linear-gradient(145deg, #2D6AF0 0%, #1D4ED8 100%)' }}
            >
              SC
            </div>
            <div>
              <p className="text-[19px] font-semibold tracking-[-0.01em]" style={{ color: cbtTheme.title }}>
                CBT System
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: cbtTheme.muted }}>
                Student Exam Portal
              </p>
            </div>
          </div>

          <div className="hidden rounded-full border px-4 py-1.5 text-xs font-semibold md:block" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
            {availableCount} Open
          </div>
        </div>
      </header>

      <main className="relative flex h-[calc(100vh-72px)] w-full flex-col px-5 py-5 md:px-10 md:py-6">
        <section className="rounded-2xl border bg-white px-5 py-5 shadow-sm md:px-6 md:py-6" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#1D4ED8' }}>
                Computer Based Test
              </p>
              <h1
                className="mt-1 text-[30px] font-bold leading-[1.08] tracking-[-0.02em] md:text-[42px]"
                style={{ color: cbtTheme.title }}
              >
                Select Your Exam
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 md:text-[15px]" style={{ color: cbtTheme.muted }}>
                Pick an exam and continue with your access code.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#D1FAE5', backgroundColor: '#ECFDF5', color: '#047857' }}>
                Secure Login
              </span>
              <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                Auto Save
              </span>
            </div>
          </div>
        </section>

        <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: cbtTheme.border }}>
          <div className="flex items-center justify-between border-b px-4 py-3 md:px-5" style={{ borderColor: cbtTheme.border }}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.09em]" style={{ color: cbtTheme.body }}>
              Available Exams
            </h2>
            <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>
              {exams.length} Listed
            </p>
          </div>

          {loadingExams ? (
            <div className="flex flex-1 items-center justify-center px-6 text-sm" style={{ color: cbtTheme.muted }}>
              Loading exams...
            </div>
          ) : error ? (
            <div
              className="m-4 rounded-xl border px-4 py-3 text-sm"
              style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: cbtTheme.danger }}
            >
              {error}
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-sm" style={{ color: cbtTheme.muted }}>
              No published exams are open right now.
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-4">
              <div className="space-y-3">
                {exams.map((exam) => {
                  const examTitle = `${exam.subject || exam.title} - ${exam.class_level || 'All Classes'}`;
                  const startAt = formatExamWindow(exam.start_datetime);
                  const endAt = formatExamWindow(exam.end_datetime);
                  const examDate = formatExamDate(exam.start_datetime);

                  return (
                    <article
                      key={exam.id}
                      className="rounded-xl border bg-slate-50/70 px-4 py-3 transition hover:border-blue-300 hover:bg-white hover:shadow-sm"
                      style={{ borderColor: '#DDE4F2' }}
                    >
                      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1.8fr)_120px_230px_140px]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
                              style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                            >
                              {exam.subject || 'General'}
                            </span>
                            <span
                              className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                              style={{
                                borderColor: exam.can_access ? '#BBF7D0' : '#FDE68A',
                                backgroundColor: exam.can_access ? '#ECFDF5' : '#FFFBEB',
                                color: exam.can_access ? '#047857' : '#B45309',
                              }}
                            >
                              {exam.can_access ? 'Open' : 'Restricted'}
                            </span>
                          </div>

                          <h3 className="mt-1 truncate text-base font-semibold tracking-[-0.01em] md:text-[18px]" style={{ color: cbtTheme.title }}>
                            {examTitle}
                          </h3>

                          {!exam.can_access && exam.reason && (
                            <p className="mt-1 truncate text-xs" style={{ color: '#B45309' }}>
                              {exam.reason}
                            </p>
                          )}
                        </div>

                        <div className="text-xs">
                          <p className="font-medium uppercase tracking-[0.08em]" style={{ color: cbtTheme.muted }}>Duration</p>
                          <p className="mt-0.5 text-sm font-semibold" style={{ color: cbtTheme.body }}>{exam.duration_minutes} mins</p>
                        </div>

                        <div className="text-xs">
                          <p className="font-medium uppercase tracking-[0.08em]" style={{ color: cbtTheme.muted }}>Window</p>
                          <p className="mt-0.5 text-sm font-semibold" style={{ color: cbtTheme.body }}>
                            {startAt && endAt ? `${startAt} - ${endAt}` : 'Today'}
                          </p>
                          <p className="text-[11px]" style={{ color: cbtTheme.muted }}>
                            {examDate || 'Scheduled'}
                          </p>
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => navigate(`/cbt/login/${exam.id}`)}
                            disabled={!exam.can_access}
                            className="h-10 min-w-[124px] rounded-lg px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
                          >
                            Continue
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default CbtAccessPortal;
