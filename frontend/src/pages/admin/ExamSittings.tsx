import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
import { serialNumber } from '../../utils/serialNumber';
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

const formatDateCell = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [createExamId, setCreateExamId] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | SittingMode>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SittingStatus>('all');
  const [perPage, setPerPage] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [selectedSittingIds, setSelectedSittingIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<SittingStatus>('scheduled');
  const [openRowMenu, setOpenRowMenu] = useState<{ sitting: SittingRow; top: number; left: number } | null>(null);
  const [editRows, setEditRows] = useState<Record<number, SittingDraft>>({});
  const [showSittingRandomizationModal, setShowSittingRandomizationModal] = useState(false);
  const [activeRandomizationSitting, setActiveRandomizationSitting] = useState<SittingRow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSittingId, setEditingSittingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<SittingDraft | null>(null);
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

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) || null,
    [exams, selectedExamId],
  );

  const examById = useMemo(() => {
    const map = new Map<number, ExamRow>();
    exams.forEach((exam) => map.set(exam.id, exam));
    return map;
  }, [exams]);

  const createExam = useMemo(
    () => exams.find((exam) => exam.id === createExamId) || null,
    [createExamId, exams],
  );

  const editingSitting = useMemo(
    () => sittings.find((row) => row.id === editingSittingId) || null,
    [sittings, editingSittingId],
  );

  const editingExam = useMemo(
    () => (editingSitting ? examById.get(editingSitting.exam_id) || null : null),
    [editingSitting, examById],
  );

  const filteredSittings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sittings.filter((row) => {
      if (selectedExamId > 0 && row.exam_id !== selectedExamId) return false;
      if (modeFilter !== 'all' && row.assessment_mode_snapshot !== modeFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;

      if (!term) return true;
      const exam = examById.get(row.exam_id);
      return [
        exam?.title || '',
        exam?.school_class?.name || '',
        exam?.subject?.name || '',
        row.session || '',
        row.term || '',
      ].some((val) => String(val).toLowerCase().includes(term));
    });
  }, [sittings, searchTerm, selectedExamId, modeFilter, statusFilter, examById]);

  const totalPages = Math.max(1, Math.ceil(filteredSittings.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedSittings = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredSittings.slice(start, start + perPage);
  }, [filteredSittings, currentPage, perPage]);

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
    if (!examId) return [] as SittingRow[];

    const response = await api.get(`/exams/${examId}/sittings`);
    const rows = response.data?.sittings || response.data?.data || [];
    return Array.isArray(rows) ? (rows as SittingRow[]) : [];
  };

  const loadAllSittings = async () => {
    if (exams.length === 0) {
      setSittings([]);
      setEditRows({});
      return;
    }

    try {
      setLoadingSittings(true);
      const responses = await Promise.all(
        exams.map(async (exam) => {
          try {
            return await loadSittings(exam.id);
          } catch {
            return [] as SittingRow[];
          }
        }),
      );

      const merged = responses
        .flat()
        .filter((row): row is SittingRow => !!row)
        .sort((a, b) => b.id - a.id);
      setSittings(merged);

      const nextEditRows: Record<number, SittingDraft> = {};
      merged.forEach((row) => {
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
    }
  }, [exams, requestedExamId, selectedExamId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedExamId > 0) {
      next.set('examId', String(selectedExamId));
    } else {
      next.delete('examId');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedExamId, setSearchParams]);

  useEffect(() => {
    loadAllSittings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams]);

  const createSitting = async (): Promise<boolean> => {
    const targetExamId = createExamId || selectedExamId;
    if (!targetExamId) {
      showError('Select an exam first.');
      return false;
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
      return false;
    }

    try {
      setSaving(true);
      await api.post(`/exams/${targetExamId}/sittings`, payload);
      showSuccess('Sitting created successfully.');
      setSelectedExamId(targetExamId);
      await loadAllSittings();
      return true;
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to create sitting.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateSitting = async (sittingId: number) => {
    const targetRow = sittings.find((row) => row.id === sittingId);
    if (!targetRow) return;
    const targetExamId = targetRow.exam_id;
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
      await api.put(`/exams/${targetExamId}/sittings/${sittingId}`, payload);
      showSuccess(`Sitting ${sittingId} updated.`);
      await loadAllSittings();
      setShowEditModal(false);
      setEditingSittingId(null);
      setEditDraft(null);
    } catch (error: any) {
      showError(error?.response?.data?.message || `Failed to update sitting ${sittingId}.`);
    } finally {
      setSaving(false);
    }
  };

  const duplicateSitting = async (sittingId: number) => {
    const targetRow = sittings.find((row) => row.id === sittingId);
    if (!targetRow) return;
    try {
      setSaving(true);
      await api.post(`/exams/${targetRow.exam_id}/sittings/${sittingId}/duplicate`);
      showSuccess(`Sitting ${sittingId} duplicated.`);
      await loadAllSittings();
    } catch (error: any) {
      showError(error?.response?.data?.message || `Failed to duplicate sitting ${sittingId}.`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSittingStatus = async (row: SittingRow) => {
    if (!row.exam_id) return;

    const statusOrder: SittingStatus[] = ['draft', 'scheduled', 'active', 'closed'];
    const currentIndex = statusOrder.indexOf(row.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length] || 'scheduled';

    try {
      setSaving(true);
      await api.put(`/exams/${row.exam_id}/sittings/${row.id}`, {
        session: row.session || null,
        term: row.term || null,
        assessment_mode_snapshot: row.assessment_mode_snapshot,
        duration_minutes: row.duration_minutes ?? null,
        start_at: row.start_at || null,
        end_at: row.end_at || null,
        results_released: !!row.results_released,
        status: nextStatus,
      });
      showSuccess(`Sitting status updated to ${nextStatus}.`);
      await loadAllSittings();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to update sitting status.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSitting = async (sittingId: number) => {
    const targetRow = sittings.find((row) => row.id === sittingId);
    if (!targetRow) return;
    if (!window.confirm(`Delete sitting ${sittingId}?`)) return;

    try {
      setSaving(true);
      await api.delete(`/exams/${targetRow.exam_id}/sittings/${sittingId}`);
      showSuccess(`Sitting ${sittingId} deleted.`);
      await loadAllSittings();
    } catch (error: any) {
      showError(error?.response?.data?.message || `Failed to delete sitting ${sittingId}.`);
    } finally {
      setSaving(false);
    }
  };

  const applyBulkStatus = async () => {
    if (selectedSittingIds.length === 0) {
      showError('Select at least one sitting for bulk status update.');
      return;
    }

    try {
      setSaving(true);
      const grouped: Record<number, number[]> = {};
      selectedSittingIds.forEach((id) => {
        const row = sittings.find((s) => s.id === id);
        if (!row) return;
        if (!grouped[row.exam_id]) grouped[row.exam_id] = [];
        grouped[row.exam_id].push(id);
      });

      await Promise.all(
        Object.entries(grouped).map(([examId, ids]) => (
          api.post(`/exams/${examId}/sittings/bulk-status`, {
            sitting_ids: ids,
            status: bulkStatus,
          })
        )),
      );
      showSuccess(`Updated ${selectedSittingIds.length} sitting(s) to ${bulkStatus}.`);
      await loadAllSittings();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Bulk status update failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAllSittings = (checked: boolean) => {
    if (checked) {
      setSelectedSittingIds(filteredSittings.map((row) => row.id));
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

  const closeRowActionsMenu = () => {
    setOpenRowMenu(null);
  };

  const openRowActionsMenu = (row: SittingRow, ev: React.MouseEvent<HTMLButtonElement>) => {
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 224;
    const menuHeight = 280;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = rect.bottom + 8;
    if (top + menuHeight > viewportH - 8) {
      top = Math.max(8, rect.top - menuHeight - 8);
    }

    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > viewportW - 8) {
      left = viewportW - menuWidth - 8;
    }

    setOpenRowMenu({ sitting: row, top, left });
  };

  const openCreateModal = () => {
    const initialExamId = selectedExamId || Number(exams[0]?.id || 0);
    setCreateExamId(initialExamId);
    const initialExam = exams.find((exam) => exam.id === initialExamId) || null;
    primeCreateDraft(initialExam);
    setShowCreateModal(true);
  };

  const openEditModal = (sittingId: number) => {
    const sitting = sittings.find((s) => s.id === sittingId);
    if (!sitting) return;
    setEditingSittingId(sittingId);
    setEditDraft(hydrateDraft(sitting));
    setShowEditModal(true);
  };

  const getPageNumbers = (current: number, total: number): Array<number | string> => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: Array<number | string> = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let p = start; p <= end; p += 1) pages.push(p);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
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

      <div className="grid grid-cols-1 gap-4 mb-4">
        <div
          onClick={openCreateModal}
          className="w-full border-2 border-dashed border-indigo-400 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-600 hover:bg-indigo-50 transition-all duration-200"
        >
          <div className="flex justify-center mb-3">
            <div className="text-4xl text-indigo-500">
              <i className='bx bx-calendar-plus'></i>
            </div>
          </div>
          <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">Manual Entry</h3>
          <p className="text-xs text-gray-600">Create a new sitting for any assessment template</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header Row - Title, Count, Search, Per-page */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title and Count */}
            <div>
              <h3 className="text-base font-semibold text-gray-900">Sittings</h3>
              <p className="text-xs text-gray-600">
                {filteredSittings.length} matching sittings
                {filteredSittings.length > 0 ? ` | Showing ${pagedSittings.length > 0 ? serialNumber(0, { page: currentPage, perPage }) : 0}-${Math.min(serialNumber(pagedSittings.length - 1, { page: currentPage, perPage }), filteredSittings.length)}` : ''}
              </p>
            </div>
            
            {/* Right: Search and Per-page */}
            <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
              {/* Search */}
              <div className="relative">
                <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'></i>
                <input
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  placeholder="Search sittings..."
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 w-48 md:w-56"
                />
              </div>
              
              {/* Per Page */}
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Select All Row with Bulk Actions */}
        <div className="bg-blue-50 border-b border-gray-200">
          <div className="px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filteredSittings.length > 0 && selectedSittingIds.length === filteredSittings.length}
                onChange={(e) => toggleAllSittings(e.target.checked)}
                className="w-5 h-5 cursor-pointer"
                title="Select all sittings"
              />
              <span className="text-sm font-semibold text-blue-800">
                {selectedSittingIds.length > 0
                  ? `${selectedSittingIds.length} of ${filteredSittings.length} selected`
                  : 'Select All'}
              </span>
            </div>
            {selectedSittingIds.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as SittingStatus)}
                  className="px-3 py-2 border border-gray-300 rounded text-xs bg-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={applyBulkStatus}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md text-xs font-semibold transition-colors"
                >
                  Apply Bulk Status ({selectedSittingIds.length})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table Header with Filters */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Label */}
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Sittings</h4>
            </div>
            
            {/* Right: Filter Dropdowns */}
            <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
              {/* Assessment Dropdown */}
              <select
                value={selectedExamId || ''}
                onChange={(e) => { setSelectedExamId(Number(e.target.value || 0)); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All assessments</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>{exam.title}</option>
                ))}
              </select>
              
              {/* Mode Filter */}
              <select
                value={modeFilter}
                onChange={(e) => { setModeFilter(e.target.value as 'all' | SittingMode); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All modes</option>
                <option value="ca_test">CA Test</option>
                <option value="exam">Exam</option>
              </select>
              
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as 'all' | SittingStatus); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loadingSittings ? (
          <div className="p-4 text-sm text-gray-500">Loading sittings...</div>
        ) : filteredSittings.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No sittings found for this filter.</div>
        ) : (
          <>
            <div>
              <table className="w-full text-xs table-auto">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 border-b">
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={filteredSittings.length > 0 && selectedSittingIds.length === filteredSittings.length}
                          onChange={(e) => toggleAllSittings(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">No.</th>
                      <th className="px-3 py-2 text-left">Assessment</th>
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
                    {pagedSittings.map((row, index) => {
                      const exam = examById.get(row.exam_id);
                      return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedSittingIds.includes(row.id)}
                            onChange={(e) => toggleSitting(row.id, e.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-700">{serialNumber(index, { page: currentPage, perPage })}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{exam?.title || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {row.assessment_mode_snapshot === 'ca_test' ? 'CA Test' : 'Exam'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            row.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                            row.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                            row.status === 'active' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{row.session || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.term || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.duration_minutes || '-'}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {formatDateCell(row.start_at)}
                        </td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {formatDateCell(row.end_at)}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {row.results_released ? 'Yes' : 'No'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(row.id)}
                              disabled={saving}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-60"
                              title="Edit"
                              aria-label="Edit"
                            >
                              <i className='bx bx-edit text-sm'></i>
                            </button>
                            <button
                              onClick={(ev) => openRowActionsMenu(row, ev)}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              title="More actions"
                              aria-label="More actions"
                            >
                              <i className='bx bx-dots-vertical-rounded text-sm'></i>
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
                    );})}
                  </tbody>
                </table>
            </div>

            <div className="bg-gray-50/60 border-t border-gray-200 p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="text-gray-600">
                  Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, filteredSittings.length)} of {filteredSittings.length}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Prev
                  </button>
                  {getPageNumbers(currentPage, totalPages).map((pageNum, idx) => (
                    pageNum === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum as number)}
                        className={`min-w-[34px] px-2.5 py-1.5 border rounded-md ${
                          pageNum === currentPage
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  ))}
                  <button
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {openRowMenu && createPortal(
        <div className="fixed inset-0 z-[9999]" onClick={closeRowActionsMenu}>
          <div
            className="absolute w-56 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{ top: openRowMenu.top, left: openRowMenu.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                openSittingRandomization(openRowMenu.sitting);
                closeRowActionsMenu();
              }}
              className="w-full text-left px-4 py-3 text-sm text-violet-700 hover:bg-violet-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
            >
              <i className='bx bx-shuffle text-violet-500'></i>
              <span className="font-medium">Randomization</span>
            </button>
            <button
              onClick={() => {
                duplicateSitting(openRowMenu.sitting.id);
                closeRowActionsMenu();
              }}
              className="w-full text-left px-4 py-3 text-sm text-green-700 hover:bg-green-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
            >
              <i className='bx bx-copy text-green-500'></i>
              <span className="font-medium">Duplicate</span>
            </button>
            <button
              onClick={() => {
                toggleSittingStatus(openRowMenu.sitting);
                closeRowActionsMenu();
              }}
              className="w-full text-left px-4 py-3 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
            >
              <i className='bx bx-toggle-right text-amber-500'></i>
              <span className="font-medium">Toggle Status</span>
            </button>
            <button
              onClick={() => {
                navigate(`/admin/exams?questionExamId=${openRowMenu.sitting.exam_id}`);
                closeRowActionsMenu();
              }}
              className="w-full text-left px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
            >
              <i className='bx bx-plus-circle text-blue-500'></i>
              <span className="font-medium">Add Questions</span>
            </button>
            <button
              onClick={() => {
                navigate(`/admin/results?examId=${openRowMenu.sitting.exam_id}`);
                closeRowActionsMenu();
              }}
              className="w-full text-left px-4 py-3 text-sm text-cyan-700 hover:bg-cyan-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
            >
              <i className='bx bx-bar-chart-alt-2 text-cyan-500'></i>
              <span className="font-medium">View Results</span>
            </button>
            <button
              onClick={() => {
                navigate('/admin/exams');
                closeRowActionsMenu();
              }}
              className="w-full text-left px-4 py-3 text-sm text-indigo-700 hover:bg-indigo-50 flex items-center gap-3 transition-colors"
            >
              <i className='bx bx-folder-open text-indigo-500'></i>
              <span className="font-medium">Open Exam Workspace</span>
            </button>
          </div>
        </div>,
        document.body,
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Create New Sitting</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                <i className='bx bx-x'></i>
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <i className='bx bx-info-circle mr-1'></i>
                  <strong>Tip:</strong> First pick an assessment template, then create its sitting.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assessment Template *
                </label>
                <select
                  value={createExamId || ''}
                  onChange={(e) => {
                    const nextExamId = Number(e.target.value || 0);
                    setCreateExamId(nextExamId);
                    const nextExam = exams.find((exam) => exam.id === nextExamId) || null;
                    primeCreateDraft(nextExam);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={loadingExams}
                >
                  <option value="">Select assessment template</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {`${exam.title} | ${exam.school_class?.name || '-'} | ${exam.subject?.name || '-'}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assessment Mode *
                  </label>
                  <select
                    value={createDraft.assessment_mode_snapshot}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, assessment_mode_snapshot: e.target.value as SittingMode }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="ca_test">CA Test</option>
                    <option value="exam">Exam</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Session
                  </label>
                  <input
                    value={createDraft.session}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, session: e.target.value }))}
                    placeholder="e.g., 2026/2027"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Term
                  </label>
                  <select
                    value={createDraft.term}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, term: e.target.value as TermValue | '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select term</option>
                    {TERM_OPTIONS.map((term) => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Duration (minutes) *
                </label>
                <input
                  value={createDraft.duration_minutes}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                  type="number"
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Used for countdown and auto-submit behavior.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Start Date/Time
                  </label>
                  <input
                    value={createDraft.start_at}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, start_at: e.target.value }))}
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    End Date/Time
                  </label>
                  <input
                    value={createDraft.end_at}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, end_at: e.target.value }))}
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={createDraft.results_released}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, results_released: e.target.checked }))}
                  />
                  Results Released
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!createExamId) {
                        showError('Select an assessment template first.');
                        return;
                      }
                      const created = await createSitting();
                      if (created) {
                        setShowCreateModal(false);
                      }
                    }}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:shadow-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Sitting
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingSittingId && editDraft && editingSitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Edit Sitting</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSittingId(null);
                  setEditDraft(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                <i className='bx bx-x'></i>
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <i className='bx bx-info-circle mr-1'></i>
                  <strong>Tip:</strong> Update the sitting settings for <strong>{editingExam?.title || `Exam ${editingSitting.exam_id}`}</strong>.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assessment Mode *
                  </label>
                  <select
                    value={editDraft.assessment_mode_snapshot}
                    onChange={(e) => setEditDraft((prev) => prev ? { ...prev, assessment_mode_snapshot: e.target.value as SittingMode } : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="ca_test">CA Test</option>
                    <option value="exam">Exam</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Session
                  </label>
                  <input
                    value={editDraft.session}
                    onChange={(e) => setEditDraft((prev) => prev ? { ...prev, session: e.target.value } : null)}
                    placeholder="e.g., 2026/2027"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Term
                  </label>
                  <select
                    value={editDraft.term}
                    onChange={(e) => setEditDraft((prev) => prev ? { ...prev, term: e.target.value as TermValue | '' } : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select term</option>
                    {TERM_OPTIONS.map((term) => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Duration (minutes) *
                </label>
                <input
                  value={editDraft.duration_minutes}
                  onChange={(e) => setEditDraft((prev) => prev ? { ...prev, duration_minutes: e.target.value } : null)}
                  type="number"
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Used for countdown and auto-submit behavior.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Start Date/Time
                  </label>
                  <input
                    value={editDraft.start_at}
                    onChange={(e) => setEditDraft((prev) => prev ? { ...prev, start_at: e.target.value } : null)}
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    End Date/Time
                  </label>
                  <input
                    value={editDraft.end_at}
                    onChange={(e) => setEditDraft((prev) => prev ? { ...prev, end_at: e.target.value } : null)}
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editDraft.results_released}
                    onChange={(e) => setEditDraft((prev) => prev ? { ...prev, results_released: e.target.checked } : null)}
                  />
                  Results Released
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingSittingId(null);
                      setEditDraft(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingSittingId) {
                        setEditRows((prev) => ({ ...prev, [editingSittingId]: editDraft }));
                        updateSitting(editingSittingId);
                      }
                    }}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:shadow-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Changes
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSittingRandomizationModal && activeRandomizationSitting && activeRandomizationSitting.exam_id > 0 && (
        <QuestionRandomization
          examId={activeRandomizationSitting.exam_id}
          onClose={() => {
            setShowSittingRandomizationModal(false);
            setActiveRandomizationSitting(null);
          }}
          sittingContext={{
            sittingId: activeRandomizationSitting.id,
            title: `Sitting ${activeRandomizationSitting.id}`,
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
              await loadAllSittings();
            },
          }}
        />
      )}
    </div>
  );
};

export default ExamSittings;
