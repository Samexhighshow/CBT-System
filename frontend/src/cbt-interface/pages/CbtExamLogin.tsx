import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cbtApi } from '../services/cbtApi';
import { saveStoredSession } from '../services/sessionStore';
import { CbtOpenExam } from '../types';
import { cbtFontFamily, cbtTheme } from '../theme';
import FooterMinimal from '../../components/FooterMinimal';
import useConnectivity from '../../hooks/useConnectivity';
import offlineDB, { ensureDeviceId } from '../../services/offlineDB';
import syncService from '../../services/syncService';
import { defaultAssessmentDisplayConfig, fetchAssessmentDisplayConfig } from '../../services/assessmentDisplay';

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
  const [selectedSittingId, setSelectedSittingId] = useState<number>(0);
  const [assessmentLabels, setAssessmentLabels] = useState(defaultAssessmentDisplayConfig.labels);
  const connectivity = useConnectivity();

  useEffect(() => {
    const loadLabels = async () => {
      const config = await fetchAssessmentDisplayConfig();
      setAssessmentLabels(config.labels);
    };

    loadLabels();
  }, [connectivity.status]);

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

        if (connectivity.status === 'OFFLINE') {
          const localExam = await offlineDB.exams.get(examId);
          if (!localExam) {
            setError('Offline exam list is empty. Reconnect and sync exams first.');
            setExam(null);
            return;
          }

          const localExamView: CbtOpenExam = {
            id: localExam.examId,
            title: localExam.title,
            subject: localExam.title,
            class_level: 'Class',
            duration_minutes: Number(localExam.durationMinutes || 60),
            status: localExam.status || 'scheduled',
            start_datetime: localExam.startsAt || null,
            end_datetime: localExam.endsAt || null,
            can_access: true,
            reason: null,
          };

          setExam(localExamView);
          return;
        }

        const exams = await cbtApi.listExams();
        const selected = exams.find((item) => item.id === examId) || null;
        if (!selected) {
          setError('The selected exam is not currently available.');
        }
        setExam(selected);
        const firstSitting = (selected?.sittings || [])[0];
        setSelectedSittingId(firstSitting?.id ? Number(firstSitting.id) : 0);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load exam details.');
        setExam(null);
      } finally {
        setLoadingExam(false);
      }
    };

    loadExam();
  }, [connectivity.status, examId]);

  const examTitle = useMemo(() => {
    if (!exam) return 'Exam Verification';
    return `${exam.subject || exam.title} - ${exam.class_level || 'All Classes'}`;
  }, [exam]);

  const assessmentLoginNoun = useMemo(() => {
    return assessmentLabels.assessmentNoun;
  }, [assessmentLabels.assessmentNoun]);

  const examWindowText = useMemo(() => {
    if (!exam) return 'Window not set';
    const selectedSitting = (exam.sittings || []).find((row) => row.id === selectedSittingId);
    const startSource = selectedSitting?.start_at || exam.start_datetime;
    const endSource = selectedSitting?.end_at || exam.end_datetime;
    const start = formatExamWindow(startSource);
    const end = formatExamWindow(endSource);
    const examDate = formatExamDate(startSource);
    if (start && end && examDate) return `${start} - ${end} · ${examDate}`;
    if (start && end) return `${start} - ${end}`;
    return examDate || 'Today';
  }, [exam, selectedSittingId]);

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

      if (connectivity.status === 'OFFLINE') {
        const normalizedReg = regNumber.trim().toUpperCase();
        const normalizedCode = accessCode.trim().toUpperCase();
        const cachedPackage = await offlineDB.examPackages.get(exam.id);
        if (!cachedPackage) {
          setError('Exam package is not cached on this device. Reconnect and download it first.');
          return;
        }

        const student = await offlineDB.students
          .where('matricOrCandidateNo')
          .equals(normalizedReg)
          .first();

        if (!student) {
          setError('Student not found in offline cache.');
          return;
        }

        const code = await offlineDB.accessCodes
          .where('[examId+studentId+code]')
          .equals([exam.id, student.studentId, normalizedCode])
          .and((row) => row.status === 'NEW')
          .first();

        if (!code) {
          setError('Invalid or already-used access code for this exam.');
          return;
        }

        const attemptId = crypto.randomUUID();
        const now = new Date().toISOString();
        const deviceId = await ensureDeviceId();

        await offlineDB.transaction('rw', offlineDB.accessCodes, offlineDB.attempts, async () => {
          await offlineDB.accessCodes.update(code.codeId, {
            status: 'USED',
            usedAt: now,
            attemptId,
            usedByDeviceId: deviceId,
            updatedAt: now,
          });

          await offlineDB.attempts.put({
            attemptId,
            examId: exam.id,
            studentId: student.studentId,
            status: 'IN_PROGRESS',
            startedAt: now,
            lastSavedAt: now,
          });
        });

        await syncService.enqueue(code.codeId, 'CODE_USED');
        localStorage.setItem('offline_cbt_student_reg', student.matricOrCandidateNo);
        localStorage.setItem('offline_cbt_student_name', student.fullName);

        setVerified(true);
        window.setTimeout(() => {
          navigate(`/offline-exam/${exam.id}?attemptId=${encodeURIComponent(attemptId)}&studentId=${student.studentId}`);
        }, 700);
        return;
      }

      const deviceId = await ensureDeviceId();
      const verification = await cbtApi.verifyExamAccess(exam.id, {
        reg_number: regNumber.trim().toUpperCase(),
        access_code: accessCode.trim().toUpperCase(),
        device_id: deviceId,
        sitting_id: selectedSittingId > 0 ? selectedSittingId : undefined,
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
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: cbtTheme.pageBg, fontFamily: cbtFontFamily }}>
      <header className="border-b bg-white" style={{ borderColor: '#E2E8F0' }}>
        <div className="mx-auto flex h-[74px] w-full max-w-[1200px] items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: cbtTheme.primary }}
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
          <p className="hidden text-xs font-semibold uppercase tracking-[0.09em] md:block" style={{ color: '#1D4ED8' }}>
            {assessmentLabels.assessmentNoun} Verification | {connectivity.status}
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 items-center px-5 py-8 md:py-10">
        <section className="grid w-full gap-0 border bg-white md:grid-cols-[1.05fr_0.95fr]" style={{ borderColor: '#D9E1EE' }}>
          <div className="border-b px-6 py-7 md:border-b-0 md:border-r md:px-8 md:py-9" style={{ borderColor: '#E2E8F0' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#1D4ED8' }}>
              Access Control
            </p>
            <h1 className="mt-2 text-[34px] font-bold leading-[1.04] tracking-[-0.02em] md:text-[44px]" style={{ color: cbtTheme.title }}>
              {assessmentLoginNoun} Login
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 md:text-[15px]" style={{ color: cbtTheme.muted }}>
              Confirm candidate details to start or resume the exam on this device.
            </p>

            <div className="mt-7 space-y-3 text-xs">
              <div className="border-l-2 pl-3" style={{ borderColor: '#BFDBFE' }}>
                <p className="font-semibold uppercase tracking-[0.08em]" style={{ color: '#1E3A8A' }}>Selected Exam</p>
                <p className="mt-1 text-sm font-semibold leading-6" style={{ color: cbtTheme.body }}>
                  {examTitle}
                </p>
              </div>
              <div className="border-l-2 pl-3" style={{ borderColor: '#D1FAE5' }}>
                <p className="font-semibold uppercase tracking-[0.08em]" style={{ color: '#047857' }}>Schedule</p>
                <p className="mt-1 text-sm font-semibold leading-6" style={{ color: cbtTheme.body }}>
                  {examWindowText}
                </p>
              </div>
              <div className="border-l-2 pl-3" style={{ borderColor: '#FDE68A' }}>
                <p className="font-semibold uppercase tracking-[0.08em]" style={{ color: '#B45309' }}>Security</p>
                <p className="mt-1 text-sm leading-6" style={{ color: cbtTheme.body }}>
                  Session replacement enabled and autosave active.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-7 md:px-8 md:py-9">
            {loadingExam ? (
              <p className="text-[15px]" style={{ color: cbtTheme.muted }}>
                Loading exam...
              </p>
            ) : (
              <form className="space-y-5" onSubmit={onSubmit}>
                <div>
                  <label
                    className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: cbtTheme.body }}
                  >
                    Registration Number
                  </label>
                  <input
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                    placeholder="E.G. REG/2026/0001"
                    className="h-12 w-full border-b-2 border-x-0 border-t-0 bg-transparent px-0 text-sm uppercase outline-none transition focus:border-blue-600"
                    style={{ borderBottomColor: '#CBD5E1' }}
                    required
                    disabled={verified}
                  />
                </div>

                {!!exam?.sittings?.length && (
                  <div>
                    <label
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em]"
                      style={{ color: cbtTheme.body }}
                    >
                      Assessment Sitting
                    </label>
                    <select
                      value={selectedSittingId || ''}
                      onChange={(e) => setSelectedSittingId(Number(e.target.value || 0))}
                      className="h-12 w-full border-b-2 border-x-0 border-t-0 bg-transparent px-0 text-sm outline-none transition focus:border-blue-600"
                      style={{ borderBottomColor: '#CBD5E1' }}
                      disabled={verified}
                    >
                      {(exam.sittings || []).map((sitting) => (
                        <option key={sitting.id} value={sitting.id}>
                          {`#${sitting.id} ${sitting.assessment_mode_snapshot === 'ca_test' ? 'CA Test' : 'Exam'} (${sitting.status})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: cbtTheme.body }}
                  >
                    {assessmentLabels.accessCodeLabel}
                  </label>
                  <input
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder={`ENTER ${assessmentLabels.accessCodeLabel.toUpperCase()}`}
                    className="h-12 w-full border-b-2 border-x-0 border-t-0 bg-transparent px-0 text-sm uppercase outline-none transition focus:border-blue-600"
                    style={{ borderBottomColor: '#CBD5E1' }}
                    required
                    disabled={verified}
                  />
                </div>

                {error && (
                  <div
                    className="border-l-2 px-3 py-2.5 text-sm"
                    style={{ backgroundColor: '#FEF2F2', borderLeftColor: '#DC2626', color: cbtTheme.danger }}
                  >
                    {error}
                  </div>
                )}

                {verified && (
                  <div
                    className="border-l-2 px-3 py-2.5 text-sm"
                    style={{ backgroundColor: '#ECFDF5', borderLeftColor: '#059669', color: '#065F46' }}
                  >
                    Verification successful. Opening exam...
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || verified || !exam}
                  className="flex h-11 w-full items-center justify-center gap-2 border text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: cbtTheme.primary, borderColor: cbtTheme.primary }}
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin border-2 border-white border-t-transparent" />
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
              className="mt-6 text-sm font-semibold uppercase tracking-[0.08em]"
              style={{ color: cbtTheme.primary }}
            >
              Back to {assessmentLabels.assessmentNoun.toLowerCase()} selection
            </button>
          </div>
        </section>
      </main>

      <FooterMinimal />
    </div>
  );
};

export default CbtExamLogin;

