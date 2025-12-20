import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, SkeletonTable } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

/*
 * Admin Exam Management (Phase 5 UI)
 * Matches Academic Management style: segmented tabs, action cards,
 * compact filters, and a clean table layout.
 */

type ExamStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';

interface ExamRow {
  id: number;
  title: string;
  status: ExamStatus;
  duration_minutes: number;
  start_datetime?: string;
  end_datetime?: string;
  start_time?: string;
  end_time?: string;
  published: boolean;
  results_released?: boolean;
  subject?: { id: number; name: string } | null;
  school_class?: { id: number; name: string } | null;
  metadata?: { question_count?: number } | null;
}

const formatDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

const ExamManagement: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'start-recent' | 'start-oldest'>('title-asc');
  const [perPage, setPerPage] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [selectedExams, setSelectedExams] = useState<number[]>([]);
  const [classLevelFilter, setClassLevelFilter] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // PHASE 8: Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [examToDelete, setExamToDelete] = useState<ExamRow | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

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
    start_datetime: '',
    end_datetime: '',
    instructions: '',
  });

  const handleDownloadSampleCSV = () => {
    const csvContent = 'title,description,class_id,subject_id,duration_minutes,start_datetime,end_datetime,instructions,status\n' +
                       'Mid-Term Math Exam,Mathematics examination for SSS 1,1,1,90,2025-01-15 09:00:00,2025-01-15 10:30:00,Answer all questions,scheduled\n' +
                       'English Language Test,Comprehension and grammar test,2,2,60,2025-01-20 14:00:00,2025-01-20 15:00:00,No use of dictionaries,draft';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'exams-sample-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    
    try {
      await api.post('/exams/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showSuccess('Exams uploaded successfully');
      setShowUploadModal(false);
      setUploadFile(null);
      loadExams();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };

  const loadExams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/exams');
      const data = response.data?.data || response.data || [];
      setExams(data);
      setSelectedExams([]);
    } catch (error) {
      console.error('Failed to fetch exams', error);
      showError('Unable to load exams');
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAllExams = () => {
    if (selectedExams.length === exams.length) {
      setSelectedExams([]);
    } else {
      setSelectedExams(exams.map(e => e.id));
    }
  };

  const handleExportExams = async () => {
    try {
      const response = await api.get('/exams/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `exams_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('Exams exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      showError('Failed to export exams');
    }
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
      const response = await api.get('/classes?limit=1000');
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
      start_datetime: '',
      end_datetime: '',
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
      start_datetime: exam.start_datetime || exam.start_time || '',
      end_datetime: exam.end_datetime || exam.end_time || '',
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
        start_datetime: examForm.start_datetime || null,
        end_datetime: examForm.end_datetime || null,
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
      showError(error.response?.data?.message || 'Failed to save exam');
    }
  };

  useEffect(() => {
    loadExams();
    loadClasses();
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
  }, [examForm.class_id]);

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
    const isInactive = exam.status === 'completed' || exam.status === 'cancelled';
    const matchesClassLevel = classLevelFilter ? exam.school_class?.name === classLevelFilter : true;
    return matchesSearch && (showInactive ? true : !isInactive) && matchesClassLevel;
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

  const handlePublish = async (exam: ExamRow) => {
    try {
      await api.put(`/exams/${exam.id}`, {
        published: true,
        status: exam.status === 'draft' ? 'scheduled' : exam.status,
        start_datetime: exam.start_datetime || exam.start_time,
        end_datetime: exam.end_datetime || exam.end_time,
      });
      showSuccess('Exam published');
      loadExams();
    } catch (error) {
      showError('Publish failed. Ensure time window and class/subject mapping are valid.');
    }
  };

  const handleUnpublish = async (exam: ExamRow) => {
    try {
      await api.put(`/exams/${exam.id}`, {
        published: false,
        status: exam.status, // Keep current status, just unpublish
        start_datetime: exam.start_datetime || exam.start_time,
        end_datetime: exam.end_datetime || exam.end_time,
      });
      showSuccess('Exam unpublished - now hidden from students');
      loadExams();
    } catch (error) {
      showError('Unpublish failed');
    }
  };

  const handleClose = async (exam: ExamRow) => {
    try {
      await api.put(`/exams/${exam.id}`, {
        status: 'completed',
        published: exam.published,
      });
      showSuccess('Exam closed');
      loadExams();
    } catch (error) {
      showError('Close failed');
    }
  };

    const handleToggleResults = async (exam: ExamRow) => {
      try {
        const newStatus = !exam.results_released;
        await api.post(`/exams/${exam.id}/toggle-results`, {
          results_released: newStatus,
        });
        showSuccess(newStatus ? 'Results released to students' : 'Results hidden from students');
        loadExams();
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to update results visibility');
      }
    };

  const handleView = (id: number) => navigate(`/admin/exams/${id}`);
  const handleEdit = (exam: ExamRow) => {
    if (exam.status === 'completed' || exam.status === 'cancelled') {
      showError('Cannot edit closed or cancelled exams');
      return;
    }
    handleOpenEditModal(exam);
  };

  const renderStatus = (exam: ExamRow) => {
    const color = {
      draft: 'text-gray-600 bg-gray-100',
      scheduled: 'text-blue-700 bg-blue-100',
      active: 'text-green-700 bg-green-100',
      completed: 'text-purple-700 bg-purple-100',
      cancelled: 'text-red-700 bg-red-100',
    }[exam.status] || 'text-gray-600 bg-gray-100';

    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${color}`}>
        {exam.status}
      </span>
    );
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

        {/* Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-600">
            {exams.length} total exams
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExams}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-2"
            >
              <i className='bx bx-download'></i>
              Export CSV
            </button>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div 
            onClick={() => setShowUploadModal(true)}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
          >
            <div className="flex justify-center mb-3">
              <div className="text-4xl text-gray-400">
                <i className='bx bx-file'></i>
              </div>
            </div>
            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">Upload CSV File</h3>
            <p className="text-xs text-gray-600">Bulk upload exams from CSV</p>
          </div>

          <div 
            onClick={handleDownloadSampleCSV}
            className="border-2 border-dashed border-green-500 rounded-lg p-6 text-center cursor-pointer hover:border-green-600 hover:bg-green-50 transition-all duration-200"
          >
            <div className="flex justify-center mb-3">
              <div className="text-4xl text-green-500">
                <i className='bx bx-download'></i>
              </div>
            </div>
            <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">Download Sample CSV</h3>
            <p className="text-xs text-gray-600">Download CSV format template</p>
          </div>

          <div 
            onClick={handleOpenCreateModal}
            className="border-2 border-dashed border-purple-500 rounded-lg p-6 text-center cursor-pointer hover:border-purple-600 hover:bg-purple-50 transition-all duration-200"
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
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={showInactive} onChange={(e) => { setShowInactive(e.target.checked); setPage(1); }} />
                  Show inactive
                </label>
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
            {exams.length > 0 && (
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedExams.length > 0 && selectedExams.length === exams.length}
                      onChange={handleSelectAllExams}
                      className="w-5 h-5 cursor-pointer"
                      title="Select all exams"
                    />
                    <span className="text-sm font-semibold text-blue-800">
                      {selectedExams.length > 0 ? `${selectedExams.length} of ${exams.length} selected` : 'Select All'}
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

          {/* Table Container - only scroll when needed */}
          <div className={paged.length >= 6 ? 'max-h-96 overflow-auto' : ''}>
            <table className="min-w-full text-xs border-collapse bg-white">
              <thead>
                <tr className="bg-gray-50 text-gray-700 border-b">
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedExams.length > 0 && selectedExams.length === exams.length}
                      onChange={handleSelectAllExams}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Exam Title</th>
                  <th className="px-3 py-2 text-left font-semibold">Class Level</th>
                  <th className="px-3 py-2 text-left font-semibold">Subject</th>
                  <th className="px-3 py-2 text-left font-semibold">Duration</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Start DateTime</th>
                  <th className="px-3 py-2 text-left font-semibold">End DateTime</th>
                  <th className="px-3 py-2 text-left font-semibold">Question Count</th>
                    <th className="px-3 py-2 text-left font-semibold">Results Released</th>
                  <th className="px-3 py-2 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                      <td colSpan={11} className="p-3"><SkeletonTable rows={6} cols={11} /></td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                      <td colSpan={11} className="px-3 py-6 text-center text-gray-500 text-sm">No exams found.</td>
                  </tr>
                ) : (
                  paged.map((exam) => {
                    const start = exam.start_datetime || exam.start_time;
                    const end = exam.end_datetime || exam.end_time;
                    const questionCount = exam.metadata?.question_count ?? '—';
                    return (
                      <tr key={exam.id} className={`border-b transition-colors ${selectedExams.includes(exam.id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedExams.includes(exam.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExams([...selectedExams, exam.id]);
                              } else {
                                setSelectedExams(selectedExams.filter(id => id !== exam.id));
                              }
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">{exam.title}</td>
                        <td className="px-3 py-2 text-sm text-gray-800">{exam.school_class?.name || '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-800">{exam.subject?.name || '—'}</td>
                        <td className="px-3 py-2 text-sm text-gray-800">{exam.duration_minutes} mins</td>
                        <td className="px-3 py-2">{renderStatus(exam)}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{formatDate(start)}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{formatDate(end)}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 text-center">{questionCount}</td>
                          <td className="px-3 py-2">
                            {exam.results_released ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-green-700 bg-green-100">
                                ✓ Released
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-gray-600 bg-gray-100">
                                Hidden
                              </span>
                            )}
                          </td>
                        <td className="px-3 py-2 text-xs text-gray-800">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit - Blue */}
                            <button
                              onClick={() => handleEdit(exam)}
                              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200 transform hover:scale-110"
                              title="Edit exam"
                            >
                              <i className='bx bx-edit text-base'></i>
                            </button>

                            {/* Dropdown Menu */}
                            <div className="relative group">
                              <button
                                className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all duration-200 transform hover:scale-110"
                                title="More actions"
                              >
                                <i className='bx bx-dots-vertical-rounded text-base'></i>
                              </button>
                              
                              {/* Dropdown menu - shows on hover */}
                              <div className="absolute right-0 bottom-full mb-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                                {/* View */}
                                <button
                                  onClick={() => handleView(exam.id)}
                                  className="w-full text-left px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                                >
                                  <i className='bx bx-show text-blue-500'></i>
                                  <span className="font-medium">View</span>
                                </button>
                                
                                {/* Publish/Unpublish - Show appropriate button based on published status */}
                                {!exam.published ? (
                                  <button
                                    onClick={() => handlePublish(exam)}
                                    className="w-full text-left px-4 py-3 text-sm text-green-700 hover:bg-green-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                                  >
                                    <i className='bx bx-upload text-green-500'></i>
                                    <span className="font-medium">Publish</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUnpublish(exam)}
                                    className="w-full text-left px-4 py-3 text-sm text-orange-700 hover:bg-orange-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                                  >
                                    <i className='bx bx-download text-orange-500'></i>
                                    <span className="font-medium">Unpublish</span>
                                  </button>
                                )}
                                
                                {/* Close */}
                                <button
                                  onClick={() => handleClose(exam)}
                                  className="w-full text-left px-4 py-3 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                                >
                                  <i className='bx bx-lock text-amber-500'></i>
                                  <span className="font-medium">Close</span>
                                </button>
                                
                                {/* Release/Hide Results */}
                                <button
                                  onClick={() => handleToggleResults(exam)}
                                  className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 border-b border-gray-100 transition-colors ${
                                    exam.results_released
                                      ? 'text-red-700 hover:bg-red-50'
                                      : 'text-green-700 hover:bg-green-50'
                                  }`}
                                >
                                  <i className={`bx text-base ${exam.results_released ? 'bx-hide text-red-500' : 'bx-show text-green-500'}`}></i>
                                  <span className="font-medium">{exam.results_released ? 'Hide Results' : 'Release Results'}</span>
                                </button>
                                
                                {/* Add Questions */}
                                <button
                                  onClick={() => navigate(`/admin/questions?examId=${exam.id}`)}
                                  className="w-full text-left px-4 py-3 text-sm text-purple-700 hover:bg-purple-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                                >
                                  <i className='bx bx-plus text-purple-500'></i>
                                  <span className="font-medium">Add Questions</span>
                                </button>
                                
                                {/* View Results */}
                                <button
                                  onClick={() => navigate(`/admin/results?examId=${exam.id}`)}
                                  className="w-full text-left px-4 py-3 text-sm text-cyan-700 hover:bg-cyan-50 flex items-center gap-3 transition-colors"
                                >
                                  <i className='bx bx-bar-chart-alt-2 text-cyan-500'></i>
                                  <span className="font-medium">View Results</span>
                                </button>
                              </div>
                            </div>

                            {/* Delete - Red */}
                            <button
                              onClick={() => handleDeleteExam(exam)}
                              className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200 transform hover:scale-110"
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
          <div className="bg-white border-t border-gray-200 p-4">
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs">
                <div className="text-gray-600">
                  Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, sorted.length)} of {sorted.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <i className='bx bx-chevron-left'></i>
                  </button>
                  {getPageNumbers(currentPage, totalPages).map((pageNum, idx) => (
                    pageNum === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum as number)}
                        className={`px-3 py-1 border rounded-md text-xs ${
                          pageNum === currentPage
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  ))}
                  <button
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <i className='bx bx-chevron-right'></i>
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
                      {classes.map(cls => (
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
                    Duration (minutes) *
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
                  <p className="text-xs text-gray-500 mt-1">How long students have to complete the exam</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Start Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={examForm.start_datetime}
                      onChange={(e) => setExamForm({ ...examForm, start_datetime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={examForm.end_datetime}
                      onChange={(e) => setExamForm({ ...examForm, end_datetime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
                    />
                  </div>
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
        {/* Bulk Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-800">
                  Bulk Upload Exams
                </h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="px-6 py-6 space-y-5 overflow-y-auto flex-1">
                <div>
                  <p className="text-sm text-gray-700 mb-3 font-medium">
                    Upload a CSV file with the following columns:
                  </p>
                  <ul className="text-xs text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-1.5">
                    <li>• <strong>title</strong> (required)</li>
                    <li>• <strong>description</strong> (optional)</li>
                    <li>• <strong>class_id</strong> (required): ID of the class</li>
                    <li>• <strong>subject_id</strong> (required): ID of the subject</li>
                    <li>• <strong>duration_minutes</strong> (required): Duration in minutes</li>
                    <li>• <strong>start_datetime</strong> (required): Format: YYYY-MM-DD HH:MM:SS</li>
                    <li>• <strong>end_datetime</strong> (required): Format: YYYY-MM-DD HH:MM:SS</li>
                    <li>• <strong>instructions</strong> (optional)</li>
                    <li>• <strong>status</strong> (optional): draft/scheduled/active/completed/cancelled</li>
                  </ul>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-all bg-gray-50 hover:bg-blue-50">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload-exams"
                  />
                  <label htmlFor="csv-upload-exams" className="cursor-pointer block">
                    <div className="flex justify-center mb-3">
                      <i className='bx bx-cloud-upload text-6xl text-gray-400'></i>
                    </div>
                    <p className="text-base font-semibold text-gray-800 mb-1">
                      {uploadFile ? uploadFile.name : 'Click to upload CSV'}
                    </p>
                    <p className="text-sm text-gray-500">or drag and drop</p>
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                    }}
                    className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkUpload}
                    disabled={!uploadFile || uploading}
                    className="flex-1 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:shadow-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <i className='bx bx-loader-alt bx-spin text-lg'></i>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i className='bx bx-upload text-lg'></i>
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
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
    </div>
  );
};

export default ExamManagement;

