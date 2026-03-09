import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
import QuestionRandomization from './QuestionRandomization';

type SittingMode = 'ca_test' | 'exam';
type SittingStatus = 'draft' | 'scheduled' | 'active' | 'closed';
type QuestionSelectionMode = 'fixed' | 'random';
type TermValue = 'First Term' | 'Second Term' | 'Third Term';

interface ExamRow {
  id: number;
  title: string;
  duration_minutes?: number;
  start_datetime?: string;
  end_datetime?: string;
  start_time?: string;
  end_time?: string;
  academic_session?: string;
  term?: TermValue | null;
  subject?: { id: number; name: string } | null;
  school_class?: { id: number; name: string } | null;
  metadata?: { question_count?: number } | null;
}

interface SittingRow {
  id: number;
  exam_id: number;
  session?: string | null;
  term?: TermValue | null;
  assessment_mode_snapshot: SittingMode;
  question_count?: number | null;
  question_selection_mode?: QuestionSelectionMode | null;
  shuffle_question_order?: boolean | null;
  shuffle_option_order?: boolean | null;
  question_distribution?: 'same_for_all' | 'unique_per_student' | null;
  difficulty_distribution?: { easy?: number; medium?: number; hard?: number } | null;
  marks_distribution?: Record<string, number> | null;
  question_reuse_policy?: 'allow_reuse' | 'no_reuse_until_exhausted' | null;
  duration_minutes?: number | null;
  start_at?: string | null;
  end_at?: string | null;
  status: SittingStatus;
  results_released?: boolean;
}

interface SittingDraft {
  session: string;
  term: TermValue | '';
  assessment_mode_snapshot: SittingMode;
  question_count: string;
  question_selection_mode: QuestionSelectionMode;
  shuffle_question_order: boolean;
  shuffle_option_order: boolean;
  duration_minutes: string;
  start_at: string;
  end_at: string;
  status: SittingStatus;
  results_released: boolean;
}

const TERM_OPTIONS: TermValue[] = ['First Term', 'Second Term', 'Third Term'];
const STATUS_OPTIONS: SittingStatus[] = ['draft', 'scheduled', 'active', 'closed'];

const toDateInput = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toApiDate = (value: string): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return `${raw.replace('T', ' ')}:00`;
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
};

