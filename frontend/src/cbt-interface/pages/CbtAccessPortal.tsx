import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CbtOpenExam } from '../types';
import { cbtFontFamily, cbtTheme } from '../theme';
import FooterMinimal from '../../components/FooterMinimal';
import offlineDB, { ExamPackage } from '../../services/offlineDB';
import useConnectivity from '../../hooks/useConnectivity';
import { getReachableBaseUrl } from '../../services/reachability';
import syncService from '../../services/syncService';
import { defaultAssessmentDisplayConfig, fetchAssessmentDisplayConfig } from '../../services/assessmentDisplay';
import { serialNumber } from '../../utils/serialNumber';

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

const parseDateValue = (value?: string | null): Date | null => {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const normalizedDate = new Date(normalized);
  if (!Number.isNaN(normalizedDate.getTime())) return normalizedDate;

  const dmyTime = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*|\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dmyTime) {
    const [, dd, mm, yyyy, hh, min, ss] = dmyTime;
    const parsed = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(ss || 0)
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dmyDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyDate) {
    const [, dd, mm, yyyy] = dmyDate;
    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

const isExamOpenByWindow = (status: string | null | undefined, start?: string | null, end?: string | null): boolean => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (['completed', 'cancelled', 'archived', 'draft', 'closed', 'ended', 'voided'].includes(normalizedStatus)) {
    return false;
  }

  const now = new Date();
  const startAt = parseDateValue(start);
  const endAt = parseDateValue(end);

  if (startAt && now < startAt) return false;
  if (endAt && now > endAt) return false;
  return true;
};

const toOpenExamFromOfflineRow = (row: any): CbtOpenExam => {
  const canAccess = isExamOpenByWindow(row?.status, row?.startsAt ?? null, row?.endsAt ?? null);
  return {
    id: row.examId,
    title: row.title,
    subject: row.title,
    class_level: 'Class',
    duration_minutes: Number(row.durationMinutes || 60),
    status: row.status || 'scheduled',
    start_datetime: row.startsAt || null,
    end_datetime: row.endsAt || null,
    can_access: canAccess,
    reason: canAccess ? null : 'This assessment is closed.',
  };
};

