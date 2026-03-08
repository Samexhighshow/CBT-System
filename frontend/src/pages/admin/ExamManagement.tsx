import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SkeletonTable } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { runWithRetry } from '../../utils/requestRetry';
import {
  AssessmentDisplayMode,
  defaultAssessmentDisplayConfig,
  fetchAssessmentDisplayConfig,
} from '../../services/assessmentDisplay';

/*
 * Admin Exam Management (Phase 5 UI)
 * Matches Academic Management style: segmented tabs, action cards,
 * compact filters, and a clean table layout.
 */

type ExamStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';
type AssessmentType = 'CA Test' | 'Midterm Test' | 'Final Exam' | 'Quiz';

interface ExamRow {
  id: number;
  title: string;
  status: ExamStatus;
  effective_status?: ExamStatus;
  duration_minutes: number;
  assessment_type?: AssessmentType;
  assessment_weight?: number;
  start_datetime?: string;
  end_datetime?: string;
  start_time?: string;
  end_time?: string;
  published: boolean;
  results_released?: boolean;
  subject?: { id: number; name: string } | null;
  school_class?: { id: number; name: string } | null;
  metadata?: { question_count?: number } | null;
  academic_session?: string;
  term?: 'First Term' | 'Second Term' | 'Third Term' | null;
}

interface ExamSittingRow {
  id: number;
  exam_id: number;
  session?: string | null;
  term?: 'First Term' | 'Second Term' | 'Third Term' | null;
  assessment_mode_snapshot: 'ca_test' | 'exam';
  question_count?: number | null;
  duration_minutes?: number | null;
  start_at?: string | null;
  end_at?: string | null;
  status: 'draft' | 'scheduled' | 'active' | 'closed';
  results_released?: boolean;
}

const formatDate = (value?: string) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

const ExamManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'start-recent' | 'start-oldest'>('title-asc');
  const [perPage, setPerPage] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [selectedExams, setSelectedExams] = useState<number[]>([]);
  const [assessmentMode, setAssessmentMode] = useState<AssessmentDisplayMode>(defaultAssessmentDisplayConfig.mode);
  const [classLevelFilter, setClassLevelFilter] = useState<string>('');
  
  // PHASE 8: Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [examToDelete, setExamToDelete] = useState<ExamRow | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // View exam detail modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingExam, setViewingExam] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [examSittings, setExamSittings] = useState<ExamSittingRow[]>([]);
  const [sittingsLoading, setSittingsLoading] = useState(false);

  // Exam ↔ Questions linking state
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [examQuestionsLoading, setExamQuestionsLoading] = useState(false);
  const [showManageQuestions, setShowManageQuestions] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [bankQLoading, setBankQLoading] = useState(false);
  const [selectedBankQIds, setSelectedBankQIds] = useState<number[]>([]);
  const manageSubjectIdRef = useRef<number | null>(null);
  const manageExamIdRef = useRef<number | null>(null);
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledQuestionExamIdRef = useRef<number>(0);

  // Modal and form state
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamRow | null>(null);
  const [classes, setClasses] = useState<Array<{ id: number; name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string; class_level: string }>>([]);
  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    class_id: '',
    subject_id: '',
    duration_minutes: 60,
    instructions: '',
  });

  // Deduplicate class levels by name; prefer currently selected class id if available
  const uniqueClassLevels = useMemo(() => {
    if (!classes || classes.length === 0) return [] as Array<{ id: number; name: string }>;
    const byName = new Map<string, Array<{ id: number; name: string }>>();
    for (const cls of classes) {
      const list = byName.get(cls.name);
      if (list) list.push(cls); else byName.set(cls.name, [cls]);
    }
    const selectedId = Number(examForm.class_id);
    const result: Array<{ id: number; name: string }> = [];
    byName.forEach((list, name) => {
      const preferred = list.find(c => c.id === selectedId) || list[0];
      result.push(preferred);
    });
    // Keep stable ordering by name
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [classes, examForm.class_id]);


  const loadExams = async () => {
    try {
      setLoading(true);
      const response = await runWithRetry(() => api.get('/exams', { skipGlobalLoading: true } as any));
      const data = response.data?.data || response.data || [];
      setExams(data);
      setSelectedExams([]);
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
      
      // Provide detailed error messages
      let errorMessage = 'Unable to load exams';
      
      if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please ensure the backend API is running on port 8000.';
      } else if (error?.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
        // Redirect to login after a moment
        setTimeout(() => {
          localStorage.removeItem('auth_token');
          window.location.href = '/admin-login';
        }, 2000);
      } else if (error?.response?.status === 403) {
        errorMessage = 'You do not have permission to view exams. Please contact an administrator.';
      } else if (error?.response?.status === 404) {
        errorMessage = 'Exams endpoint not found. The API may be misconfigured.';
      } else if (error?.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later or contact support.';
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      showError(errorMessage);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAssessmentMode = async () => {
    try {
      const config = await fetchAssessmentDisplayConfig();
      setAssessmentMode(config.mode);
    } catch {
      setAssessmentMode(defaultAssessmentDisplayConfig.mode);
    }
  };

  const handleSelectAllExams = () => {
    const pageIds = paged.map((exam) => exam.id);
    if (pageIds.length === 0) return;

    const allPageSelected = pageIds.every((id) => selectedExams.includes(id));
    if (allPageSelected) {
      setSelectedExams((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedExams((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleExportExams = () => {
    if (selectedExams.length === 0) return;

    const selectedRows = exams.filter((exam) => selectedExams.includes(exam.id));
    const csvEscape = (value: unknown) => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Exam ID',
      'Title',
      'Assessment Type',
      'Class Level',
      'Subject',
      'Default Duration (mins)',
      'Question Count',
    ];

    const lines = selectedRows.map((exam) => [
      exam.id,
      exam.title,
      exam.assessment_type || '',
      exam.school_class?.name || '',
      exam.subject?.name || '',
      exam.duration_minutes,
      exam.metadata?.question_count ?? '',
    ].map(csvEscape).join(','));

    const csv = [headers.map(csvEscape).join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `exams-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    showSuccess(`${selectedRows.length} exam(s) exported`);
  };


  const handleBulkDeleteExams = async () => {
    if (selectedExams.length === 0) return;
    
    const result = await showDeleteConfirm(`${selectedExams.length} selected exam(s)`);
    if (!result.isConfirmed) return;

    try {
      await Promise.all(selectedExams.map(id => api.delete(`/exams/${id}`, {
        data: { confirmation_title: 'bulk_delete_bypass' }
      })));
      showSuccess(`${selectedExams.length} exam(s) deleted successfully`);
      setSelectedExams([]);
      loadExams();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      showError('Failed to delete some exams');
    }
  };

  const handleDeleteExam = (exam: ExamRow) => {
    setExamToDelete(exam);
    setDeleteConfirmation('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;
    
    if (deleteConfirmation !== examToDelete.title) {
      showError('Exam title does not match');
      return;
    }

    try {
      await api.delete(`/exams/${examToDelete.id}`, {
        data: { confirmation_title: deleteConfirmation }
      });
      showSuccess('Exam deleted successfully');
      setShowDeleteModal(false);
      setExamToDelete(null);
      setDeleteConfirmation('');
      loadExams();
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.confirmation_title?.[0] 
        || error.response?.data?.errors?.questions?.[0]
        || error.response?.data?.message 
        || 'Failed to delete exam';
      showError(errorMessage);
    }
  };

  const loadClasses = async () => {
    try {
      const response = await runWithRetry(() =>
        api.get('/staff/classes?limit=1000', { skipGlobalLoading: true } as any)
      );
      const data = response.data?.data || response.data || [];
      setClasses(data);
    } catch (error) {
      console.error('Failed to fetch classes', error);
    }
  };

  const loadSubjects = async (classLevel?: string) => {
    try {
      const url = classLevel ? `/subjects?class_level=${encodeURIComponent(classLevel)}&limit=1000` : '/subjects?limit=1000';
      const response = await api.get(url);
      const data = response.data?.data || response.data || [];
      setSubjects(data);
    } catch (error) {
      console.error('Failed to fetch subjects', error);
      setSubjects([]);
    }
  };

  const resetForm = () => {
    setExamForm({
      title: '',
      description: '',
      class_id: '',
      subject_id: '',
      duration_minutes: 60,
      instructions: '',
    });
    setEditingExam(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowExamModal(true);
  };

  const handleOpenEditModal = (exam: ExamRow) => {
    setEditingExam(exam);
    setExamForm({
      title: exam.title,
      description: '',
      class_id: exam.school_class?.id?.toString() || '',
      subject_id: exam.subject?.id?.toString() || '',
      duration_minutes: exam.duration_minutes,
      instructions: '',
    });
    if (exam.school_class?.name) {
      loadSubjects(exam.school_class.name);
    }
    setShowExamModal(true);
  };

  const handleSubmitExam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!examForm.title || !examForm.class_id || !examForm.subject_id) {
      showError('Please fill in all required fields');
      return;
    }

    const selectedClass = classes.find(c => c.id === Number(examForm.class_id));
    const classSubjects = subjects.filter(s => s.class_level === selectedClass?.name);
    if (classSubjects.length === 0) {
      showError('Selected class has no subjects. Please add subjects first.');
      return;
    }

    try {
      const payload = {
        title: examForm.title,
        description: examForm.description,
        class_id: Number(examForm.class_id),
        subject_id: Number(examForm.subject_id),
        duration_minutes: examForm.duration_minutes,
        instructions: examForm.instructions,
      };

      if (editingExam) {
        await api.put(`/exams/${editingExam.id}`, payload);
        showSuccess('Exam updated successfully');
      } else {
        await api.post('/exams', payload);
        showSuccess('Exam created successfully');
      }
      setShowExamModal(false);
      resetForm();
      loadExams();
    } catch (error: any) {
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors && typeof validationErrors === 'object') {
        const firstKey = Object.keys(validationErrors)[0];
        const firstMessage = firstKey ? validationErrors[firstKey]?.[0] : null;
        showError(firstMessage || error?.response?.data?.message || 'Failed to save exam');
        return;
      }

      showError(error?.response?.data?.message || 'Failed to save exam');
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadInitialData = async () => {
      await Promise.all([loadExams(), loadClasses(), loadAssessmentMode()]);
    };

    loadInitialData();

    const delayedRefresh = window.setTimeout(() => {
      if (!isActive) return;
      loadInitialData();
    }, 1500);

    return () => {
      isActive = false;
      window.clearTimeout(delayedRefresh);
    };
  }, []);

  useEffect(() => {
    if (examForm.class_id) {
      const selectedClass = classes.find(c => c.id === Number(examForm.class_id));
      if (selectedClass) {
        loadSubjects(selectedClass.name);
        setExamForm(prev => ({ ...prev, subject_id: '' }));
      }
    } else {
      setSubjects([]);
    }
  }, [examForm.class_id, classes]);

  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onRefresh: loadExams,
  });

  const filtered = exams.filter((exam) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = (
      exam.title.toLowerCase().includes(term) ||
      (exam.subject?.name || '').toLowerCase().includes(term) ||
      (exam.school_class?.name || '').toLowerCase().includes(term)
    );
    const matchesClassLevel = classLevelFilter ? exam.school_class?.name === classLevelFilter : true;
    return matchesSearch && matchesClassLevel;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'start-recent': {
        const ad = new Date(a.start_datetime || a.start_time || 0).getTime();
        const bd = new Date(b.start_datetime || b.start_time || 0).getTime();
        return bd - ad;
      }
      case 'start-oldest': {
        const ad = new Date(a.start_datetime || a.start_time || 0).getTime();
        const bd = new Date(b.start_datetime || b.start_time || 0).getTime();
        return ad - bd;
      }
      case 'title-asc':
      default:
        return a.title.localeCompare(b.title);
    }
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);
  const modeMeta = (() => {
    if (assessmentMode === 'ca_test') {
      return {
        badge: 'CA TEST WINDOW',
        text: 'All attempts started now are recorded as CA Test until this mode changes.',
        classes: 'border-amber-200 bg-amber-50 text-amber-900',
      };
    }
    if (assessmentMode === 'exam') {
      return {
        badge: 'FINAL EXAM WINDOW',
        text: 'All attempts started now are recorded as Final Exam until this mode changes.',
        classes: 'border-blue-200 bg-blue-50 text-blue-900',
      };
    }
    return {
      badge: 'AUTO WINDOW',
      text: 'System mode is Auto. Attempt mode falls back to per-exam configuration.',
      classes: 'border-slate-200 bg-slate-50 text-slate-900',
    };
  })();

  const getPageNumbers = (current: number, total: number) => {
    const pages: (number | string)[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      } else if (current >= total - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      }
    }
    return pages;
  };

  const handleView = async (id: number) => {
    try {
      setViewLoading(true);
      const response = await api.get(`/exams/${id}`);
      setViewingExam(response.data);
      // fetch assigned questions via dedicated endpoint
      await loadExamQuestions(id);
      await loadExamSittings(id);
      setShowViewModal(true);
    } catch (error) {
      showError('Failed to load exam details');
    } finally {
      setViewLoading(false);
      setExamQuestionsLoading(false);
    }
  };

  const loadExamSittings = async (examId: number) => {
    try {
      setSittingsLoading(true);
      const response = await api.get(`/exams/${examId}/sittings`);
      const sittings = response.data?.sittings || response.data?.data || [];
      setExamSittings(Array.isArray(sittings) ? sittings : []);
      return Array.isArray(sittings) ? sittings : [];
    } catch (error: any) {
      if (error?.response?.status !== 503) {
        showError(error?.response?.data?.message || 'Failed to load exam sittings');
      }
      setExamSittings([]);
      return [];
    } finally {
      setSittingsLoading(false);
    }
  };

  const createExamSitting = async (mode: 'ca_test' | 'exam') => {
    if (!viewingExam?.id) return;

    const payload = {
      assessment_mode_snapshot: mode,
      duration_minutes: Number(viewingExam.duration_minutes || 60),
      start_at: viewingExam.start_datetime || viewingExam.start_time || null,
      end_at: viewingExam.end_datetime || viewingExam.end_time || null,
      status: 'scheduled',
      term: viewingExam.term || null,
      session: viewingExam.academic_session || null,
    };

    try {
      await api.post(`/exams/${viewingExam.id}/sittings`, payload);
      showSuccess(mode === 'ca_test' ? 'CA sitting created' : 'Exam sitting created');
      await loadExamSittings(viewingExam.id);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to create exam sitting');
    }
  };
  const handleEdit = (exam: ExamRow) => {
    if (exam.status === 'completed' || exam.status === 'cancelled') {
      showError('Cannot edit closed or cancelled exams');
      return;
    }
    handleOpenEditModal(exam);
  };

  // ------- Exam ↔ Question helpers -------
  const loadExamQuestions = async (examId: number) => {
    try {
      setExamQuestionsLoading(true);
      const res = await api.get(`/exams/${examId}/questions/assigned`);
      const items = (res.data || []).map((x: any) => ({
        ...x,
        bank_question: x.bank_question || x.bankQuestion || x.bank_question_id ? x.bank_question : undefined,
      }));
      setExamQuestions(items);
      return items;
    } catch (e) {
      // ignore errors but keep UI responsive
      return [];
    } finally {
      setExamQuestionsLoading(false);
    }
  };

  const openManageQuestions = async () => {
    setShowManageQuestions(true);
    setSelectedBankQIds([]);
    manageExamIdRef.current = (viewingExam?.id ?? null);
    manageSubjectIdRef.current = (viewingExam?.subject?.id || (viewingExam as any)?.subject_id) ?? null;
    await loadBankQuestions('');
  };

  const openManageForExam = async (exam: ExamRow) => {
    setViewingExam(exam);
    setShowViewModal(false);
    setSelectedBankQIds([]);
    setShowManageQuestions(true);
    manageExamIdRef.current = exam.id;
    const subjId = (exam as any)?.subject?.id ?? (exam as any)?.subject_id ?? null;
    manageSubjectIdRef.current = subjId;
    const assigned = await loadExamQuestions(exam.id);
    await loadBankQuestions('', subjId ?? undefined, exam.id, assigned);
  };

  useEffect(() => {
    const questionExamId = Number(searchParams.get('questionExamId') || 0);
    if (!questionExamId || exams.length === 0) return;
    if (handledQuestionExamIdRef.current === questionExamId) return;

    const exam = exams.find((row) => row.id === questionExamId);
    if (!exam) return;

    handledQuestionExamIdRef.current = questionExamId;
    openManageForExam(exam);

    const next = new URLSearchParams(searchParams);
    next.delete('questionExamId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams, searchParams, setSearchParams]);

  const loadBankQuestions = async (
    search: string,
    subjectIdOverride?: number,
    examIdOverride?: number,
    assignedRowsOverride?: any[]
  ) => {
    try {
      setBankQLoading(true);
      const params: any = { per_page: 50, status: 'Active' };
      const examId = examIdOverride ?? manageExamIdRef.current ?? (viewingExam?.id ?? null);
      if (examId) params.exclude_exam_id = examId;
      const subjectId = subjectIdOverride ?? manageSubjectIdRef.current ?? (viewingExam?.subject?.id || (viewingExam as any)?.subject_id);
      if (subjectId) params.subject_id = subjectId;
      if (search) params.q = search;
      let res = await api.get('/bank/questions', { params });
      let items = res.data?.data || res.data || [];

      // If strict subject filter returns nothing, retry without subject filter
      // so admins can still pick cross-subject questions when needed.
      if (subjectId && items.length === 0) {
        const fallbackParams: any = { per_page: 50, status: 'Active' };
        if (examId) fallbackParams.exclude_exam_id = examId;
        if (search) fallbackParams.q = search;
        res = await api.get('/bank/questions', { params: fallbackParams });
        items = res.data?.data || res.data || [];
      }
      
      // Filter out questions already added to the exam
      const assignedRows = assignedRowsOverride ?? examQuestions;
      const addedQuestionIds = new Set(
        (assignedRows || [])
          .map((eq: any) => Number(eq.bank_question_id))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      );
      items = items.filter((q: any) => {
        const isActive = String(q.status || '').toLowerCase() === 'active';
        return isActive && !addedQuestionIds.has(Number(q.id));
      });
      
      setBankQuestions(items);
    } catch (e) {
      setBankQuestions([]);
      showError('Failed to load bank questions');
    } finally {
      setBankQLoading(false);
    }
  };

  // basic debounce for search
  const debounceFetchBank = (text: string) => {
    if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current);
    searchDebounceTimerRef.current = setTimeout(() => loadBankQuestions(text), 400);
  };

  const toggleSelectAllBank = (checked: boolean) => {
    if (checked) {
      setSelectedBankQIds(
        bankQuestions
          .filter((q) => String(q.status || '').toLowerCase() === 'active')
          .map((q) => q.id)
      );
    } else {
      setSelectedBankQIds([]);
    }
  };
  const toggleSelectBank = (id: number, checked: boolean) => {
    const row = bankQuestions.find((q) => q.id === id);
    if (checked && String(row?.status || '').toLowerCase() !== 'active') return;
    setSelectedBankQIds((prev) => checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
  };

  const addSelectedToExam = async () => {
    if (!viewingExam) return;
    try {
      const activeQuestionIds = new Set(
        bankQuestions
          .filter((q) => String(q.status || '').toLowerCase() === 'active')
          .map((q) => q.id)
      );
      const items = selectedBankQIds
        .filter((id) => activeQuestionIds.has(id))
        .map((id) => ({ bank_question_id: id }));
      if (items.length === 0) {
        showError('Only Active questions can be added to an exam');
        return;
      }
      const res = await api.post(`/exams/${viewingExam.id}/questions`, { items });
      const warnings = res.data?.warnings || [];
      const created = res.data?.items || [];
      const skipped = res.data?.skipped || [];
      if (created.length > 0) {
        showSuccess(`Questions added (${created.length})`);
      } else if (skipped.length > 0) {
        showError('Selected questions were already added to this exam');
      } else {
        showError('No questions were added');
      }
      if (warnings.length) {
        const msg = warnings.map((w: any) => `#${w.id}: ${w.status}`).join(', ');
        showError(`Added with warnings: ${msg}`);
      }
      setShowManageQuestions(false);
      await loadExamQuestions(viewingExam.id);
    } catch (e: any) {
      const archived = e.response?.data?.errors?.archived;
      const subjectMismatch = e.response?.data?.errors?.subject_mismatch;
      const classMismatch = e.response?.data?.errors?.class_mismatch;
      if (archived && Array.isArray(archived)) {
        showError(`Cannot add archived question(s): ${archived.join(', ')}`);
      } else if (subjectMismatch && Array.isArray(subjectMismatch)) {
        showError(`Subject mismatch question(s): ${subjectMismatch.join(', ')}. Only questions for '${viewingExam.subject?.name}' are allowed.`);
      } else if (classMismatch && Array.isArray(classMismatch)) {
        showError(`Class mismatch question(s): ${classMismatch.join(', ')}. Only questions for the exam class are allowed.`);
      } else {
        showError(e.response?.data?.message || 'Failed to add questions');
      }
    }
  };

  const moveQuestion = async (eqId: number, delta: number) => {
    const list = [...examQuestions];
    const idx = list.findIndex(x => x.id === eqId);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    // swap order_index in UI
    const a = list[idx];
    const b = list[target];
    const tmp = a.order_index; a.order_index = b.order_index; b.order_index = tmp;
    list[idx] = b; list[target] = a;
    setExamQuestions(list);
    try {
      await api.post(`/exams/${viewingExam.id}/questions/reorder`, {
        items: list.map((x, i) => ({ id: x.id, order_index: i + 1 }))
      });
    } catch (e) { /* ignore */ }
  };

  const handleLocalMarksChange = (eqId: number, value: number) => {
    setExamQuestions((prev) => prev.map(q => q.id === eqId ? { ...q, marks_override: value } : q));
  };

  const saveMarksOverride = async (eqId: number, value: number) => {
    try {
      await api.patch(`/exams/${viewingExam.id}/questions/${eqId}`, { marks_override: value });
      showSuccess('Marks updated');
    } catch (e) { /* ignore */ }
  };

  const removeExamQuestion = async (eqId: number) => {
    if (!viewingExam) return;
    try {
      await api.delete(`/exams/${viewingExam.id}/questions/${eqId}`);
      setExamQuestions((prev) => prev.filter(q => q.id !== eqId));
    } catch (e) {
      showError('Failed to remove question');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="app-shell section-shell py-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Exam Management
          </h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">Create and manage exams</p>
        </div>

        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${modeMeta.classes}`}>
          <p className="font-semibold tracking-wide">{modeMeta.badge}</p>
          <p className="mt-1">{modeMeta.text}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-600">
            {exams.length} total exams
          </div>
          <button
            onClick={() => navigate('/admin/exams/sittings')}
            className="px-3 py-2 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
            title="Open dedicated Assessment Sittings workspace"
          >
            Open Sittings Workspace
          </button>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <div 
            onClick={handleOpenCreateModal}
            className="w-full border-2 border-dashed border-purple-500 rounded-lg p-8 text-center cursor-pointer hover:border-purple-600 hover:bg-purple-50 transition-all duration-200"
          >
            <div className="flex justify-center mb-3">
              <div className="text-4xl text-purple-500">
                <i className='bx bx-edit'></i>
              </div>
            </div>
            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">Manual Entry</h3>
            <p className="text-xs text-gray-600">Add exams one by one</p>
          </div>
        </div>

        {/* List Section */}
        <div className="border border-gray-200 rounded-lg">
          <div className="bg-white p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Your Exams</h3>
                <p className="text-xs text-gray-600">{sorted.length} matching exams</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <i className='bx bx-search absolute left-2 top-1/2 -translate-y-1/2 text-gray-400'></i>
                  <input
                    ref={searchInputRef}
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    placeholder="Search exams..."
                    className="pl-7 pr-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 w-48"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value as any); setPage(1); }}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                  title="Sort"
                >
                  <option value="title-asc">Name A→Z</option>
                  <option value="title-desc">Name Z→A</option>
                  <option value="start-recent">Start: Recent</option>
                  <option value="start-oldest">Start: Oldest</option>
                </select>
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={15}>15 per page</option>
                  <option value={25}>25 per page</option>
                </select>
              </div>
            </div>

            {/* Selection Bar */}
            {sorted.length > 0 && (
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={paged.length > 0 && paged.every((exam) => selectedExams.includes(exam.id))}
                      onChange={handleSelectAllExams}
                      className="w-5 h-5 cursor-pointer"
                      title="Select current page exams"
                    />
                    <span className="text-sm font-semibold text-blue-800">
                      {selectedExams.length > 0 ? `${selectedExams.length} selected` : 'Select Page'}
                    </span>
                  </div>
                  {selectedExams.length > 0 && (
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      <button
                        onClick={handleExportExams}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                      >
                        <i className='bx bx-download text-sm'></i>Export
                      </button>
                      <button
                        onClick={handleBulkDeleteExams}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                      >
                        <i className='bx bx-trash text-sm'></i>Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
              <div className="text-sm text-gray-700 font-medium">Exams</div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-gray-600">Class Level:</span>
                  <select
                    value={classLevelFilter}
                    onChange={(e) => { setClassLevelFilter(e.target.value); setPage(1); }}
                    className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                  >
                    <option value="">All</option>
                    {Array.from(new Set(classes.map(c => c.name))).map((level) => (
                      <option key={`levelfilter-${level}`} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClassLevelFilter('');
                    setSearchTerm('');
                    setSortBy('title-asc');
                    setPage(1);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs border-collapse bg-white">
              <thead>
                <tr className="sticky top-0 z-10 bg-gray-50 text-gray-700 border-b">
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={paged.length > 0 && paged.every((exam) => selectedExams.includes(exam.id))}
                      onChange={handleSelectAllExams}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Exam Title</th>
                  <th className="px-3 py-2 text-left font-semibold">Class Level</th>
                  <th className="px-3 py-2 text-left font-semibold">Subject</th>
                  <th className="px-3 py-2 text-left font-semibold">Default Duration</th>
                  <th className="px-3 py-2 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                      <td colSpan={6} className="p-3"><SkeletonTable rows={6} cols={6} /></td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500 text-sm">No exams found.</td>
                  </tr>
                ) : (
                  paged.map((exam, index) => {
                    return (
                      <tr key={exam.id} className={`border-b border-gray-200 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} ${selectedExams.includes(exam.id) ? 'bg-blue-50' : 'hover:bg-blue-50/60'}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedExams.includes(exam.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExams((prev) => (prev.includes(exam.id) ? prev : [...prev, exam.id]));
                              } else {
                                setSelectedExams((prev) => prev.filter((id) => id !== exam.id));
                              }
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 max-w-[240px]">
                          <span className="truncate block" title={exam.title}>{exam.title}</span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-800">{exam.school_class?.name || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-800">{exam.subject?.name || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-800">{exam.duration_minutes} mins</td>
                        <td className="px-3 py-2 text-xs text-gray-800">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleView(exam.id)}
                              className="p-2 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-all duration-200"
                              title="View template details"
                            >
                              <i className='bx bx-show text-base'></i>
                            </button>
                            <button
                              onClick={() => navigate(`/admin/exams/sittings?examId=${exam.id}`)}
                              className="p-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all duration-200"
                              title="Manage sittings"
                            >
                              <i className='bx bx-calendar-check text-base'></i>
                            </button>
                            <button
                              onClick={() => handleEdit(exam)}
                              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200"
                              title="Edit template"
                            >
                              <i className='bx bx-edit text-base'></i>
                            </button>
                            <button
                              onClick={() => handleDeleteExam(exam)}
                              className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200"
                              title="Delete exam"
                            >
                              <i className='bx bx-trash text-base'></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50/60 border-t border-gray-200 p-4">
            {sorted.length > 0 && (
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="text-gray-600">
                  Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, sorted.length)} of {sorted.length}
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
            )}
          </div>
        </div>

        {/* Exam Modal */}
        {showExamModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingExam ? 'Edit Exam' : 'Create New Exam'}
                </h3>
                <button
                  onClick={() => {
                    setShowExamModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  <i className='bx bx-x'></i>
                </button>
              </div>

              {/* Info Note */}
              <div className="px-6 pt-4">
                {editingExam && (editingExam.published || editingExam.status === 'completed' || editingExam.status === 'cancelled') && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      <i className='bx bx-info-circle mr-1'></i>
                      <strong>Note:</strong> {editingExam.status === 'completed' || editingExam.status === 'cancelled' 
                        ? 'This exam is closed and cannot be edited.' 
                        : 'This exam is published. Only limited fields can be modified.'}
                    </p>
                  </div>
                )}
                {!editingExam && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <i className='bx bx-info-circle mr-1'></i>
                      <strong>Tip:</strong> Select a class first, then choose a subject from that class. Exams require at least one subject.
                    </p>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmitExam} className="px-6 pb-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Exam Title *
                  </label>
                  <input
                    type="text"
                    value={examForm.title}
                    onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="e.g., Midterm Mathematics Exam"
                    required
                    disabled={editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={examForm.description}
                    onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={2}
                    placeholder="Optional description or notes"
                    disabled={editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Class Level *
                    </label>
                    <select
                      value={examForm.class_id}
                      onChange={(e) => setExamForm({ ...examForm, class_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      required
                      disabled={editingExam?.published || editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
                    >
                      <option value="">Select class level</option>
                      {uniqueClassLevels.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Choose the class level</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Subject *
                    </label>
                    <select
                      value={examForm.subject_id}
                      onChange={(e) => setExamForm({ ...examForm, subject_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      required
                      disabled={!examForm.class_id || subjects.length === 0 || editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
                    >
                      <option value="">Select subject</option>
                      {subjects.map(subj => (
                        <option key={subj.id} value={subj.id}>{subj.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {!examForm.class_id ? 'Select a class first' : subjects.length === 0 ? 'No subjects for this class' : 'Select subject for exam'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Default Duration (minutes) *
                  </label>
                  <input
                    type="number"
                    value={examForm.duration_minutes}
                    onChange={(e) => setExamForm({ ...examForm, duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    min="1"
                    required
                    disabled={editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
                  />
                  <p className="text-xs text-gray-500 mt-1">Used as the default duration for new sittings. Scheduling is handled in Assessment Sittings.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Instructions
                  </label>
                  <textarea
                    value={examForm.instructions}
                    onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    rows={3}
                    placeholder="Optional instructions for students"
                    disabled={editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExamModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:shadow-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={editingExam?.status === 'completed' || editingExam?.status === 'cancelled' || !examForm.class_id || subjects.length === 0}
                  >
                    {editingExam ? 'Update Exam' : 'Create Exam'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* PHASE 8: Delete Confirmation Modal */}
      {showDeleteModal && examToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <i className='bx bx-error text-2xl text-red-600'></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Exam</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 mb-2">
                <strong>Warning:</strong> You are about to delete:
              </p>
              <p className="font-semibold text-gray-900">{examToDelete.title}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type the exam title to confirm deletion:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={examToDelete.title}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Type exactly: <code className="bg-gray-100 px-1 py-0.5 rounded">{examToDelete.title}</code>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setExamToDelete(null);
                  setDeleteConfirmation('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation !== examToDelete.title}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Detail View Modal - READ ONLY INFORMATION DISPLAY */}
      {showViewModal && viewingExam && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header with gradient and exam title */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 rounded-lg p-3 backdrop-blur">
                  <i className='bx bx-book-open text-3xl'></i>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{viewingExam.title}</h2>
                  <p className="text-blue-100 text-sm mt-1">{viewingExam.subject?.name || '-'} | {viewingExam.school_class?.name || '-'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingExam(null);
                  setExamSittings([]);
                }}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <i className='bx bx-x text-3xl'></i>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-8 space-y-6">
              {viewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin">
                    <i className='bx bx-loader-circle text-4xl text-blue-600'></i>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status Section */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <i className='bx bx-shield text-blue-600'></i>Exam Status & Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Current Status</p>
                        <div className={`px-3 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2 ${
                          viewingExam.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                          viewingExam.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          viewingExam.status === 'active' ? 'bg-green-100 text-green-700' :
                          viewingExam.status === 'completed' ? 'bg-purple-100 text-purple-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          <i className={`bx ${
                            viewingExam.status === 'draft' ? 'bx-pencil' :
                            viewingExam.status === 'scheduled' ? 'bx-calendar' :
                            viewingExam.status === 'active' ? 'bx-play-circle' :
                            viewingExam.status === 'completed' ? 'bx-check-circle' :
                            'bx-x-circle'
                          }`}></i>
                          {viewingExam.status.charAt(0).toUpperCase() + viewingExam.status.slice(1)}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Published Status</p>
                        <p className="text-sm font-bold text-gray-900">{viewingExam.published ? '✓ Published' : '✗ Not Published'}</p>
                        <p className="text-xs text-gray-500 mt-1">{viewingExam.published ? 'Visible to students' : 'Hidden from students'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-blue-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Results Visibility</p>
                        <p className="text-sm font-bold text-gray-900">{viewingExam.results_released ? 'Released' : '✗ Hidden'}</p>
                        <p className="text-xs text-gray-500 mt-1">{viewingExam.results_released ? 'Visible to students' : 'Hidden from students'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Assessment Information */}
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <i className='bx bx-trophy text-orange-600'></i>Assessment Structure
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-orange-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Assessment Type</p>
                        {viewingExam.assessment_type ? (
                          <div className={`px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${
                            viewingExam.assessment_type === 'CA Test' ? 'bg-blue-100 text-blue-700' :
                            viewingExam.assessment_type === 'Midterm Test' ? 'bg-purple-100 text-purple-700' :
                            viewingExam.assessment_type === 'Final Exam' ? 'bg-red-100 text-red-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            <i className='bx bx-clipboard'></i>
                            {viewingExam.assessment_type}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">Not specified</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">Type of assessment for result calculation</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-orange-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Assessment Weight</p>
                        {viewingExam.assessment_weight ? (
                          <>
                            <p className="text-3xl font-bold text-orange-600">{viewingExam.assessment_weight}%</p>
                            <p className="text-xs text-gray-500 mt-1">Weight in final grade calculation</p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-400">Not specified</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Schedule & Duration */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <i className='bx bx-calendar text-purple-600'></i>Schedule & Duration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Duration</p>
                        <p className="text-2xl font-bold text-purple-600">{viewingExam.duration_minutes}</p>
                        <p className="text-xs text-gray-500 mt-1">minutes</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Start Date & Time</p>
                        <p className="text-sm font-bold text-gray-900">{formatDate(viewingExam.start_datetime || viewingExam.start_time)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">End Date & Time</p>
                        <p className="text-sm font-bold text-gray-900">{formatDate(viewingExam.end_datetime || viewingExam.end_time)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <i className='bx bx-book text-green-600'></i>Academic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-green-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Class Level</p>
                        <p className="text-sm font-bold text-gray-900">{viewingExam.school_class?.name || '-'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-green-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Subject</p>
                        <p className="text-sm font-bold text-gray-900">{viewingExam.subject?.name || '-'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-green-100">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Allowed Attempts</p>
                        <p className="text-sm font-bold text-gray-900">{viewingExam.allowed_attempts || '1'}</p>
                        <p className="text-xs text-gray-500 mt-1">per student</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {viewingExam.description && (
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <i className='bx bx-file-blank text-gray-600'></i>Description
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed">{viewingExam.description}</p>
                    </div>
                  )}

                  {/* Question Rules - What IS Allowed */}
                  <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-xl p-6 border border-green-300 border-2">
                    <h3 className="text-lg font-bold text-green-800 mb-4 flex items-center gap-2">
                      <i className='bx bx-check-circle text-green-600'></i>What IS Allowed
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Shuffle Questions */}
                      <div className={`rounded-lg p-4 border-l-4 flex items-start gap-3 ${
                        viewingExam.shuffle_questions 
                          ? 'bg-green-100 border-l-green-500' 
                          : 'bg-gray-100 border-l-gray-400'
                      }`}>
                        <div className="flex-shrink-0 mt-1">
                          {viewingExam.shuffle_questions ? (
                            <i className='bx bx-check-circle text-2xl text-green-600'></i>
                          ) : (
                            <i className='bx bx-x-circle text-2xl text-gray-400'></i>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">Questions are {viewingExam.shuffle_questions ? 'SHUFFLED' : 'NOT shuffled'}</p>
                          <p className="text-xs text-gray-700 mt-1">
                            {viewingExam.shuffle_questions 
                              ? '✓ Questions appear in random order for each student'
                              : '✗ Questions appear in the same order for all students'
                            }
                          </p>
                        </div>
                      </div>

                      {/* Randomize Options */}
                      <div className={`rounded-lg p-4 border-l-4 flex items-start gap-3 ${
                        viewingExam.randomize_options 
                          ? 'bg-green-100 border-l-green-500' 
                          : 'bg-gray-100 border-l-gray-400'
                      }`}>
                        <div className="flex-shrink-0 mt-1">
                          {viewingExam.randomize_options ? (
                            <i className='bx bx-check-circle text-2xl text-green-600'></i>
                          ) : (
                            <i className='bx bx-x-circle text-2xl text-gray-400'></i>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">Options are {viewingExam.randomize_options ? 'RANDOMIZED' : 'NOT randomized'}</p>
                          <p className="text-xs text-gray-700 mt-1">
                            {viewingExam.randomize_options 
                              ? '✓ Answer options appear in different positions for each student'
                              : '✗ Answer options appear in the same position for all students'
                            }
                          </p>
                        </div>
                      </div>

                      {/* Navigation Mode */}
                      <div className="bg-green-100 border-l-4 border-l-green-500 rounded-lg p-4 flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <i className='bx bx-check-circle text-2xl text-green-600'></i>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">Navigation Mode: {viewingExam.navigation_mode || 'Free'}</p>
                          <p className="text-xs text-gray-700 mt-1">
                            {viewingExam.navigation_mode === 'linear' 
                              ? '✓ Students must answer questions in order (cannot skip back)'
                              : '✓ Students can navigate freely between all questions'
                            }
                          </p>
                        </div>
                      </div>

                      {/* Seat Numbering */}
                      {viewingExam.seat_numbering && (
                        <div className="bg-green-100 border-l-4 border-l-green-500 rounded-lg p-4 flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            <i className='bx bx-check-circle text-2xl text-green-600'></i>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">Seat Numbering: {viewingExam.seat_numbering}</p>
                            <p className="text-xs text-gray-700 mt-1">
                              {viewingExam.seat_numbering === 'row_major'
                                ? '✓ Seating assigned row by row'
                                : '✓ Seating assigned column by column'
                              }
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Questions Information */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm font-semibold">Total Questions in Exam</p>
                        <p className="text-5xl font-bold mt-2">{examQuestions.length}</p>
                        <p className="text-blue-200 text-sm mt-2">questions ready for students</p>
                      </div>
                      <div className="text-7xl opacity-20">
                        <i className='bx bx-help-circle'></i>
                      </div>
                    </div>
                  </div>

                  {/* Sitting / Instance Layer */}
                  <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <i className='bx bx-calendar-check text-indigo-600'></i>
                          Assessment Sittings (Instances)
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">Each CA/Test or Exam event should use a separate sitting.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => createExamSitting('ca_test')}
                          className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600"
                          disabled={viewingExam.status === 'completed' || viewingExam.status === 'cancelled'}
                        >
                          Create CA Sitting
                        </button>
                        <button
                          onClick={() => createExamSitting('exam')}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                          disabled={viewingExam.status === 'completed' || viewingExam.status === 'cancelled'}
                        >
                          Create Exam Sitting
                        </button>
                      </div>
                    </div>

                    {sittingsLoading ? (
                      <div className="text-sm text-gray-500 py-3">Loading sittings...</div>
                    ) : examSittings.length === 0 ? (
                      <div className="text-sm text-gray-500 py-3">No sittings found. Create one to schedule this assessment instance.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">ID</th>
                              <th className="py-2 pr-3">Mode</th>
                              <th className="py-2 pr-3">Duration</th>
                              <th className="py-2 pr-3">Window</th>
                              <th className="py-2 pr-3">Status</th>
                              <th className="py-2 pr-3">Session/Term</th>
                            </tr>
                          </thead>
                          <tbody>
                            {examSittings.map((sitting) => (
                              <tr key={sitting.id} className="border-b last:border-0">
                                <td className="py-2 pr-3 font-semibold text-gray-700">#{sitting.id}</td>
                                <td className="py-2 pr-3">
                                  <span className={`px-2 py-1 rounded text-[11px] font-semibold ${sitting.assessment_mode_snapshot === 'ca_test' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {sitting.assessment_mode_snapshot === 'ca_test' ? 'CA Test' : 'Exam'}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-gray-700">{sitting.duration_minutes || '-'} mins</td>
                                <td className="py-2 pr-3 text-gray-700">
                                  {formatDate(sitting.start_at || undefined)} - {formatDate(sitting.end_at || undefined)}
                                </td>
                                <td className="py-2 pr-3">
                                  <span className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                                    {sitting.status}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-gray-700">{(sitting.session || '-') + ' / ' + (sitting.term || '-')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Questions Tab (simple list) */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <i className='bx bx-list-ul text-blue-600'></i>
                        Questions
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openManageQuestions()}
                          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:shadow-md"
                          disabled={viewingExam.status === 'completed' || viewingExam.status === 'cancelled'}
                        >
                          <i className='bx bx-plus mr-1'></i>Add Questions
                        </button>
                      </div>
                    </div>
                    {examQuestionsLoading ? (
                      <div className="py-6 text-center text-gray-500">Loading questions…</div>
                    ) : examQuestions.length === 0 ? (
                      <div className="py-6 text-center text-gray-500">No questions assigned yet</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">#</th>
                              <th className="py-2 pr-3">Question</th>
                              <th className="py-2 pr-3">Type</th>
                              <th className="py-2 pr-3">Difficulty</th>
                              <th className="py-2 pr-3">Version</th>
                              <th className="py-2 pr-3">Exam Marks (Override)</th>
                              <th className="py-2 pr-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {examQuestions.map((eq, idx) => (
                              <tr key={eq.id} className="border-b last:border-0">
                                <td className="py-2 pr-3 text-gray-700">{eq.order_index}</td>
                                <td className="py-2 pr-3 max-w-[320px] truncate" title={eq.bank_question?.question_text || ''}>
                                  {eq.bank_question?.question_text || '-'}
                                </td>
                                <td className="py-2 pr-3">{eq.bank_question?.question_type || '-'}</td>
                                <td className="py-2 pr-3">{eq.bank_question?.difficulty || '-'}</td>
                                <td className="py-2 pr-3">v{eq.version_number || 1}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      className="w-20 px-2 py-1 border rounded"
                                      value={eq.marks_override ?? eq.bank_question?.marks ?? 0}
                                      min={0}
                                      onChange={(e) => handleLocalMarksChange(eq.id, Number(e.target.value))}
                                      onBlur={(e) => saveMarksOverride(eq.id, Number(e.target.value))}
                                    />
                                    <span className="text-[11px] text-gray-500 whitespace-nowrap">
                                      bank: {eq.bank_question?.marks ?? 0}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-2">
                                    <button className="px-2 py-1 rounded bg-gray-100" onClick={() => moveQuestion(eq.id, -1)} title="Move up">
                                      <i className='bx bx-up-arrow-alt'></i>
                                    </button>
                                    <button className="px-2 py-1 rounded bg-gray-100" onClick={() => moveQuestion(eq.id, 1)} title="Move down">
                                      <i className='bx bx-down-arrow-alt'></i>
                                    </button>
                                    <button className="px-2 py-1 rounded bg-red-50 text-red-600" onClick={() => removeExamQuestion(eq.id)} title="Remove">
                                      <i className='bx bx-trash'></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Key Restrictions - What is NOT Allowed */}
                  <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 rounded-xl p-6 border border-amber-300 border-2">
                    <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                      <i className='bx bx-info-circle text-amber-600'></i>Important Restrictions & Rules
                    </h3>
                    <div className="space-y-3">
                      {/* Attempt restrictions */}
                      <div className="bg-white rounded-lg p-4 border-l-4 border-l-amber-500 flex items-start gap-3">
                        <i className='bx bx-lock text-xl text-amber-600 flex-shrink-0 mt-1'></i>
                        <div>
                          <p className="font-semibold text-gray-800">Attempt Restrictions</p>
                          <p className="text-sm text-gray-700 mt-1">Students are LIMITED to <span className="font-bold text-amber-700">{viewingExam.allowed_attempts || '1'} attempt(s)</span> only. Once used, they cannot retake the exam.</p>
                        </div>
                      </div>

                      {/* Time restriction */}
                      <div className="bg-white rounded-lg p-4 border-l-4 border-l-amber-500 flex items-start gap-3">
                        <i className='bx bx-time text-xl text-amber-600 flex-shrink-0 mt-1'></i>
                        <div>
                          <p className="font-semibold text-gray-800">Time Window</p>
                          <p className="text-sm text-gray-700 mt-1">Exam is available ONLY between <span className="font-bold">{formatDate(viewingExam.start_datetime || viewingExam.start_time)}</span> and <span className="font-bold">{formatDate(viewingExam.end_datetime || viewingExam.end_time)}</span></p>
                        </div>
                      </div>

                      {/* Publication restriction */}
                      <div className="bg-white rounded-lg p-4 border-l-4 border-l-amber-500 flex items-start gap-3">
                        <i className='bx bx-eye text-xl text-amber-600 flex-shrink-0 mt-1'></i>
                        <div>
                          <p className="font-semibold text-gray-800">Visibility Status</p>
                          <p className="text-sm text-gray-700 mt-1">
                            {viewingExam.published 
                              ? '✓ Exam IS visible to students'
                              : '✗ Exam is NOT visible to students (hidden/unpublished)'
                            }
                          </p>
                        </div>
                      </div>

                      {/* Results restriction */}
                      <div className="bg-white rounded-lg p-4 border-l-4 border-l-amber-500 flex items-start gap-3">
                        <i className='bx bx-eye-off text-xl text-amber-600 flex-shrink-0 mt-1'></i>
                        <div>
                          <p className="font-semibold text-gray-800">Results Visibility</p>
                          <p className="text-sm text-gray-700 mt-1">
                            {viewingExam.results_released 
                              ? '✓ Results ARE visible to students'
                              : '✗ Results are NOT visible to students (hidden by admin)'
                            }
                          </p>
                        </div>
                      </div>

                      {/* Navigation restriction */}
                      <div className="bg-white rounded-lg p-4 border-l-4 border-l-amber-500 flex items-start gap-3">
                        <i className='bx bx-navigation text-xl text-amber-600 flex-shrink-0 mt-1'></i>
                        <div>
                          <p className="font-semibold text-gray-800">Navigation Restriction</p>
                          <p className="text-sm text-gray-700 mt-1">
                            {viewingExam.navigation_mode === 'linear'
                              ? '✗ Students CANNOT go back to previous questions (linear mode)'
                              : '✓ Students CAN navigate between all questions freely'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Info Box */}
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
                    <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                      <i className='bx bx-info-circle text-indigo-600'></i>Quick Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600"><strong>Exam Type:</strong> {viewingExam.status.charAt(0).toUpperCase() + viewingExam.status.slice(1)}</p>
                        <p className="text-gray-600 mt-2"><strong>For:</strong> {viewingExam.school_class?.name || '-'} ({viewingExam.subject?.name || '-'})</p>
                      </div>
                      <div>
                        <p className="text-gray-600"><strong>Complexity:</strong> {viewingExam.metadata?.question_count || '0'} questions in {viewingExam.duration_minutes} minutes</p>
                        <p className="text-gray-600 mt-2"><strong>Student Impact:</strong> {viewingExam.shuffle_questions && viewingExam.randomize_options ? 'Questions & options randomized' : 'Standard delivery'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer with close button only */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingExam(null);
                }}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg font-medium text-sm transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Questions Modal */}
      {showManageQuestions && viewingExam && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className='bx bx-plus-circle text-2xl'></i>
                <div>
                  <h3 className="text-xl font-bold">Add Questions to Exam</h3>
                  <p className="text-blue-100 text-xs">Selecting from Question Bank</p>
                </div>
              </div>
              <button className="text-white/90 hover:bg-white/20 rounded p-2" onClick={() => setShowManageQuestions(false)}>
                <i className='bx bx-x text-2xl'></i>
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {/* Selection warnings */}
              {(() => {
                const selectedNonActive = bankQuestions.filter(q => selectedBankQIds.includes(q.id) && q.status !== 'Active');
                if (selectedNonActive.length === 0) return null;
                return (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-xs text-amber-800 font-semibold flex items-center gap-2">
                      <i className='bx bx-error-circle'></i>
                      {selectedNonActive.length} selected question(s) are not Active: {selectedNonActive.map(q=>`#${q.id} (${q.status})`).join(', ')}
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1">They will be added but flagged; consider approving or activating them.</p>
                  </div>
                );
              })()}
              <div className="mb-4 flex items-center gap-2">
                <input
                  placeholder="Search question text…"
                  className="px-3 py-2 border rounded w-full max-w-md"
                  onChange={(e) => debounceFetchBank(e.target.value)}
                />
                <button className="px-3 py-2 border rounded" onClick={() => loadBankQuestions('')}>Refresh</button>
              </div>
              {bankQLoading ? (
                <div className="py-8 text-center text-gray-500">Loading bank questions…</div>
              ) : (
                <div className="overflow-x-auto border rounded">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 bg-gray-50">
                        <th className="p-2"><input type="checkbox" onChange={(e)=>toggleSelectAllBank(e.target.checked)} /></th>
                        <th className="p-2">Question</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Difficulty</th>
                        <th className="p-2">Marks</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankQuestions.map((q) => (
                        <tr key={q.id} className="border-t">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedBankQIds.includes(q.id)}
                              onChange={(e)=> toggleSelectBank(q.id, e.target.checked)}
                              disabled={String(q.status || '').toLowerCase() !== 'active'}
                            />
                          </td>
                          <td className="p-2 max-w-[360px] truncate" title={q.question_text}>{q.question_text}</td>
                          <td className="p-2">{q.question_type}</td>
                          <td className="p-2">{q.difficulty}</td>
                          <td className="p-2">{q.marks}</td>
                          <td className="p-2">
                            {q.status === 'Active' ? (
                              <span className="px-2 py-1 text-[11px] rounded bg-green-100 text-green-700">Active</span>
                            ) : q.status === 'Archived' ? (
                              <span className="px-2 py-1 text-[11px] rounded bg-gray-100 text-gray-600">Archived</span>
                            ) : (
                              <span className="px-2 py-1 text-[11px] rounded bg-amber-100 text-amber-700">{q.status}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-5 border-t bg-gray-50 flex justify-end gap-2">
              <button className="px-4 py-2 border rounded" onClick={()=>setShowManageQuestions(false)}>Cancel</button>
              <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded" disabled={selectedBankQIds.length===0} onClick={addSelectedToExam}>
                <i className='bx bx-upload mr-1'></i> Add Selected ({selectedBankQIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExamManagement;