const ExamSittings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedExamId = Number(searchParams.get('examId') || 0);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingSittings, setLoadingSittings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [sittings, setSittings] = useState<SittingRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [selectedSittingIds, setSelectedSittingIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<SittingStatus>('scheduled');
  const [editRows, setEditRows] = useState<Record<number, SittingDraft>>({});
  const [showSittingRandomizationModal, setShowSittingRandomizationModal] = useState(false);
  const [activeRandomizationSitting, setActiveRandomizationSitting] = useState<SittingRow | null>(null);
  const [createDraft, setCreateDraft] = useState<SittingDraft>({
    session: '',
    term: '',
    assessment_mode_snapshot: 'exam',
    question_count: '',
    question_selection_mode: 'fixed',
    shuffle_question_order: false,
    shuffle_option_order: false,
    duration_minutes: '',
    start_at: '',
    end_at: '',
    status: 'scheduled',
    results_released: false,
  });

  const filteredExams = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return exams;
    return exams.filter((exam) => {
      return [
        exam.title,
        exam.subject?.name || '',
        exam.school_class?.name || '',
      ].some((val) => String(val).toLowerCase().includes(term));
    });
  }, [exams, search]);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) || null,
    [exams, selectedExamId],
  );

  const loadExams = async () => {
    try {
      setLoadingExams(true);
      const response = await api.get('/exams');
      const rows = response.data?.data || response.data || [];
      const list = Array.isArray(rows) ? rows : [];
      setExams(list);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to load exams.');
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  };

  const hydrateDraft = (row: SittingRow): SittingDraft => ({
    session: String(row.session || ''),
    term: (row.term || '') as TermValue | '',
    assessment_mode_snapshot: row.assessment_mode_snapshot,
    question_count: row.question_count ? String(row.question_count) : '',
    question_selection_mode: (row.question_selection_mode || 'fixed') as QuestionSelectionMode,
    shuffle_question_order: !!row.shuffle_question_order,
    shuffle_option_order: !!row.shuffle_option_order,
    duration_minutes: row.duration_minutes ? String(row.duration_minutes) : '',
    start_at: toDateInput(row.start_at),
    end_at: toDateInput(row.end_at),
    status: row.status,
    results_released: !!row.results_released,
  });

  const loadSittings = async (examId: number) => {
    if (!examId) {
      setSittings([]);
      return;
    }

    try {
      setLoadingSittings(true);
      const response = await api.get(`/exams/${examId}/sittings`);
      const rows = response.data?.sittings || response.data?.data || [];
      const list: SittingRow[] = Array.isArray(rows) ? rows : [];
      setSittings(list);

      const nextEditRows: Record<number, SittingDraft> = {};
      list.forEach((row) => {
        nextEditRows[row.id] = hydrateDraft(row);
      });
      setEditRows(nextEditRows);
      setSelectedSittingIds([]);
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      if (status === 503) {
        showError('Exam sitting layer unavailable. Ensure backend migrations have been applied.');
      } else {
        showError(error?.response?.data?.message || 'Failed to load sittings.');
      }
      setSittings([]);
      setEditRows({});
    } finally {
      setLoadingSittings(false);
    }
  };

  const primeCreateDraft = (exam: ExamRow | null) => {
    setCreateDraft({
      session: String(exam?.academic_session || ''),
      term: (exam?.term || '') as TermValue | '',
      assessment_mode_snapshot: 'exam',
      question_count: exam?.metadata?.question_count ? String(exam.metadata.question_count) : '',
      question_selection_mode: 'fixed',
      shuffle_question_order: false,
      shuffle_option_order: false,
      duration_minutes: exam?.duration_minutes ? String(exam.duration_minutes) : '60',
      start_at: toDateInput(exam?.start_datetime || exam?.start_time),
      end_at: toDateInput(exam?.end_datetime || exam?.end_time),
      status: 'scheduled',
      results_released: false,
    });
  };

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (exams.length === 0) {
      setSelectedExamId(0);
      return;
    }

    if (requestedExamId > 0 && exams.some((exam) => exam.id === requestedExamId)) {
      if (selectedExamId !== requestedExamId) {
        setSelectedExamId(requestedExamId);
      }
      return;
    }

    if (!selectedExamId) {
      setSelectedExamId(Number(exams[0].id));
    }
  }, [exams, requestedExamId, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId) return;
    if (selectedExamId === requestedExamId) return;

    const next = new URLSearchParams(searchParams);
    next.set('examId', String(selectedExamId));
    setSearchParams(next, { replace: true });
  }, [requestedExamId, searchParams, selectedExamId, setSearchParams]);

  useEffect(() => {
    if (selectedExamId > 0) {
      loadSittings(selectedExamId);
      primeCreateDraft(selectedExam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId]);

  const createSitting = async () => {
    if (!selectedExamId) {
      showError('Select an exam first.');
      return;
    }

    const payload = {
      session: createDraft.session || null,
      term: createDraft.term || null,
      assessment_mode_snapshot: createDraft.assessment_mode_snapshot,
      question_count: createDraft.question_count ? Number(createDraft.question_count) : null,
      question_selection_mode: createDraft.question_selection_mode,
      shuffle_question_order: !!createDraft.shuffle_question_order,
      shuffle_option_order: !!createDraft.shuffle_option_order,
      duration_minutes: createDraft.duration_minutes ? Number(createDraft.duration_minutes) : null,
      start_at: toApiDate(createDraft.start_at),
      end_at: toApiDate(createDraft.end_at),
      status: createDraft.status,
      results_released: !!createDraft.results_released,
    };

    if (payload.start_at && payload.end_at && new Date(payload.end_at).getTime() <= new Date(payload.start_at).getTime()) {
      showError('Sitting end date/time must be after start date/time.');
      return;
    }

    try {
      setSaving(true);
      await api.post(`/exams/${selectedExamId}/sittings`, payload);
      showSuccess('Sitting created successfully.');
      await loadSittings(selectedExamId);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to create sitting.');
    } finally {
      setSaving(false);
    }
  };

  const updateSitting = async (sittingId: number) => {
    if (!selectedExamId) return;
    const row = editRows[sittingId];
    if (!row) return;

    const payload = {
      session: row.session || null,
      term: row.term || null,
      assessment_mode_snapshot: row.assessment_mode_snapshot,
      duration_minutes: row.duration_minutes ? Number(row.duration_minutes) : null,
      start_at: toApiDate(row.start_at),
      end_at: toApiDate(row.end_at),
      status: row.status,
      results_released: !!row.results_released,
    };

    if (payload.start_at && payload.end_at && new Date(payload.end_at).getTime() <= new Date(payload.start_at).getTime()) {
      showError('Sitting end date/time must be after start date/time.');
      return;
    }

    try {
      setSaving(true);
      await api.put(`/exams/${selectedExamId}/sittings/${sittingId}`, payload);
      showSuccess(`Sitting #${sittingId} updated.`);
      await loadSittings(selectedExamId);
    } catch (error: any) {
      showError(error?.response?.data?.message || `Failed to update sitting #${sittingId}.`);
    } finally {
      setSaving(false);
    }
  };

  const duplicateSitting = async (sittingId: number) => {
    if (!selectedExamId) return;
    try {
      setSaving(true);
      await api.post(`/exams/${selectedExamId}/sittings/${sittingId}/duplicate`);
      showSuccess(`Sitting #${sittingId} duplicated.`);
      await loadSittings(selectedExamId);
    } catch (error: any) {
      showError(error?.response?.data?.message || `Failed to duplicate sitting #${sittingId}.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteSitting = async (sittingId: number) => {
    if (!selectedExamId) return;
    if (!window.confirm(`Delete sitting #${sittingId}?`)) return;

    try {
      setSaving(true);
      await api.delete(`/exams/${selectedExamId}/sittings/${sittingId}`);
      showSuccess(`Sitting #${sittingId} deleted.`);
      await loadSittings(selectedExamId);
    } catch (error: any) {
      showError(error?.response?.data?.message || `Failed to delete sitting #${sittingId}.`);
    } finally {
      setSaving(false);
    }
  };

  const applyBulkStatus = async () => {
    if (!selectedExamId) return;
    if (selectedSittingIds.length === 0) {
      showError('Select at least one sitting for bulk status update.');
      return;
    }

    try {
      setSaving(true);
      await api.post(`/exams/${selectedExamId}/sittings/bulk-status`, {
        sitting_ids: selectedSittingIds,
        status: bulkStatus,
      });
      showSuccess(`Updated ${selectedSittingIds.length} sitting(s) to ${bulkStatus}.`);
      await loadSittings(selectedExamId);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Bulk status update failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAllSittings = (checked: boolean) => {
    if (checked) {
      setSelectedSittingIds(sittings.map((row) => row.id));
      return;
    }
    setSelectedSittingIds([]);
  };

  const toggleSitting = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedSittingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return;
    }
    setSelectedSittingIds((prev) => prev.filter((x) => x !== id));
  };

  const openSittingRandomization = (row: SittingRow) => {
    setActiveRandomizationSitting(row);
    setShowSittingRandomizationModal(true);
  };

  return (
    <div className="app-shell section-shell py-4 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
          Assessment Sittings
        </h1>
        <p className="text-xs md:text-sm text-gray-600 mt-1">
          Manage CA and Exam instances separately without reusing one exam record for different events.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exam by title, class, or subject"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <select
            value={selectedExamId || ''}
            onChange={(e) => setSelectedExamId(Number(e.target.value || 0))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[340px]"
            disabled={loadingExams}
          >
            {filteredExams.length === 0 ? (
              <option value="">{loadingExams ? 'Loading exams...' : 'No exams found'}</option>
            ) : (
              filteredExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {`#${exam.id} ${exam.title} | ${exam.school_class?.name || '-'} | ${exam.subject?.name || '-'}`}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {selectedExam && (
        <>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-2">Create New Sitting</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                value={createDraft.assessment_mode_snapshot}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, assessment_mode_snapshot: e.target.value as SittingMode }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="ca_test">CA Test</option>
                <option value="exam">Exam</option>
              </select>

              <select
                value={createDraft.status}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, status: e.target.value as SittingStatus }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <input
                value={createDraft.session}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, session: e.target.value }))}
                placeholder="Session (e.g. 2025/2026)"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />

              <select
                value={createDraft.term}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, term: e.target.value as TermValue | '' }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Term</option>
                {TERM_OPTIONS.map((term) => (
                  <option key={term} value={term}>{term}</option>
                ))}
              </select>

              <input
                value={createDraft.duration_minutes}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                type="number"
                min={1}
                placeholder="Duration (minutes)"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />

              <input
                value={createDraft.start_at}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, start_at: e.target.value }))}
                type="datetime-local"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />

              <input
                value={createDraft.end_at}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, end_at: e.target.value }))}
                type="datetime-local"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={createDraft.results_released}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, results_released: e.target.checked }))}
                />
                Results Released
              </label>

              <button
                onClick={createSitting}
                disabled={saving}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              >
                Create Sitting
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-800">Existing Sittings for: {selectedExam.title}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => navigate(`/admin/exams?questionExamId=${selectedExamId}`)}
                    className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    Add Questions
                  </button>
                  <button
                    onClick={() => navigate(`/admin/results?examId=${selectedExamId}`)}
                    className="px-3 py-1.5 rounded bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700"
                  >
                    View Results
                  </button>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as SittingStatus)}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={applyBulkStatus}
                    disabled={saving || selectedSittingIds.length === 0}
                    className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Apply Bulk Status ({selectedSittingIds.length})
                  </button>
                </div>
              </div>
            </div>

            {loadingSittings ? (
              <div className="p-4 text-sm text-gray-500">Loading sittings...</div>
            ) : sittings.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No sittings created yet for this exam.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 border-b">
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={sittings.length > 0 && selectedSittingIds.length === sittings.length}
                          onChange={(e) => toggleAllSittings(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Mode</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Session</th>
                      <th className="px-3 py-2 text-left">Term</th>
                      <th className="px-3 py-2 text-left">Duration</th>
                      <th className="px-3 py-2 text-left">Start</th>
                      <th className="px-3 py-2 text-left">End</th>
                      <th className="px-3 py-2 text-left">Released</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sittings.map((row) => {
                      const edit = editRows[row.id] || hydrateDraft(row);
                      return (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedSittingIds.includes(row.id)}
                              onChange={(e) => toggleSitting(row.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2 font-semibold text-gray-700">#{row.id}</td>
                          <td className="px-3 py-2">
                            <select
                              value={edit.assessment_mode_snapshot}
                              onChange={(e) => setEditRows((prev) => ({ ...prev, [row.id]: { ...edit, assessment_mode_snapshot: e.target.value as SittingMode } }))}
                              className="px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="ca_test">CA Test</option>
                              <option value="exam">Exam</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={edit.status}
                              onChange={(e) => setEditRows((prev) => ({ ...prev, [row.id]: { ...edit, status: e.target.value as SittingStatus } }))}
                              className="px-2 py-1 border border-gray-300 rounded"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={edit.session}
                              onChange={(e) => setEditRows((prev) => ({ ...prev, [row.id]: { ...edit, session: e.target.value } }))}
                              className="px-2 py-1 border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={edit.term}
                              onChange={(e) => setEditRows((prev) => ({ ...prev, [row.id]: { ...edit, term: e.target.value as TermValue | '' } }))}
                              className="px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="">-</option>
                              {TERM_OPTIONS.map((term) => (
                                <option key={term} value={term}>{term}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={1}
                              value={edit.duration_minutes}
                              onChange={(e) => setEditRows((prev) => ({ ...prev, [row.id]: { ...edit, duration_minutes: e.target.value } }))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="datetime-local"
                              value={edit.start_at}
                              onChange={(e) => setEditRows((prev) => ({ ...prev, [row.id]: { ...edit, start_at: e.target.value } }))}
                              className="px-2 py-1 border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="datetime-local"
                              value={edit.end_at}
                              onChange={(e) => setEditRows((prev) => ({ ...prev, [row.id]: { ...edit, end_at: e.target.value } }))}
                              className="px-2 py-1 border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={edit.results_released}
                                onChange={(e) => setEditRows((prev) => ({ ...prev, [row.id]: { ...edit, results_released: e.target.checked } }))}
                              />
                              <span>{edit.results_released ? 'Yes' : 'No'}</span>
                            </label>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateSitting(row.id)}
                                disabled={saving}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-60"
                                title="Save"
                                aria-label="Save"
                              >
                                <i className='bx bx-save text-sm'></i>
                              </button>
                              <button
                                onClick={() => openSittingRandomization(row)}
                                disabled={saving}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-60"
                                title="Randomization"
                                aria-label="Randomization"
                              >
                                <i className='bx bx-shuffle text-sm'></i>
                              </button>
                              <button
                                onClick={() => duplicateSitting(row.id)}
                                disabled={saving}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60"
                                title="Duplicate"
                                aria-label="Duplicate"
                              >
                                <i className='bx bx-copy text-sm'></i>
                              </button>
                              <button
                                onClick={() => deleteSitting(row.id)}
                                disabled={saving}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
                                title="Delete"
                                aria-label="Delete"
                              >
                                <i className='bx bx-trash text-sm'></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showSittingRandomizationModal && activeRandomizationSitting && selectedExamId > 0 && (
        <QuestionRandomization
          examId={selectedExamId}
          onClose={() => {
            setShowSittingRandomizationModal(false);
            setActiveRandomizationSitting(null);
          }}
          sittingContext={{
            sittingId: activeRandomizationSitting.id,
            title: `Sitting #${activeRandomizationSitting.id}`,
            initialSettings: {
              question_selection_mode: activeRandomizationSitting.question_selection_mode,
              question_count: activeRandomizationSitting.question_count,
              shuffle_question_order: activeRandomizationSitting.shuffle_question_order,
              shuffle_option_order: activeRandomizationSitting.shuffle_option_order,
              question_distribution: activeRandomizationSitting.question_distribution,
              difficulty_distribution: activeRandomizationSitting.difficulty_distribution,
              marks_distribution: activeRandomizationSitting.marks_distribution as any,
              question_reuse_policy: activeRandomizationSitting.question_reuse_policy,
            },
            onSaved: async () => {
              if (selectedExamId > 0) {
                await loadSittings(selectedExamId);
              }
            },
          }}
        />
      )}
    </div>
  );
};

export default ExamSittings;
