import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, SkeletonCard, SkeletonTable } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { QuestionFilters } from '../../components/QuestionFilters';
import { BulkActionToolbar } from '../../components/BulkActionToolbar';
import { QuestionTable } from '../../components/QuestionTable';
import { SectionGroup } from '../../components/SectionGroup';

interface Exam {
  id: number;
  title: string;
  class_id: number;
  subject_id: number;
  school_class?: { id: number; name: string };
  subject?: { id: number; name: string };
  status: string;
}

interface Question {
  id: number;
  exam_id?: number;
  question_text: string;
  question_type: string;
  marks: number;
  difficulty?: string;
  status?: string;
  section_name?: string;
  order_index?: number;
  exam?: Exam;
}

interface FilterOptions {
  questionType?: string;
  difficulty?: string;
  status?: string;
  section?: string;
}

const QuestionBank: React.FC<{}> = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examIdFromUrl = searchParams.get('examId');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<number | null>(
    examIdFromUrl ? parseInt(examIdFromUrl) : null
  );
  const [questions, setQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [groupBySection, setGroupBySection] = useState(true);
  const [form, setForm] = useState({
    exam_id: 0,
    question_text: '',
    question_type: 'multiple_choice_single',
    marks: 1,
    max_words: 100,
    marking_rubric: '',
    // Multiple choice options
    options: [
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
    ],
    // Fill in the blank
    blank_answers: [''],
    // Matching pairs
    matching_pairs: [
      { left: '', right: '' },
      { left: '', right: '' },
    ],
    // Ordering/Sequencing
    ordering_items: ['', ''],
    // Media attachments
    image_url: '',
    audio_url: '',
    // Passage/Comprehension
    passage_text: '',
    sub_questions: [],
    // Case study
    case_study_text: '',
    // Formula/Calculation
    formula: '',
    correct_answer: '',
    // Practical/Scenario
    scenario_text: '',
    // PHASE 7: Organization & Metadata
    pool_name: '',
    topics: [],
    author_notes: '',
    cognitive_level: '',
    estimated_time: null,
    is_template: false,
    is_archived: false,
  });

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      loadQuestions();
      // Auto-open modal if exam was selected from URL
      if (examIdFromUrl && !showCreateModal) {
        setTimeout(() => openCreate(), 500);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExam]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/exams');
      const examData = response.data.data || response.data || [];
      // PHASE 8: Filter out closed/completed exams from question management
      const openExams = examData.filter((exam: Exam) => 
        exam.status !== 'completed' && exam.status !== 'cancelled'
      );
      setExams(openExams);
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    if (!selectedExam) return;
    
    try {
      const response = await api.get(`/exams/${selectedExam}/questions`);
      let questionData: any[] = [];
      if (Array.isArray(response.data)) {
        questionData = response.data;
      } else if (Array.isArray(response.data?.data)) {
        questionData = response.data.data;
      } else if (Array.isArray(response.data?.questions)) {
        questionData = response.data.questions;
      } else {
        console.warn('Unexpected questions response shape:', response.data);
      }
      setQuestions(questionData);
    } catch (error: any) {
      console.error('Failed to fetch questions:', error);
      setQuestions([]);
    }
  };

  const getSelectedExamInfo = () => {
    return exams.find(e => e.id === selectedExam);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this question?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/questions/${id}`);
        showSuccess('Question deleted successfully');
        loadQuestions();
        setSelectedIds(new Set(Array.from(selectedIds).filter(sid => sid !== id)));
      } catch (error) {
        showError('Failed to delete question');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      showError('Please select questions to delete');
      return;
    }

    const confirmed = await showDeleteConfirm(`Delete ${selectedIds.size} question(s)?`);
    if (confirmed.isConfirmed) {
      try {
        setBulkLoading(true);
        await api.post('/questions/bulk-delete', {
          question_ids: Array.from(selectedIds),
        });
        showSuccess(`${selectedIds.size} question(s) deleted successfully`);
        setSelectedIds(new Set());
        loadQuestions();
      } catch (error) {
        showError('Failed to delete questions');
      } finally {
        setBulkLoading(false);
      }
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.size === 0) {
      showError('Please select questions to update');
      return;
    }

    try {
      setBulkLoading(true);
      await api.post('/questions/bulk-status', {
        question_ids: Array.from(selectedIds),
        status: status,
      });
      showSuccess(`${selectedIds.size} question(s) updated successfully`);
      setSelectedIds(new Set());
      loadQuestions();
    } catch (error) {
      showError('Failed to update questions');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      setBulkPreviewLoading(true);
      const response = await api.post(`/questions/${id}/duplicate`);
      showSuccess('Question duplicated successfully');
      loadQuestions();
    } catch (error) {
      showError('Failed to duplicate question');
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      setBulkPreviewLoading(true);
      await api.patch(`/questions/${id}/toggle-status`);
      showSuccess('Question status updated');
      loadQuestions();
    } catch (error) {
      showError('Failed to update question status');
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handlePreview = async (id: number) => {
    try {
      const response = await api.get(`/questions/${id}/preview`);
      // Show preview in a modal or navigate
      showSuccess('Preview: ' + JSON.stringify(response.data).substring(0, 100));
    } catch (error) {
      showError('Failed to load preview');
    }
  };

  const handleSelectChange = (id: number, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const openCreate = () => {
    if (!selectedExam) {
      showError('Please select an exam first');
      return;
    }
    
    setEditing(null);
    setForm({ 
      exam_id: selectedExam,
      question_text: '', 
      question_type: 'multiple_choice_single', 
      marks: 1, 
      max_words: 100,
      marking_rubric: '',
      options: [
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
      ],
      blank_answers: [''],
      matching_pairs: [
        { left: '', right: '' },
        { left: '', right: '' },
      ],
      ordering_items: ['', ''],
      image_url: '',
      audio_url: '',
      passage_text: '',
      sub_questions: [],
      case_study_text: '',
      formula: '',
      correct_answer: '',
      scenario_text: '',
      // PHASE 7: Organization & Metadata
      pool_name: '',
      topics: [],
      author_notes: '',
      cognitive_level: '',
      estimated_time: null,
      is_template: false,
      is_archived: false,
    });
    setShowCreateModal(true);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onNew: openCreate,
    onEscape: () => setShowCreateModal(false),
    onRefresh: loadQuestions,
  });

  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({
      exam_id: q.exam_id || selectedExam || 0,
      question_text: q.question_text,
      question_type: q.question_type,
      marks: q.marks,
      max_words: (q as any).max_words || 100,
      marking_rubric: (q as any).marking_rubric || '',
      // Multiple choice options
      options: (q as any).options || [
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
      ],
      // Fill in the blank
      blank_answers: (q as any).blank_answers || [''],
      // Matching pairs
      matching_pairs: (q as any).matching_pairs || [
        { left: '', right: '' },
        { left: '', right: '' },
      ],
      // Ordering/Sequencing
      ordering_items: (q as any).ordering_items || ['', ''],
      // Media attachments
      image_url: (q as any).image_url || '',
      audio_url: (q as any).audio_url || '',
      // Passage/Comprehension
      passage_text: (q as any).passage_text || '',
      sub_questions: (q as any).sub_questions || [],
      // Case study
      case_study_text: (q as any).case_study_text || '',
      // Formula/Calculation
      formula: (q as any).formula || '',
      correct_answer: (q as any).correct_answer || '',
      // Practical/Scenario
      scenario_text: (q as any).scenario_text || '',
      // PHASE 7: Organization & Metadata
      pool_name: (q as any).pool_name || '',
      topics: (q as any).topics || [],
      author_notes: (q as any).author_notes || '',
      cognitive_level: (q as any).cognitive_level || '',
      estimated_time: (q as any).estimated_time || null,
      is_template: (q as any).is_template || false,
      is_archived: (q as any).is_archived || false,
    });
    setShowCreateModal(true);
  };

  const saveQuestion = async () => {
    if (!selectedExam) {
      showError('Please select an exam first');
      return;
    }

    // Validate required fields
    if (!form.question_text || form.question_text.trim().length < 10) {
      showError('Question text must be at least 10 characters');
      return;
    }

    if (!form.question_type) {
      showError('Please select a question type');
      return;
    }

    if (!form.marks || form.marks <= 0) {
      showError('Marks must be greater than 0');
      return;
    }

    // Validate by question type
    if (['short_answer', 'essay'].includes(form.question_type)) {
      if (!form.max_words || form.max_words < 10) {
        showError('Max words is required and must be at least 10');
        return;
      }
    }

    if (form.question_type === 'true_false') {
      if (!form.correct_answer) {
        showError('Please select True or False as the correct answer');
        return;
      }
    }

    if (['multiple_choice_single', 'multiple_choice_multiple'].includes(form.question_type)) {
      if (form.options.length < 2) {
        showError('Multiple choice questions must have at least 2 options');
        return;
      }
      if (form.options.some(o => !o.option_text?.trim())) {
        showError('All options must have text');
        return;
      }
      const correctCount = form.options.filter(o => o.is_correct).length;
      if (correctCount === 0) {
        showError('At least one option must be marked as correct');
        return;
      }
    }

    if (form.question_type === 'matching') {
      if (form.matching_pairs.length < 2) {
        showError('Matching questions must have at least 2 pairs');
        return;
      }
      if (form.matching_pairs.some(p => !p.left?.trim() || !p.right?.trim())) {
        showError('All matching pairs must be complete');
        return;
      }
    }

    if (form.question_type === 'fill_blank') {
      if (!form.question_text.includes('_____')) {
        showError('Fill-in-the-blank questions must contain blanks (_____)');
        return;
      }
      const blankCount = (form.question_text.match(/_____/g) || []).length;
      if (form.blank_answers.length !== blankCount) {
        showError(`Number of blanks (${blankCount}) must match number of answers (${form.blank_answers.length})`);
        return;
      }
    }

    if (form.question_type === 'image_based' && !form.image_url?.trim()) {
      showError('Image URL is required for image-based questions');
      return;
    }

    if (form.question_type === 'audio_based' && !form.audio_url?.trim()) {
      showError('Audio URL is required for audio-based questions');
      return;
    }

    if (form.question_type === 'passage' && !form.passage_text?.trim()) {
      showError('Passage text is required for passage-based questions');
      return;
    }

    if (form.question_type === 'case_study' && !form.case_study_text?.trim()) {
      showError('Case study text is required for case study questions');
      return;
    }

    if (form.question_type === 'calculation' && !form.correct_answer?.trim()) {
      showError('Correct answer is required for calculation questions');
      return;
    }

    if (form.question_type === 'practical' && !form.scenario_text?.trim()) {
      showError('Scenario description is required for practical questions');
      return;
    }

    if (form.question_type === 'ordering') {
      if (form.ordering_items.length < 2) {
        showError('Ordering questions must have at least 2 items');
        return;
      }
      if (form.ordering_items.some(i => !i?.trim())) {
        showError('All ordering items must have text');
        return;
      }
    }

    try {
      const payload = { ...form, exam_id: selectedExam } as any;
      
      // Define which fields are needed for each question type
      const typeSpecificFields: { [key: string]: string[] } = {
        'multiple_choice_single': ['options'],
        'multiple_choice_multiple': ['options'],
        'true_false': ['correct_answer'],
        'short_answer': ['max_words', 'marking_rubric'],
        'essay': ['max_words', 'marking_rubric'],
        'fill_blank': ['blank_answers'],
        'matching': ['matching_pairs'],
        'ordering': ['ordering_items'],
        'image_based': ['image_url'],
        'audio_based': ['audio_url'],
        'passage': ['passage_text'],
        'case_study': ['case_study_text'],
        'calculation': ['formula', 'correct_answer'],
        'practical': ['scenario_text'],
      };

      // Remove fields that don't apply to this question type
      const allowedFields = ['exam_id', 'question_text', 'question_type', 'marks', 'difficulty_level', 'subject_id', 'pool_name', 'topics', 'author_notes', 'cognitive_level', 'estimated_time', 'is_template', 'is_archived', 'section_name', 'order_index'];
      const typeFields = typeSpecificFields[form.question_type] || [];
      const fieldsToKeep = new Set([...allowedFields, ...typeFields]);

      Object.keys(payload).forEach(key => {
        // Remove if not in allowed fields for this type
        if (!fieldsToKeep.has(key)) {
          delete payload[key];
        }
        // Remove null/undefined values
        else if (payload[key] === null || payload[key] === undefined) {
          delete payload[key];
        }
        // Remove empty arrays
        else if (Array.isArray(payload[key]) && payload[key].length === 0) {
          delete payload[key];
        }
        // Remove empty strings from optional fields
        else if (typeof payload[key] === 'string' && payload[key].trim() === '') {
          if (['pool_name', 'author_notes', 'formula', 'image_url', 'audio_url', 
                'passage_text', 'case_study_text', 'marking_rubric', 'scenario_text', 'section_name'].includes(key)) {
            delete payload[key];
          }
        }
      });
      
      console.log('=== QUESTION CREATE REQUEST ===');
      console.log('Question Type:', form.question_type);
      console.log('Sending to: POST /questions');
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      if (editing) {
        const response = await api.put(`/questions/${editing.id}`, payload);
        console.log('Update response:', response);
        showSuccess('Question updated');
      } else {
        const response = await api.post('/questions', payload);
        console.log('Create response:', response);
        showSuccess('Question created');
      }
      setShowCreateModal(false);
      loadQuestions();
    } catch (error: any) {
      console.error('=== QUESTION CREATE ERROR ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Full error:', error);
      console.error('Error config:', error?.config);
      console.error('Error response status:', error?.response?.status);
      console.error('Error response data:', error?.response?.data);
      console.error('Error message:', error.message);
      console.error('Error code:', error?.code);
      
      let errorMessage = 'Failed to save question';
      
      // Check for network errors
      if (!error.response) {
        console.error('No response - network/CORS issue');
        if (error.code === 'ERR_NETWORK') {
          errorMessage = 'Network Error: Unable to reach server at http://localhost:8000/api';
        } else if (error.message === 'Network Error') {
          errorMessage = 'Network Error: Cannot connect to server. Make sure the backend is running on http://127.0.0.1:8000';
        } else if (error.message?.includes('CORS')) {
          errorMessage = `CORS Error: ${error.message}`;
        } else {
          errorMessage = `Connection Error: ${error.message}`;
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        // Handle Laravel validation errors
        const errors = error.response.data.errors;
        if (typeof errors === 'object') {
          const firstErrorKey = Object.keys(errors)[0];
          if (Array.isArray(errors[firstErrorKey])) {
            errorMessage = errors[firstErrorKey][0];
          } else {
            errorMessage = errors[firstErrorKey];
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error('Final error message:', errorMessage);
      showError(errorMessage);
    }
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = 'question_text,question_type,marks,max_words,marking_rubric,option_1,option_2,option_3,option_4,correct_option\\n' +
                       'What is 2+2?,multiple_choice,2,0,,4,3,5,6,1\\n' +
                       'Explain photosynthesis,essay,10,200,Clarity of explanation,,,,,';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'questions-sample-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async () => {
    if (!selectedExam) {
      showError('Please select an exam first');
      return;
    }

    try {
      const response = await api.get(`/exams/${selectedExam}/questions/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `exam-${selectedExam}-questions.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('Questions exported successfully');
    } catch (error) {
      showError('Failed to export questions');
    }
  };

  const filtered = useMemo(() => {
    let result = questions.filter(q =>
      q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply filters
    if (filters.questionType && filters.questionType !== '') {
      result = result.filter(q => q.question_type === filters.questionType);
    }
    if (filters.difficulty && filters.difficulty !== '') {
      result = result.filter(q => q.difficulty === filters.difficulty);
    }
    if (filters.status && filters.status !== '') {
      result = result.filter(q => q.status === filters.status);
    }
    if (filters.section && filters.section !== '') {
      result = result.filter(q => q.section_name === filters.section);
    }

    return result;
  }, [questions, searchTerm, filters]);

  // Group by section
  const groupedBySection = useMemo(() => {
    const groups: { [key: string]: { name: string; questions: Question[]; totalMarks: number; questionCount: number } } = {};

    filtered.forEach(q => {
      const sectionName = q.section_name || 'General';
      if (!groups[sectionName]) {
        groups[sectionName] = {
          name: sectionName,
          questions: [],
          totalMarks: 0,
          questionCount: 0,
        };
      }
      groups[sectionName].questions.push(q);
      groups[sectionName].totalMarks += q.marks || 0;
      groups[sectionName].questionCount += 1;
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="app-shell section-shell py-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Question Management
          </h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">Create and manage exam questions</p>
        </div>

        {/* Exam Selector */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <label className="text-sm font-medium text-gray-700 min-w-fit">Select Exam:</label>
            <select
              value={selectedExam || ''}
              onChange={(e) => setSelectedExam(Number(e.target.value))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Choose an Exam --</option>
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.school_class?.name || 'N/A'} - {exam.subject?.name || 'N/A'})
                </option>
              ))}
            </select>
            {selectedExam && (
              <button
                onClick={handleExport}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium text-xs transition-colors flex items-center gap-2"
              >
                <i className='bx bx-download'></i>
                Export CSV
              </button>
            )}
          </div>
          {selectedExam && getSelectedExamInfo() && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Class:</span>
                  <span className="ml-2 font-semibold text-gray-800">{getSelectedExamInfo()?.school_class?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Subject:</span>
                  <span className="ml-2 font-semibold text-gray-800">{getSelectedExamInfo()?.subject?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className="ml-2 font-semibold text-gray-800">{getSelectedExamInfo()?.status || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Questions:</span>
                  <span className="ml-2 font-semibold text-gray-800">{questions.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {!selectedExam ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-6xl text-gray-300 mb-4">
              <i className='bx bx-help-circle'></i>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Exam Selected</h3>
            <p className="text-gray-600 mb-4">Please select an exam to view and manage its questions</p>
            <button
              onClick={() => navigate('/admin/exams')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              Go to Exams
            </button>
          </div>
        ) : (
          <>
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
                <p className="text-xs text-gray-600">Bulk upload questions from CSV</p>
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
                onClick={openCreate}
                className="border-2 border-dashed border-purple-500 rounded-lg p-6 text-center cursor-pointer hover:border-purple-600 hover:bg-purple-50 transition-all duration-200"
              >
                <div className="flex justify-center mb-3">
                  <div className="text-4xl text-purple-500">
                    <i className='bx bx-edit'></i>
                  </div>
                </div>
                <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">Manual Entry</h3>
                <p className="text-xs text-gray-600">Add questions one by one</p>
              </div>
            </div>

            {/* Questions List with Filters and Bulk Actions */}
            <div className="bg-white rounded-lg shadow-sm">
              {/* Header with search and view options */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Questions</h3>
                    <p className="text-xs text-gray-600">{filtered.length} questions</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGroupBySection(!groupBySection)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2 ${
                        groupBySection
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <i className={`bx bx-${groupBySection ? 'folder-open' : 'list'}`}></i>
                      {groupBySection ? 'By Section' : 'All'}
                    </button>
                    <div className="relative">
                      <i className='bx bx-search absolute left-2 top-1/2 -translate-y-1/2 text-gray-400'></i>
                      <input
                        ref={searchInputRef}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search questions..."
                        className="pl-7 pr-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 w-48"
                      />
                    </div>
                  </div>
                </div>

                {/* Filters Component */}
                <QuestionFilters onFilterChange={handleFilterChange} />
              </div>

              {/* Questions Table or Section Groups */}
              <div className="p-4">
                {loading ? (
                  <SkeletonTable rows={5} cols={8} />
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8">
                    <i className='bx bx-inbox text-4xl text-gray-300'></i>
                    <p className="text-gray-500 text-sm mt-2">No questions match your filters</p>
                  </div>
                ) : groupBySection ? (
                  // Grouped by Section
                  <div className="space-y-4">
                    {groupedBySection.map((section) => (
                      <SectionGroup
                        key={section.name}
                        section={section}
                        selectedIds={selectedIds}
                        onSelectChange={handleSelectChange}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onToggleStatus={handleToggleStatus}
                        onPreview={handlePreview}
                      />
                    ))}
                  </div>
                ) : (
                  // All questions in a table
                  <QuestionTable
                    questions={filtered}
                    selectedIds={selectedIds}
                    onSelectChange={handleSelectChange}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onToggleStatus={handleToggleStatus}
                    onPreview={handlePreview}
                    isLoading={loading}
                  />
                )}
              </div>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedIds.size > 0 && (
              <BulkActionToolbar
                selectedCount={selectedIds.size}
                onBulkDelete={handleBulkDelete}
                onBulkStatusUpdate={handleBulkStatusUpdate}
                onClearSelection={handleClearSelection}
                isLoading={bulkLoading}
              />
            )}
          </>
        )}

      {/* Create/Edit Modal */}
      <div className={`fixed inset-0 ${showCreateModal ? 'flex' : 'hidden'} items-center justify-center z-50 bg-black bg-opacity-50`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-lg font-semibold">{editing ? 'Edit Question' : 'Create Question'}</h3>
            <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowCreateModal(false)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium">Question Text</label>
              <textarea className="mt-1 w-full border rounded px-3 py-2" rows={4} value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} aria-label="Question text" placeholder="Enter question text" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Type</label>
                <select className="mt-1 w-full border rounded px-3 py-2 text-sm" value={form.question_type} onChange={e => setForm({ ...form, question_type: e.target.value })} aria-label="Question type">
                  <optgroup label="Choice-Based">
                    <option value="multiple_choice_single">Multiple Choice (Single Answer)</option>
                    <option value="multiple_choice_multiple">Multiple Choice (Multiple Answers)</option>
                    <option value="true_false">True / False</option>
                  </optgroup>
                  <optgroup label="Text-Based">
                    <option value="short_answer">Short Answer</option>
                    <option value="essay">Long Answer / Essay</option>
                    <option value="fill_blank">Fill in the Blank</option>
                  </optgroup>
                  <optgroup label="Interactive">
                    <option value="matching">Matching / Pairing</option>
                    <option value="ordering">Ordering / Sequencing</option>
                  </optgroup>
                  <optgroup label="Media-Based">
                    <option value="image_based">Image-based Question</option>
                    <option value="audio_based">Audio-based Question</option>
                  </optgroup>
                  <optgroup label="Complex">
                    <option value="passage">Passage / Comprehension</option>
                    <option value="case_study">Case Study</option>
                    <option value="calculation">Calculation / Formula</option>
                    <option value="practical">Practical / Scenario</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Marks</label>
                <input type="number" min={1} className="mt-1 w-full border rounded px-3 py-2" value={form.marks} onChange={e => setForm({ ...form, marks: Number(e.target.value) })} aria-label="Question marks" placeholder="Marks" />
              </div>
            </div>
            
            {/* Multiple Choice (Single Answer) */}
            {form.question_type === 'multiple_choice_single' && (
              <div>
                <label className="block text-sm font-medium mb-2">Options (Select ONE correct answer)</label>
                {form.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input 
                      type="text" 
                      className="flex-1 border rounded px-3 py-2 text-sm" 
                      value={option.option_text} 
                      onChange={e => {
                        const newOptions = [...form.options];
                        newOptions[idx].option_text = e.target.value;
                        setForm({ ...form, options: newOptions });
                      }}
                      placeholder={`Option ${idx + 1}`}
                    />
                    <label className="flex items-center gap-1">
                      <input 
                        type="radio" 
                        name="correct_option"
                        checked={option.is_correct}
                        onChange={() => {
                          const newOptions = form.options.map((opt, i) => ({
                            ...opt,
                            is_correct: i === idx
                          }));
                          setForm({ ...form, options: newOptions });
                        }}
                      />
                      <span className="text-sm">Correct</span>
                    </label>
                    {form.options.length > 2 && (
                      <button 
                        onClick={() => setForm({ ...form, options: form.options.filter((_, i) => i !== idx) })}
                        className="text-red-600 hover:text-red-800"
                      >
                        <i className='bx bx-trash'></i>
                      </button>
                    )}
                  </div>
                ))}
                {form.options.length < 6 && (
                  <button 
                    onClick={() => setForm({ ...form, options: [...form.options, { option_text: '', is_correct: false }] })}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <i className='bx bx-plus'></i> Add Option
                  </button>
                )}
              </div>
            )}
            
            {/* Multiple Choice (Multiple Answers) */}
            {form.question_type === 'multiple_choice_multiple' && (
              <div>
                <label className="block text-sm font-medium mb-2">Options (Select MULTIPLE correct answers)</label>
                {form.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input 
                      type="text" 
                      className="flex-1 border rounded px-3 py-2 text-sm" 
                      value={option.option_text} 
                      onChange={e => {
                        const newOptions = [...form.options];
                        newOptions[idx].option_text = e.target.value;
                        setForm({ ...form, options: newOptions });
                      }}
                      placeholder={`Option ${idx + 1}`}
                    />
                    <label className="flex items-center gap-1">
                      <input 
                        type="checkbox" 
                        checked={option.is_correct}
                        onChange={e => {
                          const newOptions = [...form.options];
                          newOptions[idx].is_correct = e.target.checked;
                          setForm({ ...form, options: newOptions });
                        }}
                      />
                      <span className="text-sm">Correct</span>
                    </label>
                    {form.options.length > 2 && (
                      <button 
                        onClick={() => setForm({ ...form, options: form.options.filter((_, i) => i !== idx) })}
                        className="text-red-600 hover:text-red-800"
                      >
                        <i className='bx bx-trash'></i>
                      </button>
                    )}
                  </div>
                ))}
                {form.options.length < 6 && (
                  <button 
                    onClick={() => setForm({ ...form, options: [...form.options, { option_text: '', is_correct: false }] })}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <i className='bx bx-plus'></i> Add Option
                  </button>
                )}
              </div>
            )}

            {/* True/False */}
            {form.question_type === 'true_false' && (
              <div>
                <label className="block text-sm font-medium mb-2">Correct Answer</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="true_false_answer"
                      value="true"
                      checked={form.correct_answer === 'true'}
                      onChange={e => setForm({ ...form, correct_answer: e.target.value })}
                    />
                    <span>True</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="true_false_answer"
                      value="false"
                      checked={form.correct_answer === 'false'}
                      onChange={e => setForm({ ...form, correct_answer: e.target.value })}
                    />
                    <span>False</span>
                  </label>
                </div>
              </div>
            )}

            {/* Short Answer */}
            {form.question_type === 'short_answer' && (
              <div>
                <label className="block text-sm font-medium">Maximum Words</label>
                <input 
                  type="number" 
                  min={1} 
                  max={200}
                  className="mt-1 w-full border rounded px-3 py-2" 
                  value={form.max_words} 
                  onChange={e => setForm({ ...form, max_words: Number(e.target.value) })} 
                  placeholder="e.g., 50-100 words" 
                />
              </div>
            )}

            {/* Long Answer / Essay */}
            {form.question_type === 'essay' && (
              <>
                <div>
                  <label className="block text-sm font-medium">Maximum Words</label>
                  <input 
                    type="number" 
                    min={100} 
                    className="mt-1 w-full border rounded px-3 py-2" 
                    value={form.max_words} 
                    onChange={e => setForm({ ...form, max_words: Number(e.target.value) })} 
                    placeholder="e.g., 200-500 words" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Marking Rubric (Optional)</label>
                  <textarea 
                    className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                    rows={3} 
                    value={form.marking_rubric} 
                    onChange={e => setForm({ ...form, marking_rubric: e.target.value })} 
                    placeholder="e.g., Introduction: 2 marks, Body: 5 marks, Conclusion: 3 marks" 
                  />
                </div>
              </>
            )}

            {/* Fill in the Blank */}
            {form.question_type === 'fill_blank' && (
              <div>
                <label className="block text-sm font-medium mb-2">Correct Answers (one per blank)</label>
                <p className="text-xs text-gray-600 mb-2">Use _____ in your question text to indicate blanks</p>
                {form.blank_answers.map((answer, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input 
                      type="text" 
                      className="flex-1 border rounded px-3 py-2 text-sm" 
                      value={answer} 
                      onChange={e => {
                        const newAnswers = [...form.blank_answers];
                        newAnswers[idx] = e.target.value;
                        setForm({ ...form, blank_answers: newAnswers });
                      }}
                      placeholder={`Answer for blank ${idx + 1}`}
                    />
                    {form.blank_answers.length > 1 && (
                      <button 
                        onClick={() => setForm({ ...form, blank_answers: form.blank_answers.filter((_, i) => i !== idx) })}
                        className="text-red-600 hover:text-red-800"
                      >
                        <i className='bx bx-trash'></i>
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => setForm({ ...form, blank_answers: [...form.blank_answers, ''] })}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <i className='bx bx-plus'></i> Add Another Blank
                </button>
              </div>
            )}

            {/* Matching / Pairing */}
            {form.question_type === 'matching' && (
              <div>
                <label className="block text-sm font-medium mb-2">Matching Pairs</label>
                {form.matching_pairs.map((pair, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2 mb-2">
                    <input 
                      type="text" 
                      className="border rounded px-3 py-2 text-sm" 
                      value={pair.left} 
                      onChange={e => {
                        const newPairs = [...form.matching_pairs];
                        newPairs[idx].left = e.target.value;
                        setForm({ ...form, matching_pairs: newPairs });
                      }}
                      placeholder={`Left item ${idx + 1}`}
                    />
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        className="flex-1 border rounded px-3 py-2 text-sm" 
                        value={pair.right} 
                        onChange={e => {
                          const newPairs = [...form.matching_pairs];
                          newPairs[idx].right = e.target.value;
                          setForm({ ...form, matching_pairs: newPairs });
                        }}
                        placeholder={`Right item ${idx + 1}`}
                      />
                      {form.matching_pairs.length > 2 && (
                        <button 
                          onClick={() => setForm({ ...form, matching_pairs: form.matching_pairs.filter((_, i) => i !== idx) })}
                          className="text-red-600 hover:text-red-800"
                        >
                          <i className='bx bx-trash'></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => setForm({ ...form, matching_pairs: [...form.matching_pairs, { left: '', right: '' }] })}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <i className='bx bx-plus'></i> Add Pair
                </button>
              </div>
            )}

            {/* Ordering / Sequencing */}
            {form.question_type === 'ordering' && (
              <div>
                <label className="block text-sm font-medium mb-2">Items to Order (in correct sequence)</label>
                {form.ordering_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-600 w-8">{idx + 1}.</span>
                    <input 
                      type="text" 
                      className="flex-1 border rounded px-3 py-2 text-sm" 
                      value={item} 
                      onChange={e => {
                        const newItems = [...form.ordering_items];
                        newItems[idx] = e.target.value;
                        setForm({ ...form, ordering_items: newItems });
                      }}
                      placeholder={`Step ${idx + 1}`}
                    />
                    {form.ordering_items.length > 2 && (
                      <button 
                        onClick={() => setForm({ ...form, ordering_items: form.ordering_items.filter((_, i) => i !== idx) })}
                        className="text-red-600 hover:text-red-800"
                      >
                        <i className='bx bx-trash'></i>
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => setForm({ ...form, ordering_items: [...form.ordering_items, ''] })}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <i className='bx bx-plus'></i> Add Item
                </button>
              </div>
            )}

            {/* Image-based Question */}
            {form.question_type === 'image_based' && (
              <>
                <div>
                  <label className="block text-sm font-medium">Image URL</label>
                  <input 
                    type="url" 
                    className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                    value={form.image_url} 
                    onChange={e => setForm({ ...form, image_url: e.target.value })} 
                    placeholder="https://example.com/image.jpg" 
                  />
                  <p className="text-xs text-gray-500 mt-1">Students will answer based on this image</p>
                </div>
                <div>
                  <label className="block text-sm font-medium">Answer Type</label>
                  <select 
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    value={form.question_type}
                    onChange={e => {
                      // Keep image but change answer type
                      if (e.target.value === 'multiple_choice_single') {
                        setForm({ ...form, question_type: 'multiple_choice_single', options: [
                          { option_text: '', is_correct: false },
                          { option_text: '', is_correct: false },
                        ]});
                      }
                    }}
                  >
                    <option value="image_based">Short Answer</option>
                    <option value="multiple_choice_single">Multiple Choice</option>
                  </select>
                </div>
              </>
            )}

            {/* Audio-based Question */}
            {form.question_type === 'audio_based' && (
              <>
                <div>
                  <label className="block text-sm font-medium">Audio URL</label>
                  <input 
                    type="url" 
                    className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                    value={form.audio_url} 
                    onChange={e => setForm({ ...form, audio_url: e.target.value })} 
                    placeholder="https://example.com/audio.mp3" 
                  />
                  <p className="text-xs text-gray-500 mt-1">Students will listen and answer</p>
                </div>
                <div>
                  <label className="block text-sm font-medium">Maximum Words</label>
                  <input 
                    type="number" 
                    min={1} 
                    className="mt-1 w-full border rounded px-3 py-2" 
                    value={form.max_words} 
                    onChange={e => setForm({ ...form, max_words: Number(e.target.value) })} 
                    placeholder="50-100" 
                  />
                </div>
              </>
            )}

            {/* Passage / Comprehension */}
            {form.question_type === 'passage' && (
              <div>
                <label className="block text-sm font-medium">Passage Text</label>
                <textarea 
                  className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                  rows={6} 
                  value={form.passage_text} 
                  onChange={e => setForm({ ...form, passage_text: e.target.value })} 
                  placeholder="Enter the passage students will read..." 
                />
                <p className="text-xs text-gray-500 mt-1">This question will have sub-questions (add them after creating)</p>
              </div>
            )}

            {/* Case Study */}
            {form.question_type === 'case_study' && (
              <div>
                <label className="block text-sm font-medium">Case Study</label>
                <textarea 
                  className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                  rows={6} 
                  value={form.case_study_text} 
                  onChange={e => setForm({ ...form, case_study_text: e.target.value })} 
                  placeholder="Enter the case study scenario..." 
                />
                <p className="text-xs text-gray-500 mt-1">Students will analyze and answer based on this case</p>
              </div>
            )}

            {/* Calculation / Formula */}
            {form.question_type === 'calculation' && (
              <>
                <div>
                  <label className="block text-sm font-medium">Formula/Equation (Optional)</label>
                  <input 
                    type="text" 
                    className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                    value={form.formula} 
                    onChange={e => setForm({ ...form, formula: e.target.value })} 
                    placeholder="e.g., A = πr²" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Correct Answer</label>
                  <input 
                    type="text" 
                    className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                    value={form.correct_answer} 
                    onChange={e => setForm({ ...form, correct_answer: e.target.value })} 
                    placeholder="Enter the numerical answer" 
                  />
                </div>
              </>
            )}

            {/* Practical / Scenario */}
            {form.question_type === 'practical' && (
              <>
                <div>
                  <label className="block text-sm font-medium">Scenario Description</label>
                  <textarea 
                    className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                    rows={4} 
                    value={form.scenario_text} 
                    onChange={e => setForm({ ...form, scenario_text: e.target.value })} 
                    placeholder="Describe the practical scenario..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Marking Rubric</label>
                  <textarea 
                    className="mt-1 w-full border rounded px-3 py-2 text-sm" 
                    rows={3} 
                    value={form.marking_rubric} 
                    onChange={e => setForm({ ...form, marking_rubric: e.target.value })} 
                    placeholder="Enter marking criteria for practical assessment" 
                  />
                </div>
              </>
            )}
            
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={saveQuestion} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              {editing ? 'Update' : 'Create'} Question
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default QuestionBank;
