import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, SkeletonCard, SkeletonTable } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  marks: number;
  subject: string;
  class_level: string;
}

interface QuestionStats {
  total_questions: number;
  multiple_choice: number;
  true_false: number;
  essay: number;
}

interface CbtSubject {
  id: number;
  subject_name: string;
  class_level: string;
  shuffle_questions: boolean;
  questions_required: number;
}

const QuestionBank: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cbtSubjects, setCbtSubjects] = useState<CbtSubject[]>([]);
  const [selectedCbtSubject, setSelectedCbtSubject] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<QuestionStats>({
    total_questions: 0,
    multiple_choice: 0,
    true_false: 0,
    essay: 0,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState({
    question_text: '',
    question_type: 'multiple_choice',
    marks: 1,
    subject: '',
    class_level: 'JSS1',
    max_words: 100,
    marking_rubric: '',
    options: [
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
    ],
  });

  useEffect(() => {
    loadData();
    loadCbtSubjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/questions');
      if (response.data) {
        setQuestions(response.data);
        calculateStats(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch questions:', error);
      // Don't show error, just show empty state
      setQuestions([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCbtSubjects = async () => {
    try {
      const response = await api.get('/cbt/subjects');
      if (response.data?.subjects) {
        setCbtSubjects(response.data.subjects);
      }
    } catch (error: any) {
      console.error('Failed to fetch CBT subjects:', error);
    }
  };

  const calculateStats = (data: Question[]) => {
    setStats({
      total_questions: data.length,
      multiple_choice: data.filter(q => q.question_type === 'multiple_choice').length,
      true_false: data.filter(q => q.question_type === 'true_false').length,
      essay: data.filter(q => q.question_type === 'essay').length,
    });
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this question?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/questions/${id}`);
        showSuccess('Question deleted successfully');
        loadData();
      } catch (error) {
        showError('Failed to delete question');
      }
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ 
      question_text: '', 
      question_type: 'multiple_choice', 
      marks: 1, 
      subject: '', 
      class_level: 'JSS1',
      max_words: 100,
      marking_rubric: '',
      options: [
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
      ],
    });
    setShowCreateModal(true);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onNew: openCreate,
    onEscape: () => setShowCreateModal(false),
    onRefresh: loadData,
  });

  const openEdit = (q: Question) => {
    setEditing(q);
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      marks: q.marks,
      subject: q.subject,
      class_level: q.class_level,
      max_words: (q as any).max_words || 100,
      marking_rubric: (q as any).marking_rubric || '',
      options: (q as any).options || [
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
      ],
    });
    setShowCreateModal(true);
  };

  const saveQuestion = async () => {
    try {
      if (editing) {
        await api.put(`/questions/${editing.id}`, form);
        showSuccess('Question updated');
      } else {
        await api.post('/questions', form);
        showSuccess('Question created');
      }
      setShowCreateModal(false);
      loadData();
    } catch (error) {
      showError('Failed to save question');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedCbtSubject) {
      showError('Please select a CBT subject first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/cbt/subjects/${selectedCbtSubject}/questions/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSuccess('Questions imported successfully');
      loadData();
    } catch (error) {
      showError('Failed to import questions');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/questions/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'questions.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSuccess('Questions exported successfully');
    } catch (error) {
      showError('Failed to export questions');
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-600 mt-2">Manage exam questions</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <i className='bx bx-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400'></i>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search questions"
            />
          </div>
          <Button onClick={() => setShowCreateModal(true)} variant="secondary" className="flex items-center gap-2">
            <i className='bx bx-upload'></i>
            <span>Upload Questions</span>
          </Button>
          <Button onClick={openCreate} className="flex items-center gap-2">
            <i className='bx bx-plus'></i>
            <span>Create Question</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card className="bg-blue-50">
              <p className="text-sm text-gray-600">Total Questions</p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">{stats.total_questions}</h3>
            </Card>
            <Card className="bg-green-50">
              <p className="text-sm text-gray-600">Multiple Choice</p>
              <h3 className="text-2xl font-bold text-green-600 mt-1">{stats.multiple_choice}</h3>
            </Card>
            <Card className="bg-purple-50">
              <p className="text-sm text-gray-600">True/False</p>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">{stats.true_false}</h3>
            </Card>
            <Card className="bg-orange-50">
              <p className="text-sm text-gray-600">Essay</p>
              <h3 className="text-2xl font-bold text-orange-600 mt-1">{stats.essay}</h3>
            </Card>
          </>
        )}
      </div>

      {/* Upload Options */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Upload Questions</h2>
          <div className="flex gap-2">
            <select 
              className="border rounded px-3 py-2" 
              value={selectedCbtSubject ?? ''} 
              onChange={e => setSelectedCbtSubject(Number(e.target.value))}
              aria-label="Select CBT subject"
            >
              <option value="">Select CBT Subject</option>
              {cbtSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.subject_name} ({s.class_level}) {s.shuffle_questions ? '(Shuffled)' : ''}
                </option>
              ))}
            </select>
            <Button onClick={handleExport} variant="secondary" className="flex items-center gap-2">
              <i className='bx bx-download'></i>
              <span>Export CSV</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 cursor-pointer transition">
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
            <div className="text-4xl mb-3">
              <i className='bx bx-file text-4xl'></i>
            </div>
            <h3 className="font-semibold mb-2">Upload CSV File</h3>
            <p className="text-sm text-gray-600">Bulk upload questions from CSV</p>
            <div className="mt-3">
              <Button 
                onClick={(e) => { e.stopPropagation(); window.open('http://127.0.0.1:8000/api/cbt/sample-csv', '_blank'); }} 
                variant="secondary" 
                className="text-sm"
              >
                Download Sample CSV
              </Button>
            </div>
          </label>
          <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 cursor-pointer transition">
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            <div className="text-4xl mb-3">
              <i className='bx bx-spreadsheet text-4xl'></i>
            </div>
            <h3 className="font-semibold mb-2">Upload Excel File</h3>
            <p className="text-sm text-gray-600">Import questions from Excel</p>
          </label>
          <div onClick={() => setShowCreateModal(true)} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 cursor-pointer transition">
            <div className="text-4xl mb-3">
              <i className='bx bx-pencil text-4xl'></i>
            </div>
            <h3 className="font-semibold mb-2">Manual Entry</h3>
            <p className="text-sm text-gray-600">Add questions one by one</p>
          </div>
        </div>
      </Card>

      {/* Recent Questions */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Recent Questions</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <SkeletonTable rows={5} cols={5} />
              ) : questions.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500 text-center" colSpan={5}>
                    No questions yet. Start by uploading or creating questions.
                  </td>
                </tr>
              ) : (
                questions.slice(0, 10).map((question) => (
                  <tr key={question.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">{question.question_text.substring(0, 80)}...</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{question.question_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{question.subject}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{question.marks}</td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => openEdit(question)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                      <button onClick={() => handleDelete(question.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create/Edit Modal */}
      <div className={`fixed inset-0 ${showCreateModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-lg font-semibold">{editing ? 'Edit Question' : 'Create Question'}</h3>
            <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowCreateModal(false)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium">Question Text</label>
              <textarea className="mt-1 w-full border rounded px-3 py-2" rows={4} value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} aria-label="Question text" placeholder="Enter question text" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Type</label>
                <select className="mt-1 w-full border rounded px-3 py-2" value={form.question_type} onChange={e => setForm({ ...form, question_type: e.target.value })} aria-label="Question type">
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True/False</option>
                  <option value="short_answer">Essay (Short Answer)</option>
                  <option value="essay">Essay (Long Answer)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Marks</label>
                <input type="number" min={1} className="mt-1 w-full border rounded px-3 py-2" value={form.marks} onChange={e => setForm({ ...form, marks: Number(e.target.value) })} aria-label="Question marks" placeholder="Marks" />
              </div>
            </div>
            
            {/* Show max_words for essay questions */}
            {(form.question_type === 'short_answer' || form.question_type === 'essay') && (
              <div>
                <label className="block text-sm font-medium">Maximum Words</label>
                <input 
                  type="number" 
                  min={1} 
                  className="mt-1 w-full border rounded px-3 py-2" 
                  value={form.max_words} 
                  onChange={e => setForm({ ...form, max_words: Number(e.target.value) })} 
                  aria-label="Maximum words" 
                  placeholder={form.question_type === 'short_answer' ? '50-100 words' : '200-500 words'} 
                />
              </div>
            )}
            
            {/* Show marking rubric for long essays */}
            {form.question_type === 'essay' && (
              <div>
                <label className="block text-sm font-medium">Marking Rubric (Optional)</label>
                <textarea 
                  className="mt-1 w-full border rounded px-3 py-2" 
                  rows={3} 
                  value={form.marking_rubric} 
                  onChange={e => setForm({ ...form, marking_rubric: e.target.value })} 
                  aria-label="Marking rubric" 
                  placeholder="Enter marking criteria (e.g., Introduction: 2 marks, Body: 5 marks, Conclusion: 3 marks)" 
                />
              </div>
            )}
            
            {/* Show options for multiple choice and true/false */}
            {(form.question_type === 'multiple_choice' || form.question_type === 'true_false') && (
              <div>
                <label className="block text-sm font-medium mb-2">Options</label>
                {form.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input 
                      type="text" 
                      className="flex-1 border rounded px-3 py-2" 
                      value={option.option_text} 
                      onChange={e => {
                        const newOptions = [...form.options];
                        newOptions[idx].option_text = e.target.value;
                        setForm({ ...form, options: newOptions });
                      }}
                      placeholder={`Option ${idx + 1}`}
                      aria-label={`Option ${idx + 1}`}
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
                        aria-label={`Mark option ${idx + 1} as correct`}
                      />
                      <span className="text-sm">Correct</span>
                    </label>
                    {form.options.length > 2 && (
                      <button 
                        onClick={() => {
                          const newOptions = form.options.filter((_, i) => i !== idx);
                          setForm({ ...form, options: newOptions });
                        }}
                        className="text-red-600 hover:text-red-800"
                        aria-label={`Remove option ${idx + 1}`}
                      >
                        <i className='bx bx-trash'></i>
                      </button>
                    )}
                  </div>
                ))}
                {form.question_type === 'multiple_choice' && form.options.length < 6 && (
                  <button 
                    onClick={() => setForm({ 
                      ...form, 
                      options: [...form.options, { option_text: '', is_correct: false }] 
                    })}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <i className='bx bx-plus'></i> Add Option
                  </button>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Subject</label>
                <input className="mt-1 w-full border rounded px-3 py-2" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} aria-label="Subject" placeholder="Subject" />
              </div>
              <div>
                <label className="block text-sm font-medium">Class Level</label>
                <select className="mt-1 w-full border rounded px-3 py-2" value={form.class_level} onChange={e => setForm({ ...form, class_level: e.target.value })} aria-label="Class level">
                  {['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2">
            <button className="px-4 py-2 border rounded" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={saveQuestion}>Save</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default QuestionBank;
