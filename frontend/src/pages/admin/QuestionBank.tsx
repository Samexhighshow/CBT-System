import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Card, Button, SkeletonCard, SkeletonTable } from '../../components';
import { api } from '../../services/api';
import { bankApi } from '../../services/laravelApi';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { QuestionFilters } from '../../components/QuestionFilters';
import { QuestionTable } from '../../components/QuestionTable';
import { SectionGroup } from '../../components/SectionGroup';

interface Subject {
  id: number;
  name: string;
  code?: string;
  class_id?: number;
}

interface ClassLevel {
  id: number;
  name: string;
}

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  marks: number;
  difficulty?: string;
  status?: string;
  subject_id?: number;
  class_level?: string;
  subject?: Subject;
  section_name?: string;
  order_index?: number;
  options?: any[];
  instructions?: string;
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [groupBySection, setGroupBySection] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [form, setForm] = useState({
    question_text: '',
    question_type: 'multiple_choice_single',
    marks: 1,
    difficulty: '',
    subject_id: null as number | null,
    class_id: null as number | null,
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
    loadClasses();
    loadQuestions();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadSubjectsForClass(selectedClass);
    } else {
      setSubjects([]);
      setSelectedSubject(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);

  // Load subjects when modal opens with a selected class
  useEffect(() => {
    if (showCreateModal && form.class_id) {
      const loadSubjectsForModal = async () => {
        try {
          console.log('Modal: Loading subjects for class_id:', form.class_id);
          
          // Find the class name from classLevels
          const selectedClassObj = classLevels.find(c => c.id === form.class_id);
          const className = selectedClassObj?.name;
          console.log('Modal: Class name:', className);
          
          // Only fetch if we have a valid class name
          if (!className) {
            console.log('Modal: No class name found');
            setSubjects([]);
            return;
          }
          
          // Use class_level filter instead of fetching class directly
          const res = await api.get(`/subjects?class_level=${encodeURIComponent(className)}`);
          console.log('Modal: API Response:', res.data);
          
          const subjectsData = res.data?.data || res.data || [];
          console.log('Modal: Subjects Data:', subjectsData);
          setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
        } catch (error: any) {
          console.error('Failed to load subjects for modal:', error);
          console.error('Error details:', error.response?.data);
          setSubjects([]);
        }
      };
      loadSubjectsForModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal, form.class_id, classLevels]);

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, searchTerm, selectedSubject, selectedClass]);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const classesRes = await api.get('/classes');
      const allClasses = classesRes.data?.data || classesRes.data || [];
      
      // Deduplicate by class name - keep only unique levels
      const uniqueClasses = allClasses.reduce((acc: any[], curr: any) => {
        const exists = acc.find(c => c.name === curr.name);
        if (!exists) {
          acc.push(curr);
        }
        return acc;
      }, []);
      
      setClassLevels(uniqueClasses);
    } catch (error: any) {
      console.error('Failed to fetch classes:', error);
      setClassLevels([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjectsForClass = async (classLevel: string) => {
    try {
      console.log('Filter: Loading subjects for class:', classLevel);
      
      // Use class_level filter to get subjects for this specific class
      const subjectsRes = await api.get(`/subjects?class_level=${encodeURIComponent(classLevel)}`);
      console.log('Filter: API Response:', subjectsRes.data);
      
      const subjectsData = subjectsRes.data?.data || subjectsRes.data || [];
      console.log('Filter: Subjects Data:', subjectsData);
      
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
    } catch (error: any) {
      console.error('Failed to fetch subjects for class:', error);
      console.error('Error details:', error.response?.data);
      setSubjects([]);
    }
  };

  const loadQuestions = async () => {
    try {
      const params: any = {};
      if (selectedSubject) params.subject_id = selectedSubject;
      if (selectedClass) params.class_level = selectedClass;
      if (filters.questionType) params.question_type = filters.questionType;
      if (filters.difficulty) params.difficulty = filters.difficulty;
      if (filters.status) params.status = filters.status;
      if (searchTerm) params.q = searchTerm;

      const response = await api.get('/bank/questions', { params });
      const payload = response.data;
      const questionData: any[] = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload?.questions) ? payload.questions : []));
      setQuestions(questionData);
    } catch (error: any) {
      console.error('Failed to fetch bank questions:', error);
      setQuestions([]);
    }
  };

  const handleDelete = async (id: number) => {
    const question = questions.find(q => q.id === id);
    if (!question) {
      showError('Question not found');
      return;
    }

    // Check if question is used in exams (future: when usage tracking is implemented)
    // For now, prevent deletion of Active/Archived questions
    if (['Active', 'Archived'].includes(question.status || 'Active')) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Delete',
        html: `<div style="text-align: left;">
          <p><strong>This question cannot be deleted because it is ${question.status || 'Active'}.</strong></p>
          <p style="margin-top: 12px; font-size: 13px; color: #666;">
            To remove this question, please:
          </p>
          <ul style="text-align: left; margin: 8px 0 0 20px; font-size: 13px; color: #666;">
            <li>Set the status to <strong>Inactive</strong> or <strong>Draft</strong></li>
            <li>Or archive it instead of deleting</li>
          </ul>
        </div>`,
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'OK'
      });
      return;
    }

    const confirmed = await showDeleteConfirm(`Delete question #${id}?`);
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/bank/questions/${id}`);
        showSuccess('Question deleted successfully');
        loadQuestions();
        setSelectedIds(new Set(Array.from(selectedIds).filter(sid => sid !== id)));
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || 'Failed to delete question';
        showError(errorMsg);
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
        await api.post('/bank/questions/bulk-delete', {
          ids: Array.from(selectedIds),
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
      await api.post('/bank/questions/bulk-status', {
        ids: Array.from(selectedIds),
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
      await api.post(`/bank/questions/${id}/duplicate`);
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
      // Get the current question to find its status
      const question = questions.find(q => q.id === id);
      if (!question) {
        showError('Question not found');
        return;
      }

      // Determine the new status (toggle between Active and Inactive)
      const currentStatus = question.status || 'Active';
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

      // Update only the status field via API
      await api.put(`/bank/questions/${id}`, {
        status: newStatus
      });

      showSuccess(`Question status changed to ${newStatus}`);
      
      // Reload questions to reflect changes
      await loadQuestions();
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      showError(error.response?.data?.message || 'Failed to update question status');
    }
  };

  const handlePreview = async (id: number) => {
    try {
      const response = await api.get(`/bank/questions/${id}`);
      const q = response.data;
      
      // Format question type
      const typeMap: Record<string, string> = {
        'multiple_choice': 'Multiple Choice (Single)',
        'multiple_select': 'Multiple Choice (Multiple)',
        'true_false': 'True/False',
        'short_answer': 'Short Answer',
        'long_answer': 'Long Answer/Essay',
        'file_upload': 'File Upload'
      };
      const qType = typeMap[q.question_type] || q.question_type;
      
      // Build rich HTML preview
      const htmlContent = `
        <div style="text-align: left; font-family: system-ui;">
          <div style="margin-bottom: 24px;">
            <p style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">Question ID: ${q.id}</p>
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1f2937; line-height: 1.5;">${q.question_text}</h3>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: 500;">Question Type</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${qType}</p>
            </div>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: 500;">Marks</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${q.marks}</p>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: 500;">Difficulty</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${q.difficulty || '—'}</p>
            </div>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: 500;">Status</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${q.status || 'Active'}</p>
            </div>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: 500;">Subject</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${q.subject?.name || '—'}</p>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: 500;">Class Level</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${q.class_level || '—'}</p>
            </div>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: 500;">Created</p>
              <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">${new Date(q.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          
          ${q.options && q.options.length > 0 ? `
            <div style="margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Options</p>
              <div>
                ${q.options.map((opt: any, i: number) => `
                  <div style="padding: 8px 12px; background: ${opt.is_correct ? '#dcfce7' : '#f9fafb'}; border-left: 3px solid ${opt.is_correct ? '#22c55e' : '#d1d5db'}; margin-bottom: 8px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 13px; color: #1f2937;">
                      <span style="font-weight: 600; color: ${opt.is_correct ? '#16a34a' : '#666'};">${opt.is_correct ? '✓ Correct' : 'Option'}</span> — ${opt.option_text}
                    </p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      
      await Swal.fire({
        title: 'Question Preview',
        html: htmlContent,
        width: '600px',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Close',
        didOpen: () => {
          const popup = Swal.getPopup();
          if (popup) {
            popup.style.borderRadius = '12px';
          }
        }
      });
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

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(filtered.map(q => q.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ 
      question_text: '', 
      question_type: 'multiple_choice_single', 
      marks: 1, 
      difficulty: '',
      subject_id: selectedSubject,
      class_id: selectedClass ? Number(selectedClass) : null,
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
    // Prevent editing of Active questions
    if ((q.status || 'Active') === 'Active') {
      Swal.fire({
        icon: 'warning',
        title: 'Not Editable',
        text: 'The question needs to be set to Inactive to Edit',
        confirmButtonColor: '#2563eb',
      });
      return;
    }

    setEditing(q);
    
        // Find the class_id from class_level
        const classId = q.class_level
          ? classLevels.find(c => c.name === q.class_level)?.id || null
          : null;
    
    // Map backend question types to UI types
    const typeMapBackendToUI: Record<string, string> = {
      multiple_choice: 'multiple_choice_single',
      multiple_select: 'multiple_choice_multiple',
      true_false: 'true_false',
      short_answer: 'short_answer',
      long_answer: 'essay',
      file_upload: 'essay',
    };

    const uiType = typeMapBackendToUI[(q as any).question_type] || q.question_type;

    // Normalize options from backend (supports option_text or text)
    const rawOptions = Array.isArray((q as any).options) ? (q as any).options : [];
    const normalizedOptions = rawOptions.length > 0
      ? rawOptions.map((o: any) => ({
          option_text: o.option_text ?? o.text ?? '',
          is_correct: Boolean(o.is_correct),
        }))
      : [
          { option_text: '', is_correct: false },
          { option_text: '', is_correct: false },
        ];

    setForm({
      question_text: q.question_text,
      question_type: uiType,
      marks: q.marks,
      difficulty: (q as any).difficulty || '',
      subject_id: q.subject_id || null,
      class_id: classId,
      max_words: (q as any).max_words || 100,
      marking_rubric: (q as any).marking_rubric || (q as any).instructions || '',
      // Multiple choice options
      options: normalizedOptions,
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

  const saveQuestion = async (e?: React.FormEvent) => {
    // ALWAYS prevent default form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      // ============================================
      // STEP 1: VALIDATE ALL REQUIRED FIELDS
      // ============================================
      console.log('=== QUESTION SAVE: STARTING VALIDATION ===');
      console.log('Form Data:', {
        question_text: form.question_text,
        question_type: form.question_type,
        marks: form.marks,
        class_id: form.class_id,
        subject_id: form.subject_id,
        difficulty: form.difficulty,
        options: form.options
      });

      const errors: string[] = [];

      // Question Text (min 5 chars as per backend)
      if (!form.question_text || form.question_text.trim().length < 5) {
        errors.push('Question text must be at least 5 characters');
      }

      // Question Type
      if (!form.question_type) {
        errors.push('Question type is required');
      }

      // Marks
      if (!form.marks || form.marks <= 0) {
        errors.push('Marks must be greater than 0');
      }

      // Class
      if (!form.class_id) {
        errors.push('Class is required');
      }

      // Subject
      if (!form.subject_id) {
        errors.push('Subject is required');
      }

      // Difficulty
      if (!form.difficulty || form.difficulty.trim() === '') {
        errors.push('Difficulty is required (Easy, Medium, or Hard)');
      }

      // Question Type Specific Validation
      if (['multiple_choice_single', 'multiple_choice_multiple'].includes(form.question_type)) {
        if (!form.options || form.options.length < 2) {
          errors.push('Multiple choice questions must have at least 2 options');
        } else {
          const filledOptions = form.options.filter(o => o.option_text && o.option_text.trim());
          if (filledOptions.length < 2) {
            errors.push('At least 2 options must have text');
          }
          const correctOptions = form.options.filter(o => o.is_correct);
          if (correctOptions.length === 0) {
            errors.push('At least one option must be marked as correct');
          }
        }
      }

      // Show all errors if any
      if (errors.length > 0) {
        console.log('Validation failed:', errors);
        const errorList = errors.map((err, i) => `<div style="margin: 8px 0;">${i + 1}. ${err}</div>`).join('');
        await Swal.fire({
          icon: 'error',
          title: 'Validation Errors',
          html: `<div style="text-align: left; font-size: 14px;"><strong style="color: #dc2626;">Please fix the following errors:</strong><br><br>${errorList}</div>`,
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'OK',
          width: '500px'
        });
        return;
      }

      console.log('Validation passed!');

      // ============================================
      // STEP 2: MAP FRONTEND TYPES TO BACKEND TYPES
      // ============================================
      const typeMap: Record<string, string> = {
        'multiple_choice_single': 'multiple_choice',
        'multiple_choice_multiple': 'multiple_select',
        'true_false': 'true_false',
        'short_answer': 'short_answer',
        'essay': 'long_answer'
      };

      const backendType = typeMap[form.question_type] || form.question_type;
      console.log('Mapped type:', form.question_type, '->', backendType);

      // ============================================
      // STEP 3: GET CLASS NAME FROM CLASS ID
      // ============================================
      const selectedClass = classLevels.find(c => c.id === form.class_id);
      if (!selectedClass || !selectedClass.name) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Invalid class selected. Please select a class again.',
          confirmButtonColor: '#dc2626'
        });
        return;
      }

      const className = selectedClass.name;
      console.log('Class:', className);

      // ============================================
      // STEP 4: BUILD PAYLOAD FOR BACKEND
      // ============================================
      const payload: any = {
        question_text: form.question_text.trim(),
        question_type: backendType,
        marks: Number(form.marks),
        difficulty: form.difficulty,
        subject_id: Number(form.subject_id),
        class_level: className,
        status: editing ? (editing.status || 'Inactive') : 'Draft',
        instructions: form.marking_rubric || null
      };

      // Add options for multiple choice questions
      if (['multiple_choice', 'multiple_select', 'true_false'].includes(backendType)) {
        payload.options = form.options
          .filter(o => o.option_text && o.option_text.trim())
          .map(o => ({
            option_text: o.option_text.trim(),
            is_correct: Boolean(o.is_correct)
          }));

        if (payload.options.length === 0) {
          await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Please add at least 2 options for this question type.',
            confirmButtonColor: '#dc2626'
          });
          return;
        }
      }

      console.log('Payload to send:', payload);

      // ============================================
      // STEP 5: SEND TO BACKEND
      // ============================================
      console.log('Sending request to /bank/questions...');
      
      let response;
      if (editing) {
        response = await api.put(`/bank/questions/${editing.id}`, payload);
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Question updated successfully',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        response = await api.post('/bank/questions', payload);
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Question created successfully',
          timer: 2000,
          showConfirmButton: false
        });
      }

      console.log('Response:', response.data);

      // ============================================
      // STEP 6: RELOAD QUESTIONS AND CLOSE MODAL
      // ============================================
      setShowCreateModal(false);
      setEditing(null);
      
      console.log('Reloading questions list...');
      await loadQuestions();
      console.log('Questions reloaded!');

    } catch (error: any) {
      console.error('=== QUESTION SAVE ERROR ===');
      console.error('Error:', error);
      console.error('Response:', error.response?.data);
      console.error('Status:', error.response?.status);

      let errorMessage = 'Failed to save question';

      if (error.response?.status === 422) {
        // Validation errors from backend
        const errors = error.response.data.errors;
        if (errors) {
          const errorList = Object.entries(errors)
            .map(([field, messages]: [string, any]) => {
              const msgs = Array.isArray(messages) ? messages : [messages];
              return `<div style="margin: 8px 0;"><strong>${field}:</strong> ${msgs.join(', ')}</div>`;
            })
            .join('');
          await Swal.fire({
            icon: 'error',
            title: 'Validation Error',
            html: `<div style="text-align: left; font-size: 14px;">${errorList}</div>`,
            confirmButtonColor: '#dc2626',
            width: '500px'
          });
          return;
        }
      }

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMessage,
        confirmButtonColor: '#dc2626'
      });
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
    try {
      const params: any = {};
      if (selectedSubject) params.subject_id = selectedSubject;
      if (selectedClass) params.class_level = selectedClass;
      if (filters.questionType) params.question_type = filters.questionType;
      if (filters.difficulty) params.difficulty = filters.difficulty;
      if (filters.status) params.status = filters.status;

      const response = await api.get('/bank/questions/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bank-questions-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('Questions exported successfully');
    } catch (error) {
      showError('Failed to export questions');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      showError('Please select a file to import');
      return;
    }

    try {
      setImportLoading(true);
      const result = await bankApi.import(importFile);
      setImportResult(result.data);
      showSuccess(`Imported ${result.data.inserted} questions successfully`);
      if (result.data.inserted > 0) {
        loadQuestions();
      }
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to import questions');
    } finally {
      setImportLoading(false);
    }
  };

  const downloadErrorReport = () => {
    if (!importResult?.error_report_csv) return;
    const blob = new Blob([importResult.error_report_csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `import-errors-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const openVersionHistory = async (questionId: number) => {
    try {
      setSelectedQuestionId(questionId);
      setShowVersionModal(true);
      setVersionsLoading(true);
      const response = await bankApi.listVersions(questionId);
      setVersions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showError('Failed to load version history');
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRevertVersion = async (version: number) => {
    if (!selectedQuestionId) return;
    const confirmed = await showDeleteConfirm(`Revert to version ${version}?`);
    if (confirmed.isConfirmed) {
      try {
        await bankApi.revertVersion(selectedQuestionId, version);
        showSuccess('Question reverted successfully');
        loadQuestions();
        // Refresh versions
        const response = await bankApi.listVersions(selectedQuestionId);
        setVersions(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        showError('Failed to revert version');
      }
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

        {/* Stats Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">{questions.length} total questions</p>
        </div>

        {/* Question Management Interface */}
        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div 
            onClick={() => setShowImportModal(true)}
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
          {/* Header Row - Title, Count, Show Inactive, Search, Sort */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Title and Count */}
              <div>
                <h3 className="text-base font-semibold text-gray-900">Your Questions</h3>
                <p className="text-xs text-gray-600">{filtered.length} matching questions</p>
              </div>
              
              {/* Right: Controls */}
              <div className="flex items-center gap-3">
                {/* Show Inactive */}
                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-gray-300 cursor-pointer"
                  />
                  <span className="text-gray-700">Show inactive</span>
                </label>
                
                {/* Search */}
                <div className="relative">
                  <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'></i>
                  <input
                    ref={searchInputRef}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search questions..."
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 w-56"
                  />
                </div>
                
                {/* Sort */}
                <select className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                  <option>Name A–Z</option>
                  <option>Name Z–A</option>
                  <option>Newest First</option>
                  <option>Oldest First</option>
                </select>
                
                {/* Per Page */}
                <select className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                  <option>10 per page</option>
                  <option>25 per page</option>
                  <option>50 per page</option>
                  <option>100 per page</option>
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
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(filtered.map(q => q.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  className="w-5 h-5 cursor-pointer"
                  title="Select all questions"
                />
                <span className="text-sm font-semibold text-blue-800">
                  {selectedIds.size > 0 ? `${selectedIds.size} of ${filtered.length} selected` : 'Select All'}
                </span>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <button
                    onClick={() => {
                      // Export functionality
                      console.log('Export selected questions:', Array.from(selectedIds));
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                  >
                    <i className='bx bx-download text-sm'></i>Export
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5"
                  >
                    <i className='bx bx-trash text-sm'></i>Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3 px-4 py-3 border-b border-gray-200">
            <div className="text-sm text-gray-700 font-medium">Questions</div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-600">Class Level:</span>
                <select
                  value={selectedClass || ''}
                  onChange={(e) => {
                    const newClass = e.target.value || null;
                    setSelectedClass(newClass);
                    setSelectedSubject(null);
                    if (newClass) {
                      loadSubjectsForClass(newClass);
                    } else {
                      setSubjects([]);
                    }
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                >
                  <option value="">All</option>
                  {classLevels.map(cls => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-600">Subject:</span>
                <select
                  value={selectedSubject || ''}
                  onChange={(e) => setSelectedSubject(e.target.value ? Number(e.target.value) : null)}
                  disabled={!selectedClass}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">{selectedClass ? 'All Subjects' : 'Select class first'}</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setSelectedClass(null);
                  setSelectedSubject(null);
                  setSubjects([]);
                  setFilters({});
                  setSearchTerm('');
                  setShowInactive(false);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
              >
                Reset filters
              </button>
            </div>
          </div>

          {/* Questions Table */}
          <div className={filtered.length >= 6 ? 'max-h-96 overflow-auto' : ''}>
            {loading ? (
              <SkeletonTable rows={5} cols={8} />
            ) : filtered.length === 0 ? (
              <div className="text-center py-8">
                <i className='bx bx-inbox text-4xl text-gray-300'></i>
                <p className="text-gray-500 text-sm mt-2">No questions match your filters</p>
              </div>
            ) : (
              <QuestionTable
                questions={filtered}
                selectedIds={selectedIds}
                onSelectChange={handleSelectChange}
                onSelectAll={handleSelectAll}
                onEdit={openEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onToggleStatus={handleToggleStatus}
                onPreview={handlePreview}
                onVersionHistory={openVersionHistory}
                isLoading={loading}
              />
            )}
          </div>
        </div>

      {/* Create/Edit Modal - Enhanced Design */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Sticky Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-5 flex justify-between items-center shadow-md">
              <div>
                <h3 className="text-lg font-bold">{editing ? 'Edit Question' : 'Create New Question'}</h3>
                <p className="text-sm text-blue-100 mt-0.5">Build your assessment with quality content</p>
              </div>
              <button 
                aria-label="Close" 
                className="text-blue-100 hover:text-white text-2xl transition-colors"
                onClick={() => setShowCreateModal(false)}
              >
                <i className='bx bx-x'></i>
              </button>
            </div>

            {/* Info Note */}
            <div className="px-6 pt-4">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <i className='bx bx-info-circle mr-2 align-middle'></i>
                  <strong>Tip:</strong> Select a class first, then choose a subject from that class. All fields marked with <span className="text-red-500 font-bold">*</span> are required.
                </p>
              </div>
            </div>

            {/* Form Content */}
            <form onSubmit={saveQuestion} className="px-6 pb-6 space-y-5">
              {/* Question Text */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Question Text <span className="text-red-500">*</span></label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                  rows={4} 
                  value={form.question_text} 
                  onChange={e => setForm({ ...form, question_text: e.target.value })} 
                  aria-label="Question text" 
                  placeholder="Enter your question clearly and concisely..."
                />
              </div>

              {/* Class and Subject Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Class <span className="text-red-500">*</span></label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    value={form.class_id || ''}
                    onChange={async (e) => {
                      const classId = e.target.value ? Number(e.target.value) : null;
                      setForm({ ...form, class_id: classId, subject_id: null });
                      
                      if (classId) {
                        try {
                          const selectedClassObj = classLevels.find(c => c.id === classId);
                          const className = selectedClassObj?.name;
                          
                          if (!className) {
                            setSubjects([]);
                            return;
                          }
                          
                          const res = await api.get(`/subjects?class_level=${encodeURIComponent(className)}`);
                          const subjectsArray = res.data?.data || res.data || [];
                          setSubjects(Array.isArray(subjectsArray) ? subjectsArray : []);
                        } catch (error: any) {
                          setSubjects([]);
                          showError('Failed to load subjects for this class');
                        }
                      } else {
                        setSubjects([]);
                      }
                    }}
                    aria-label="Class"
                  >
                    <option value="">-- Select Class --</option>
                    {classLevels.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subject <span className="text-red-500">*</span></label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    value={form.subject_id || ''}
                    onChange={e => setForm({ ...form, subject_id: e.target.value ? Number(e.target.value) : null })}
                    aria-label="Subject"
                    disabled={!form.class_id}
                  >
                    <option value="">-- Select Subject --</option>
                    {subjects && subjects.length > 0 ? subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    )) : <option disabled>{form.class_id ? 'No subjects available' : 'Select a class first'}</option>}
                  </select>
                </div>
              </div>

              {/* Type, Marks, Difficulty Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Type <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                    value={form.question_type} 
                    onChange={e => setForm({ ...form, question_type: e.target.value })} 
                    aria-label="Question type"
                  >
                    <option value="">-- Select Type --</option>
                    <optgroup label="Choice-Based">
                      <option value="multiple_choice_single">Multiple Choice (Single)</option>
                      <option value="multiple_choice_multiple">Multiple Choice (Multiple)</option>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Marks <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    min={1} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                    value={form.marks} 
                    onChange={e => setForm({ ...form, marks: Number(e.target.value) })} 
                    aria-label="Question marks" 
                    placeholder="Marks"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Difficulty <span className="text-red-500">*</span></label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    value={form.difficulty}
                    onChange={e => setForm({ ...form, difficulty: e.target.value })}
                    aria-label="Question difficulty"
                  >
                    <option value="">-- Select Level --</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
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
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)} 
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
                >
                  <i className='bx bx-check mr-1'></i>
                  {editing ? 'Update Question' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-bold text-gray-800">Bulk Upload Questions</h3>
              <button
                aria-label="Close"
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                  setImportFile(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl transition-colors"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-6 space-y-5 overflow-y-auto flex-1">
              {!importResult ? (
                <>
                  <div>
                    <p className="text-sm text-gray-700 mb-3 font-medium">
                      Upload a CSV file with the following columns:
                    </p>
                    <ul className="text-xs text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-1.5">
                      <li>• <strong>question_text</strong> (required)</li>
                      <li>• <strong>question_type</strong> (required): multiple_choice/multiple_select/true_false/short_answer/long_answer</li>
                      <li>• <strong>class_id</strong> (required): ID of the class</li>
                      <li>• <strong>subject_id</strong> (required): ID of the subject</li>
                      <li>• <strong>marks</strong> (required)</li>
                      <li>• <strong>difficulty</strong> (required): easy/medium/hard</li>
                      <li>• <strong>instructions</strong> (optional)</li>
                      <li>• <strong>status</strong> (optional): draft/active/inactive/archived</li>
                    </ul>
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-all bg-gray-50 hover:bg-blue-50">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setImportFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="csv-upload-questions"
                    />
                    <label htmlFor="csv-upload-questions" className="cursor-pointer block">
                      <div className="flex justify-center mb-3">
                        <i className='bx bx-cloud-upload text-6xl text-gray-400'></i>
                      </div>
                      <p className="text-base font-semibold text-gray-800 mb-1">
                        {importFile ? importFile.name : 'Click to upload CSV'}
                      </p>
                      <p className="text-sm text-gray-500">or drag and drop</p>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowImportModal(false);
                        setImportResult(null);
                        setImportFile(null);
                      }}
                      className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={!importFile || importLoading}
                      className="flex-1 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:shadow-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {importLoading ? (
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
                </>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <i className='bx bx-check-circle text-green-600 text-2xl'></i>
                      <h4 className="text-lg font-semibold text-gray-800">Import Summary</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                        <p className="text-xs text-gray-600 font-medium">Total Rows</p>
                        <p className="text-2xl font-bold text-green-600">{importResult.total}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                        <p className="text-xs text-gray-600 font-medium">Successful</p>
                        <p className="text-2xl font-bold text-green-600">{importResult.imported || importResult.inserted}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-orange-100">
                        <p className="text-xs text-gray-600 font-medium">Failed</p>
                        <p className="text-2xl font-bold text-orange-600">{importResult.failed}</p>
                      </div>
                    </div>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <i className='bx bx-error-circle text-red-600 text-xl'></i>
                          <span className="font-semibold text-gray-800">Failed Rows ({importResult.errors.length})</span>
                        </div>
                        <button
                          onClick={downloadErrorReport}
                          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors font-medium"
                        >
                          <i className='bx bx-download mr-1'></i>Download Report
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {importResult.errors.slice(0, 5).map((err: any, idx: number) => (
                          <div key={idx} className="text-sm text-red-700 bg-white rounded p-2 border border-red-200">
                            <span className="font-medium">Line {err.line}:</span> {err.errors.join(', ')}
                          </div>
                        ))}
                        {importResult.errors.length > 5 && (
                          <p className="text-sm text-red-600 font-medium text-center py-2">... and {importResult.errors.length - 5} more errors (download report for details)</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => { setShowImportModal(false); setImportResult(null); setImportFile(null); }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setImportResult(null);
                        setImportFile(null);
                        fileInputRef.current?.click();
                      }}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg text-sm font-medium hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <i className='bx bx-upload'></i>Import Another File
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      <div className={`fixed inset-0 ${showVersionModal ? 'flex' : 'hidden'} items-center justify-center z-50 bg-black bg-opacity-50 p-4`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowVersionModal(false)} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <i className='bx bx-history text-blue-600 text-xl'></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
                <p className="text-xs text-gray-500 mt-0.5">Track all changes to this question</p>
              </div>
            </div>
            <button aria-label="Close" className="text-gray-400 hover:text-gray-600 transition" onClick={() => setShowVersionModal(false)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {versionsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin mb-4">
                  <i className='bx bx-loader text-blue-600 text-3xl'></i>
                </div>
                <p className="text-gray-500 font-medium">Loading version history...</p>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 bg-gray-100 rounded-full mb-4">
                  <i className='bx bx-inbox text-gray-400 text-3xl'></i>
                </div>
                <p className="text-gray-500 font-medium">No version history available</p>
                <p className="text-xs text-gray-400 mt-1">This question will show version updates here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {versions.map((v, idx) => {
                  const typeMap: Record<string, string> = {
                    'multiple_choice': 'MCQ (Single)',
                    'multiple_select': 'MCQ (Multiple)',
                    'true_false': 'True/False',
                    'short_answer': 'Short Answer',
                    'long_answer': 'Essay',
                    'file_upload': 'File Upload'
                  };
                  
                  return (
                    <div key={v.id} className="border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200 group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="inline-block px-3 py-1 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 text-xs font-semibold rounded-full">v{v.version_number}</span>
                            {idx === 0 && <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Current</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mb-1">{v.change_notes}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            <i className='bx bx-calendar text-gray-400'></i>
                            {new Date(v.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {idx > 0 && (
                          <button
                            onClick={() => handleRevertVersion(v.version_number)}
                            className="text-xs bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium transition-colors whitespace-nowrap ml-3"
                            title="Restore this version"
                          >
                            <i className='bx bx-undo text-sm mr-1'></i>Revert
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Type</span>
                          <span className="text-sm font-semibold text-gray-900">{typeMap[v.question_type] || v.question_type}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Marks</span>
                          <span className="text-sm font-semibold text-gray-900">{v.marks}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Difficulty</span>
                          <span className="text-sm font-semibold text-gray-900">{v.difficulty || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</span>
                          <span className="text-sm font-semibold text-gray-900">{v.status || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-between">
            <p className="text-xs text-gray-600">Showing {versions.length} version{versions.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setShowVersionModal(false)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default QuestionBank;