const CbtAccessPortal: React.FC = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<CbtOpenExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowClosedNotice, setWindowClosedNotice] = useState<string | null>(null);
  const [cachedPackages, setCachedPackages] = useState<Record<number, ExamPackage>>({});
  const [downloadBusy, setDownloadBusy] = useState<number | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [assessmentLabels, setAssessmentLabels] = useState(defaultAssessmentDisplayConfig.labels);
  const hasLoadedExamsRef = useRef(false);
  const lastKnownExamsRef = useRef<CbtOpenExam[]>([]);
  const connectivity = useConnectivity();

  const refreshCachedPackages = async () => {
    // Cleanup old packages (after exam ends + 1 day) to keep storage healthy.
    const existingPackages = await offlineDB.examPackages.toArray();
    const existingOfflineExams = await offlineDB.exams.toArray();
    const now = Date.now();
    for (const pkg of existingPackages) {
      const endsAt = pkg.data?.exam?.end_datetime ? new Date(pkg.data.exam.end_datetime).getTime() : null;
      if (endsAt && !Number.isNaN(endsAt)) {
        const ttl = endsAt + (24 * 60 * 60 * 1000);
        if (now > ttl) {
          await offlineDB.examPackages.delete(pkg.examId);
        }
      }
    }

    // Remove clearly stale local exam rows to avoid showing finished assessments in offline fallback.
    for (const row of existingOfflineExams) {
      const endTs = parseDateValue(row.endsAt || null)?.getTime();
      const status = String(row.status || '').trim().toLowerCase();
      const isClosedStatus = ['completed', 'cancelled', 'archived', 'closed', 'ended', 'voided'].includes(status);
      const isExpiredByTime = typeof endTs === 'number' && !Number.isNaN(endTs) && now > endTs + (24 * 60 * 60 * 1000);
      if (isClosedStatus || isExpiredByTime) {
        await offlineDB.exams.delete(row.examId);
      }
    }

    const packages = await offlineDB.examPackages.toArray();
    const map: Record<number, ExamPackage> = {};
    packages.forEach((pkg) => {
      map[pkg.examId] = pkg;
    });
    setCachedPackages(map);
  };

  useEffect(() => {
    const loadPending = async () => {
      const count = await syncService.pendingCount();
      setPendingSync(count);
    };
    loadPending();
    const timer = window.setInterval(loadPending, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadLabels = async () => {
      const config = await fetchAssessmentDisplayConfig();
      setAssessmentLabels(config.labels);
    };

    loadLabels();
  }, [connectivity.status]);

  useEffect(() => {
    if (connectivity.status === 'CHECKING') {
      setLoadingExams(true);
      return;
    }

    const loadExams = async () => {
      try {
        if (!hasLoadedExamsRef.current) {
          setLoadingExams(true);
        }
        setError(null);
        await refreshCachedPackages();

        const baseUrl = getReachableBaseUrl({
          status: connectivity.status === 'CHECKING' ? 'OFFLINE' : connectivity.status,
          canReachCloud: connectivity.canReachCloud,
          canReachLocal: connectivity.canReachLocal,
        });
        if (!baseUrl) {
          setWindowClosedNotice(null);
          const localRows = await offlineDB.exams.toArray();
          const mapped = localRows
            .map((row) => toOpenExamFromOfflineRow(row))
            .filter((row) => row.can_access);
          if (mapped.length > 0) {
            setExams(mapped);
            lastKnownExamsRef.current = mapped;
          } else {
            setExams([]);
          }
          return;
        }

        await syncService.syncDown();
        const response = await fetch(`${baseUrl}/cbt/exams`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load available exams.');
        }

        const payload = await response.json();
        const data = payload?.data || payload || [];
        const nextExams = Array.isArray(data) ? data : [];
        const restrictedByWindow = nextExams.filter((row) => row?.can_access === false && /between\s+\d{2}:\d{2}\s+and\s+\d{2}:\d{2}/i.test(String(row?.reason || '')));
        const allBlockedByWindow = nextExams.length > 0 && restrictedByWindow.length === nextExams.length;

        if (allBlockedByWindow) {
          setWindowClosedNotice(String(restrictedByWindow[0]?.reason || 'Exam window is currently closed.'));
          setExams([]);
          return;
        }

        setWindowClosedNotice(null);
        const openExams = nextExams.filter((row) => row?.can_access === true);
        setExams(openExams);
        if (openExams.length > 0) {
          lastKnownExamsRef.current = openExams;
        }
      } catch (err: any) {
        setWindowClosedNotice(null);
        setError(err?.message || 'Failed to load available exams.');
        const localRows = await offlineDB.exams.toArray();
        const mapped = localRows
          .map((row) => toOpenExamFromOfflineRow(row))
          .filter((row) => row.can_access);
        if (mapped.length > 0) {
          setExams(mapped);
          lastKnownExamsRef.current = mapped;
        } else {
          setExams([]);
        }
      } finally {
        setLoadingExams(false);
        hasLoadedExamsRef.current = true;
      }
    };

    loadExams();
  }, [connectivity.canReachCloud, connectivity.canReachLocal, connectivity.status]);

  const handleDownload = async (examId: number) => {
    try {
      const baseUrl = getReachableBaseUrl(connectivity);
      if (!baseUrl) {
        setError('Offline: connect to download exam packages.');
        return;
      }

      setDownloadBusy(examId);

      // Storage guard: prevent large downloads from silently failing.
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        if (typeof estimate.quota === 'number' && typeof estimate.usage === 'number') {
          const remaining = estimate.quota - estimate.usage;
          if (remaining < 5 * 1024 * 1024) {
            throw new Error('Not enough local storage to cache this exam package.');
          }
        }
      }

      const response = await fetch(`${baseUrl}/exams/${examId}/package`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to download exam package.');
      }

      const payload = await response.json();
      const pkg: ExamPackage = {
        examId,
        downloadedAt: new Date().toISOString(),
        packageVersion: String(payload?.packageVersion || payload?.version || '1'),
        packageId: payload?.packageId || payload?.package_id,
        packageSignature: payload?.packageSignature || payload?.package_signature,
        expiresAt: payload?.exam?.end_datetime || null,
        data: payload?.data || payload,
      };

      await offlineDB.examPackages.put(pkg);
      await refreshCachedPackages();
    } catch (err: any) {
      setError(err?.message || 'Failed to download exam package.');
    } finally {
      setDownloadBusy(null);
    }
  };

  const availableCount = exams.filter((exam) => exam.can_access).length;

  if (windowClosedNotice) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: 'linear-gradient(180deg, #FFF1F2 0%, #FFE4E6 100%)', fontFamily: cbtFontFamily }}>
        <section className="mx-auto w-full max-w-[980px] rounded-3xl border px-6 py-10 text-center shadow-[0_32px_90px_-50px_rgba(185,28,28,0.55)] md:px-10 md:py-12" style={{ borderColor: '#FCA5A5', background: 'linear-gradient(180deg, #FFF1F2 0%, #FFFFFF 100%)' }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border" style={{ borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
            <i className="bx bx-time-five text-[30px]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em]" style={{ color: '#B91C1C' }}>
            CBT Access Alert
          </p>
          <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.02em]" style={{ color: '#7F1D1D' }}>
            Exam Window Not Opened
          </h1>
          <p className="mx-auto mt-4 max-w-[680px] text-[18px] leading-8" style={{ color: '#991B1B' }}>
            {windowClosedNotice}
          </p>
          <div className="mx-auto mt-7 max-w-[760px] rounded-2xl border px-5 py-4 text-base" style={{ borderColor: '#FCA5A5', backgroundColor: '#FFF1F2', color: '#9F1239' }}>
            This portal is temporarily locked for all candidates. Please alert an Admin or Moderator to reopen the exam window in Settings.
          </div>
        </section>
      </div>
    );
  }

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
                {assessmentLabels.studentPortalSubtitle}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold md:flex" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#2563EB' }} />
            {availableCount} Open
          </div>
          {pendingSync > 0 && (
            <div className="hidden items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold md:flex" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#92400E' }}>
              {pendingSync} Pending Sync
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pb-2 pt-3 md:pb-3 md:pt-4">
        <section className="mb-3 overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#DCE4F2' }}>
          <div
            className="px-4 py-3 md:px-5 md:py-3.5"
            style={{
              background:
                'radial-gradient(circle at 12% 10%, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0) 40%), radial-gradient(circle at 85% 12%, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0) 36%), linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#1D4ED8' }}>
                  Computer Based Test
                </p>
                <h1 className="mt-0.5 text-[20px] font-semibold tracking-[-0.015em] md:text-[24px]" style={{ color: cbtTheme.title }}>
                  Select Your {assessmentLabels.assessmentNoun}
                </h1>
                <p className="mt-1 text-xs md:text-sm" style={{ color: cbtTheme.muted }}>
                  Choose from published {assessmentLabels.assessmentNounPlural.toLowerCase()} and continue with your access code.
                </p>
              </div>
              <div className="hidden flex-wrap items-center gap-1.5 text-[11px] font-semibold sm:flex">
                <span className="rounded-full border px-2.5 py-0.5" style={{ borderColor: '#BBF7D0', backgroundColor: '#ECFDF5', color: '#047857' }}>
                  Secure Login
                </span>
                <span className="rounded-full border px-2.5 py-0.5" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                  Auto Save
                </span>
                <span className="rounded-full border px-2.5 py-0.5" style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#92400E' }}>
                  Offline Ready
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="rounded-t-2xl border border-b-0 bg-white px-4 py-3 sm:px-5" style={{ borderColor: '#D7DEE9' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: '#D7DEE9' }}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.09em]" style={{ color: cbtTheme.body }}>
              Available {assessmentLabels.assessmentNounPlural}
            </h2>
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>{exams.length} Listed</p>
              <p className="text-[11px]" style={{ color: cbtTheme.muted }}>Ready for selection</p>
            </div>
            </div>
          </div>

          {loadingExams ? (
            <div className="flex min-h-[190px] flex-1 items-center justify-center rounded-b-2xl border border-t-0 bg-white px-4 text-sm" style={{ borderColor: '#D7DEE9', color: cbtTheme.muted }}>
              Loading exams...
            </div>
          ) : error ? (
            <div
              className="flex flex-1 items-center rounded-b-2xl border border-t-0 px-4 py-3 text-sm"
              style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: cbtTheme.danger }}
            >
              {error}
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-1 items-center rounded-b-2xl border border-t-0 bg-white px-4 py-8" style={{ borderColor: '#D7DEE9' }}>
              <div className="mx-auto flex max-w-[640px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center" style={{ borderColor: '#CBD7EA', backgroundColor: '#F8FBFF' }}>
                <div className="mb-3 rounded-2xl border p-3" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                  <i className="bx bx-calendar-x text-2xl" />
                </div>
                <p className="text-base font-semibold" style={{ color: cbtTheme.title }}>
                  No Open {assessmentLabels.assessmentNounPlural}
                </p>
                <p className="mt-1.5 text-sm" style={{ color: cbtTheme.muted }}>
                  No published {assessmentLabels.assessmentNounPlural.toLowerCase()} are open right now.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 rounded-b-2xl border border-t-0 bg-white px-3 pb-3 pt-2 sm:px-4" style={{ borderColor: '#D7DEE9' }}>
              <div className="space-y-1.5">
                {exams.map((exam, index) => {
                  const examTitle = `${exam.subject || exam.title} - ${exam.class_level || 'All Classes'}`;
                  const primarySitting = (exam.sittings || [])[0];
                  const displayStart = primarySitting?.start_at || exam.start_datetime;
                  const displayEnd = primarySitting?.end_at || exam.end_datetime;
                  const displayDuration = primarySitting?.duration_minutes || exam.duration_minutes;
                  const startAt = formatExamWindow(displayStart);
                  const endAt = formatExamWindow(displayEnd);
                  const examDate = formatExamDate(displayStart);
                  const cached = cachedPackages[exam.id];

                  return (
                    <article
                      key={exam.id}
                      className="rounded-xl border bg-white px-3 py-2 transition hover:-translate-y-[1px] hover:shadow-[0_12px_24px_-18px_rgba(29,78,216,0.45)] sm:px-4"
                      style={{ borderColor: '#D9E1EE' }}
                    >
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1">
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
                              No. {serialNumber(index)}
                            </span>
                            {primarySitting?.id ? (
                              <span className="text-[11px] font-medium" style={{ color: cbtTheme.muted }}>
                                Sitting {primarySitting.id}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-0.5 truncate text-[14px] font-semibold tracking-[-0.01em] sm:text-[15px]" style={{ color: cbtTheme.title }}>
                            {examTitle}
                          </h3>

                          {!exam.can_access && exam.reason && (
                            <p className="mt-1 truncate text-xs" style={{ color: '#B45309' }}>
                              {exam.reason}
                            </p>
                          )}
                        </div>

                        <div className="text-xs leading-tight">
                          <p className="font-medium uppercase tracking-[0.08em]" style={{ color: cbtTheme.muted }}>Duration</p>
                          <p className="mt-0.5 text-[13px] font-semibold" style={{ color: cbtTheme.body }}>{displayDuration} mins</p>
                        </div>

                        <div className="text-xs leading-tight">
                          <p className="font-medium uppercase tracking-[0.08em]" style={{ color: cbtTheme.muted }}>Window</p>
                          <p className="mt-0.5 text-[13px] font-semibold" style={{ color: cbtTheme.body }}>
                            {startAt && endAt ? `${startAt} - ${endAt}` : 'Today'}
                          </p>
                          <p className="text-[11px]" style={{ color: cbtTheme.muted }}>
                            {examDate || 'Scheduled'}
                          </p>
                        </div>

                        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/cbt/login/${exam.id}`)}
                            disabled={!exam.can_access}
                            className="h-8 min-w-[102px] rounded-lg px-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
                          >
                            {exam.can_access ? 'Continue' : 'Locked'}
                          </button>

                        <button
                          type="button"
                          onClick={() => handleDownload(exam.id)}
                          disabled={connectivity.status === 'OFFLINE' || downloadBusy === exam.id}
                          className="h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ borderColor: '#D9E1EE', backgroundColor: '#F8FAFC', color: '#1F2937' }}
                        >
                          {downloadBusy === exam.id ? 'Downloading...' : cached ? 'Update Offline Package' : 'Download for Offline'}
                        </button>
                        {cached && (
                          <span className="hidden text-[10px] sm:inline" style={{ color: cbtTheme.muted }}>
                            Cached {new Date(cached.downloadedAt).toLocaleString()}
                          </span>
                        )}
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
