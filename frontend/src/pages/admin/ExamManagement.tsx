import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, SkeletonTable } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'exams' | 'results'>('exams');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'start-recent' | 'start-oldest'>('title-asc');
  const [perPage, setPerPage] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

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

  const loadExams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/exams');
      const data = response.data?.data || response.data || [];
      setExams(data);
    } catch (error) {
      console.error('Failed to fetch exams', error);
      showError('Unable to load exams');
      setExams([]);
    } finally {
      setLoading(false);
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
    return matchesSearch && (showInactive ? true : !isInactive);
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
          <p className="text-xs md:text-sm text-gray-600 mt-1">Manage exams, schedules, and results</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md p-1.5 mb-3">
          <div className="flex gap-1.5">
            {(['overview', 'exams', 'results'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 px-3 rounded-md font-medium transition-all duration-200 text-xs md:text-sm ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <i className={`bx ${
                  tab === 'overview' ? 'bx-chart' : tab === 'exams' ? 'bx-edit' : 'bx-bar-chart-alt-2'
                } mr-1 text-sm md:text-base`}></i>
                <span className="hidden md:inline">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-600">
            {exams.length} total exams
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-2">
              <i className='bx bx-download'></i>
              Export CSV
            </button>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div 
            onClick={() => showSuccess('CSV upload coming soon')}
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
            onClick={() => showSuccess('Sample CSV downloaded')}
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
        <Card>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
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

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-700 border-b">
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
                      <td colSpan={10} className="p-3"><SkeletonTable rows={6} cols={10} /></td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-gray-500 text-sm">No exams found.</td>
                  </tr>
                ) : (
                  paged.map((exam) => {
                    const start = exam.start_datetime || exam.start_time;
                    const end = exam.end_datetime || exam.end_time;
                    const questionCount = exam.metadata?.question_count ?? '—';
                    return (
                      <tr key={exam.id} className="border-b hover:bg-gray-50">
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
                              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 overflow-hidden">
                                {/* View */}
                                <button
                                  onClick={() => handleView(exam.id)}
                                  className="w-full text-left px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                                >
                                  <i className='bx bx-show text-blue-500'></i>
                                  <span className="font-medium">View</span>
                                </button>
                                
                                {/* Publish */}
                                <button
                                  onClick={() => handlePublish(exam)}
                                  className="w-full text-left px-4 py-3 text-sm text-green-700 hover:bg-green-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                                >
                                  <i className='bx bx-upload text-green-500'></i>
                                  <span className="font-medium">Publish</span>
                                </button>
                                
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
                                  onClick={() => navigate(`/admin/exams/${exam.id}/questions`)}
                                  className="w-full text-left px-4 py-3 text-sm text-purple-700 hover:bg-purple-50 flex items-center gap-3 border-b border-gray-100 transition-colors"
                                >
                                  <i className='bx bx-plus text-purple-500'></i>
                                  <span className="font-medium">Add Questions</span>
                                </button>
                                
                                {/* View Results */}
                                <button
                                  onClick={() => navigate(`/admin/exams/${exam.id}/results`)}
                                  className="w-full text-left px-4 py-3 text-sm text-cyan-700 hover:bg-cyan-50 flex items-center gap-3 transition-colors"
                                >
                                  <i className='bx bx-bar-chart-alt-2 text-cyan-500'></i>
                                  <span className="font-medium">View Results</span>
                                </button>
                              </div>
                            </div>

                            {/* Delete - Red */}
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this exam?')) {
                                  api.delete(`/exams/${exam.id}`).then(() => {
                                    showSuccess('Exam deleted');
                                    loadExams();
                                  }).catch(err => showError(err.response?.data?.message || 'Delete failed'));
                                }
                              }}
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
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-gray-600">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(1)}>First</Button>
              <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Prev</Button>
              <Button size="sm" variant="secondary" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
              <Button size="sm" variant="secondary" disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)}>Last</Button>
            </div>
          </div>
        </Card>

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
                      disabled={!examForm.class_id || subjects.length === 0 || editingExam?.published || editingExam?.status === 'completed' || editingExam?.status === 'cancelled'}
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
      </div>
    </div>
  );
};

export default ExamManagement;

