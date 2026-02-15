import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cbtApi } from '../services/cbtApi';
import { CbtOpenExam } from '../types';
import { cbtFontFamily, cbtTheme } from '../theme';
import FooterMinimal from '../../components/FooterMinimal';

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
  return date.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
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
    <div className="flex min-h-screen flex-col overflow-x-hidden" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
      <header className="border-b bg-white" style={{ borderColor: '#E2E8F0' }}>
        <div className="mx-auto flex h-[74px] w-full max-w-[1200px] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-[0_10px_18px_-14px_rgba(37,99,235,0.8)]"
              style={{ background: 'linear-gradient(145deg, #2D6AF0 0%, #1D4ED8 100%)' }}
            >
              SC
            </div>
            <div>
              <p className="text-[19px] font-semibold tracking-[-0.01em]" style={{ color: cbtTheme.title }}>
                CBT System
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: cbtTheme.muted }}>
                Student Exam Portal
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold md:flex" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#2563EB' }} />
            {availableCount} Open
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-5 py-4 md:py-5">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-1 pb-3" style={{ borderColor: '#D7DEE9' }}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.09em]" style={{ color: cbtTheme.body }}>
              Available Exams
            </h2>
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>{exams.length} Listed</p>
              <p className="text-[11px]" style={{ color: cbtTheme.muted }}>Ready for selection</p>
            </div>
          </div>

          {loadingExams ? (
            <div className="flex min-h-[170px] items-center justify-center px-4 text-sm" style={{ color: cbtTheme.muted }}>
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
            <div className="flex min-h-[170px] items-center justify-center px-4 text-sm" style={{ color: cbtTheme.muted }}>
              No published exams are open right now.
            </div>
          ) : (
            <div className="pt-3">
              <div className="space-y-2.5">
                {exams.map((exam) => {
                  const examTitle = `${exam.subject || exam.title} - ${exam.class_level || 'All Classes'}`;
                  const startAt = formatExamWindow(exam.start_datetime);
                  const endAt = formatExamWindow(exam.end_datetime);
                  const examDate = formatExamDate(exam.start_datetime);

                  return (
                    <article
                      key={exam.id}
                      className="rounded-2xl border bg-white px-4 py-2.5 sm:px-5"
                      style={{ borderColor: '#D9E1EE' }}
                    >
                      <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1.8fr)_110px_210px_130px]">
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
                            <span className="text-[11px] font-medium" style={{ color: cbtTheme.muted }}>
                              ID #{exam.id}
                            </span>
                          </div>

                          <h3 className="mt-0.5 truncate text-[15px] font-semibold tracking-[-0.01em] sm:text-[16px]" style={{ color: cbtTheme.title }}>
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
                            className="h-9 min-w-[118px] rounded-xl px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
                          >
                            {exam.can_access ? 'Continue' : 'Locked'}
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

      <FooterMinimal />
    </div>
  );
};

export default CbtAccessPortal;
