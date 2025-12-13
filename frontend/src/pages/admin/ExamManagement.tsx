/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, SkeletonCard, SkeletonList } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess, showDeleteConfirm } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface Exam {
  id: number;
  title: string;
  description: string;
  subject_id: number;
  duration: number;
  total_marks: number;
  passing_marks: number;
  status: string;
  start_time: string;
  end_time: string;
}

interface ExamStats {
  total: number;
  active: number;
  scheduled: number;
  completed: number;
}

const ExamManagement: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<ExamStats>({
    total: 0,
    active: 0,
    scheduled: 0,
    completed: 0,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [duplicatingExam, setDuplicatingExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<Array<{id: number; name: string}>>([]);
  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    subject_id: 0,
    duration: 60,
    total_marks: 100,
    passing_marks: 50,
    start_time: '',
    end_time: '',
  });

  useEffect(() => {
    loadExams();
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const response = await api.get('/subjects');
      if (response.data) {
        setSubjects(response.data.data || response.data);
      }
    } catch (error) {
      console.error('Failed to load subjects:', error);
      setSubjects([]);
    }
  };

  const loadExams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/exams');
      if (response.data) {
        const exams = response.data.data || response.data;
        setExams(exams);
        calculateStats(exams);
      }
    } catch (error: any) {
      console.error('Failed to fetch exams:', error);
      // Don't show error, just show empty state
      setExams([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Exam[]) => {
    const now = new Date();
    setStats({
      total: data.length,
      active: data.filter(e => e.status === 'published' && new Date(e.start_time) <= now && new Date(e.end_time) >= now).length,
      scheduled: data.filter(e => e.status === 'published' && new Date(e.start_time) > now).length,
      completed: data.filter(e => e.status === 'completed' || new Date(e.end_time) < now).length,
    });
  };

  const handleDownloadSampleExamCSV = () => {
    const csvContent = 'title,description,subject_id,duration,total_marks,passing_marks,start_time,end_time,status\n'
      + 'Midterm Exam,Midterm covering chapters 1-5,1,60,100,50,2025-12-15T09:00,2025-12-15T10:00,published';
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

  const handleUploadCSVClick = () => {
    showError('Bulk CSV upload for exams is not available yet. Please use Manual Entry for now.');
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onNew: () => setShowCreateModal(true),
    onEscape: () => setShowCreateModal(false),
    onRefresh: loadExams,
  });

  const handleDelete = async (id: number) => {
    const confirmed = await showDeleteConfirm('Delete this exam?');
    if (confirmed.isConfirmed) {
      try {
        await api.delete(`/exams/${id}`);
        showSuccess('Exam deleted successfully');
        loadExams();
      } catch (error) {
        showError('Failed to delete exam');
      }
    }
  };

  const handleDuplicate = async (exam: Exam) => {
    try {
      const response = await api.post(`/exams/${exam.id}/duplicate`);
      showSuccess('Exam duplicated successfully');
      loadExams();
    } catch (error) {
      showError('Failed to duplicate exam');
    }
  };

  return (
    <div className="app-shell section-shell">
      <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Exam Management</h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">Create and manage exams</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1">
            <i className='bx bx-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm'></i>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search exams..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search exams"
            />
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 text-xs md:text-sm py-1.5 px-3">
            <i className='bx bx-plus-circle text-sm'></i>
            <span className="hidden md:inline">Create New Exam</span>
            <span className="md:hidden">Create</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card className="bg-blue-50 panel-compact">
              <p className="text-xs md:text-sm text-gray-600">Total Exams</p>
              <h3 className="text-lg md:text-xl font-bold text-blue-600 mt-1">{stats.total}</h3>
            </Card>
            <Card className="bg-green-50 panel-compact">
              <p className="text-xs md:text-sm text-gray-600">Active</p>
              <h3 className="text-lg md:text-xl font-bold text-green-600 mt-1">{stats.active}</h3>
            </Card>
            <Card className="bg-orange-50 panel-compact">
              <p className="text-xs md:text-sm text-gray-600">Scheduled</p>
              <h3 className="text-lg md:text-xl font-bold text-orange-600 mt-1">{stats.scheduled}</h3>
            </Card>
            <Card className="bg-gray-50 panel-compact">
              <p className="text-xs md:text-sm text-gray-600">Completed</p>
              <h3 className="text-lg md:text-xl font-bold text-gray-600 mt-1">{stats.completed}</h3>
            </Card>
          </>
        )}
      </div>

      {/* Exam setup actions */}
      <Card className="panel-compact">
        <h2 className="text-lg md:text-xl font-semibold mb-3">Exam Setup</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div 
            onClick={handleUploadCSVClick}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition"
          >
            <div className="flex justify-center mb-4">
              <div className="text-5xl text-gray-400">
                <i className='bx bx-file'></i>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload CSV File</h3>
            <p className="text-sm text-gray-600">Bulk upload exams from CSV</p>
          </div>

          <div 
            onClick={handleDownloadSampleExamCSV}
            className="border-2 border-dashed border-green-500 rounded-lg p-8 text-center cursor-pointer hover:border-green-600 hover:bg-green-50 transition"
          >
            <div className="flex justify-center mb-4">
              <div className="text-5xl text-green-500">
                <i className='bx bx-download'></i>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Download Sample CSV</h3>
            <p className="text-sm text-gray-600">Download CSV format template</p>
          </div>

          <div 
            onClick={() => setShowCreateModal(true)}
            className="border-2 border-dashed border-purple-500 rounded-lg p-8 text-center cursor-pointer hover:border-purple-600 hover:bg-purple-50 transition"
          >
            <div className="flex justify-center mb-4">
              <div className="text-5xl text-purple-500">
                <i className='bx bx-edit'></i>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Manual Entry</h3>
            <p className="text-sm text-gray-600">Add exams one by one</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-4">All Exams ({exams.filter(e => 
          searchTerm === '' || 
          e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.description.toLowerCase().includes(searchTerm.toLowerCase())
        ).length})</h2>
        {loading ? (
          <SkeletonList items={6} />
        ) : exams.filter(e => 
          searchTerm === '' || 
          e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.description.toLowerCase().includes(searchTerm.toLowerCase())
        ).length === 0 ? (
          <p className="text-gray-500">{searchTerm ? 'No exams match your search.' : 'No exams yet. Create your first exam.'}</p>
        ) : (
          <div className="space-y-4">
            {exams.filter(e => 
              searchTerm === '' || 
              e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              e.description.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((exam) => (
              <div key={exam.id} className="border rounded-lg p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{exam.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{exam.description}</p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><i className='bx bx-time-five'></i> {exam.duration} min</span>
                      <span className="flex items-center gap-1"><i className='bx bx-edit-alt'></i> {exam.total_marks} marks</span>
                      <span className={`px-2 py-1 rounded ${exam.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {exam.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDuplicate(exam)} className="text-green-600 hover:text-green-800 text-sm font-medium">Duplicate</button>
                    <button onClick={() => {
                      setEditingExam(exam);
                      setExamForm({
                        title: exam.title,
                        description: exam.description,
                        subject_id: exam.subject_id,
                        duration: exam.duration,
                        total_marks: exam.total_marks,
                        passing_marks: exam.passing_marks,
                        start_time: exam.start_time?.slice(0, 16) || '',
                        end_time: exam.end_time?.slice(0, 16) || '',
                      });
                      setShowEditModal(true);
                    }} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                    <button onClick={() => handleDelete(exam.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Exam Modal */}
      <div className={`fixed inset-0 ${showCreateModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-3 sticky top-0 bg-white">
            <h3 className="text-lg font-semibold">Create New Exam</h3>
            <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowCreateModal(false)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium">Title</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={examForm.title} onChange={e => setExamForm({...examForm, title: e.target.value})} aria-label="Exam title" placeholder="Exam title" />
            </div>
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={examForm.description} onChange={e => setExamForm({...examForm, description: e.target.value})} aria-label="Exam description" placeholder="Description" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Subject</label>
                <select className="mt-1 w-full border rounded px-3 py-2" value={examForm.subject_id} onChange={e => setExamForm({...examForm, subject_id: Number(e.target.value)})} aria-label="Subject">
                  <option value={0}>Select subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Duration (min)</label>
                <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={examForm.duration} onChange={e => setExamForm({...examForm, duration: Number(e.target.value)})} aria-label="Duration" placeholder="Duration" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Total Marks</label>
                <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={examForm.total_marks} onChange={e => setExamForm({...examForm, total_marks: Number(e.target.value)})} aria-label="Total marks" placeholder="Total marks" />
              </div>
              <div>
                <label className="block text-sm font-medium">Passing Marks</label>
                <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={examForm.passing_marks} onChange={e => setExamForm({...examForm, passing_marks: Number(e.target.value)})} aria-label="Passing marks" placeholder="Passing marks" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Start Time</label>
                <input type="datetime-local" className="mt-1 w-full border rounded px-3 py-2" value={examForm.start_time} onChange={e => setExamForm({...examForm, start_time: e.target.value})} aria-label="Start time" />
              </div>
              <div>
                <label className="block text-sm font-medium">End Time</label>
                <input type="datetime-local" className="mt-1 w-full border rounded px-3 py-2" value={examForm.end_time} onChange={e => setExamForm({...examForm, end_time: e.target.value})} aria-label="End time" />
              </div>
            </div>
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2 bg-white sticky bottom-0">
            <button className="px-4 py-2 border rounded" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={async () => {
              try {
                await api.post('/exams', examForm);
                showSuccess('Exam created');
                setShowCreateModal(false);
                loadExams();
              } catch (error) {
                showError('Failed to create exam');
              }
            }}>Create</button>
          </div>
        </div>
      </div>

      {/* Edit Exam Modal */}
      <div className={`fixed inset-0 ${showEditModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditModal(false)} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-3 sticky top-0 bg-white">
            <h3 className="text-lg font-semibold">Edit Exam</h3>
            <button aria-label="Close" className="text-gray-500 hover:text-gray-700" onClick={() => setShowEditModal(false)}>
              <i className='bx bx-x text-2xl'></i>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium">Title</label>
              <input className="mt-1 w-full border rounded px-3 py-2" value={examForm.title} onChange={e => setExamForm({...examForm, title: e.target.value})} aria-label="Exam title" placeholder="Exam title" />
            </div>
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={examForm.description} onChange={e => setExamForm({...examForm, description: e.target.value})} aria-label="Exam description" placeholder="Description" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Subject</label>
                <select className="mt-1 w-full border rounded px-3 py-2" value={examForm.subject_id} onChange={e => setExamForm({...examForm, subject_id: Number(e.target.value)})} aria-label="Subject">
                  <option value={0}>Select subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Duration (min)</label>
                <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={examForm.duration} onChange={e => setExamForm({...examForm, duration: Number(e.target.value)})} aria-label="Duration" placeholder="Duration" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Total Marks</label>
                <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={examForm.total_marks} onChange={e => setExamForm({...examForm, total_marks: Number(e.target.value)})} aria-label="Total marks" placeholder="Total marks" />
              </div>
              <div>
                <label className="block text-sm font-medium">Passing Marks</label>
                <input type="number" className="mt-1 w-full border rounded px-3 py-2" value={examForm.passing_marks} onChange={e => setExamForm({...examForm, passing_marks: Number(e.target.value)})} aria-label="Passing marks" placeholder="Passing marks" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Start Time</label>
                <input type="datetime-local" className="mt-1 w-full border rounded px-3 py-2" value={examForm.start_time} onChange={e => setExamForm({...examForm, start_time: e.target.value})} aria-label="Start time" />
              </div>
              <div>
                <label className="block text-sm font-medium">End Time</label>
                <input type="datetime-local" className="mt-1 w-full border rounded px-3 py-2" value={examForm.end_time} onChange={e => setExamForm({...examForm, end_time: e.target.value})} aria-label="End time" />
              </div>
            </div>
          </div>
          <div className="border-t px-4 py-3 flex justify-end gap-2 bg-white sticky bottom-0">
            <button className="px-4 py-2 border rounded" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={async () => {
              try {
                if (editingExam) {
                  await api.put(`/exams/${editingExam.id}`, examForm);
                  showSuccess('Exam updated');
                  setShowEditModal(false);
                  setEditingExam(null);
                  loadExams();
                }
              } catch (error) {
                showError('Failed to update exam');
              }
            }}>Update</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ExamManagement;

