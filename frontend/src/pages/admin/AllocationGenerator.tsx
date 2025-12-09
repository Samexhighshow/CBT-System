import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Alert, Loading } from '../../components';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';

interface Exam {
  id: number;
  title: string;
  students_count?: number;
}

interface AllocationFormData {
  exam_id: number;
  mode: 'auto' | 'manual';
  seat_numbering: 'row_major' | 'column_major';
  adjacency_strictness: 'hard' | 'soft';
  notes: string;
  async: boolean;
}

const AllocationGenerator: React.FC = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [capacity, setCapacity] = useState<any>(null);

  const [formData, setFormData] = useState<AllocationFormData>({
    exam_id: 0,
    mode: 'auto',
    seat_numbering: 'row_major',
    adjacency_strictness: 'hard',
    notes: '',
    async: false,
  });

  useEffect(() => {
    fetchExams();
    fetchCapacity();
  }, []);

  const fetchExams = async () => {
    try {
      const response = await api.get('/exams');
      setExams(response.data.data || response.data.exams || response.data || []);
    } catch (err) {
      console.error('Failed to fetch exams:', err);
    }
  };

  const fetchCapacity = async () => {
    try {
      const response = await api.get('/halls/stats');
      setCapacity(response.data.stats);
    } catch (err) {
      console.error('Failed to fetch capacity:', err);
    }
  };

  const handleExamSelect = (examId: number) => {
    const exam = exams.find(e => e.id === examId);
    setSelectedExam(exam || null);
    setFormData({ ...formData, exam_id: examId });
  };

  const handleGenerate = async () => {
    setError('');
    setSuccess('');
    setGenerating(true);

    try {
      const response = await api.post('/allocations/generate', formData);

      if (response.data.is_async) {
        setSuccess(
          `Allocation job queued for ${selectedExam?.title}. ` +
          'This may take a few minutes for large exams. Check status in Allocation History.'
        );
        setTimeout(() => {
          navigate(`/admin/allocations/${response.data.allocation_run_id}`);
        }, 3000);
      } else {
        setSuccess(
          `Allocation completed! ${response.data.result.allocations_count} students seated ` +
          `across ${response.data.result.halls_used} halls. ` +
          (response.data.result.conflicts_count > 0
            ? `${response.data.result.conflicts_count} conflicts detected.`
            : 'No conflicts detected!')
        );
        setTimeout(() => {
          navigate(`/admin/allocations/${response.data.allocation_run_id}`);
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Allocation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = () => {
    return (
      formData.exam_id > 0 &&
      capacity &&
      capacity.total_capacity > 0 &&
      !generating
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Generate Seat Allocation</h1>
        <p className="text-gray-600">
          Automatically assign students to exam halls with intelligent seating
        </p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Capacity Check */}
      {capacity && (
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Active Halls</div>
              <div className="text-xl font-bold">{capacity.active_halls}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Capacity</div>
              <div className="text-xl font-bold text-green-600">{capacity.total_capacity}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Avg. Capacity</div>
              <div className="text-xl font-bold">{Math.round(capacity.average_capacity || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div className="text-sm">
                {capacity.total_capacity > 0 ? (
                  <span className="text-green-600 font-medium">✓ Ready</span>
                ) : (
                  <span className="text-red-600 font-medium">✗ No halls configured</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Form */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Exam Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Exam *
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={formData.exam_id}
              onChange={(e) => handleExamSelect(parseInt(e.target.value))}
              disabled={generating}
              aria-label="Select Exam"
            >
              <option value={0}>-- Choose an exam --</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                  {exam.students_count !== undefined && ` (${exam.students_count} students)`}
                </option>
              ))}
            </select>
          </div>

          {selectedExam && (
            <>
              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allocation Mode
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label
                    className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                      formData.mode === 'auto'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value="auto"
                      checked={formData.mode === 'auto'}
                      onChange={(e) => setFormData({ ...formData, mode: 'auto' })}
                      className="mr-2"
                      disabled={generating}
                    />
                    <span className="font-medium">Automatic</span>
                    <p className="text-sm text-gray-600 mt-1">
                      AI-powered placement with anti-cheating rules
                    </p>
                  </label>

                  <label
                    className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                      formData.mode === 'manual'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value="manual"
                      checked={formData.mode === 'manual'}
                      onChange={(e) => setFormData({ ...formData, mode: 'manual' })}
                      className="mr-2"
                      disabled={generating}
                    />
                    <span className="font-medium">Manual</span>
                    <p className="text-sm text-gray-600 mt-1">
                      Generate base allocation for manual adjustment
                    </p>
                  </label>
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {showAdvanced ? '− Hide' : '+ Show'} Advanced Options
                </button>
              </div>

              {showAdvanced && (
                <div className="border-t pt-4 space-y-4">
                  {/* Seat Numbering */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Seat Numbering Strategy
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      value={formData.seat_numbering}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seat_numbering: e.target.value as 'row_major' | 'column_major',
                        })
                      }
                      disabled={generating}
                      aria-label="Seat Numbering Strategy"
                    >
                      <option value="row_major">Row Major (left to right, top to bottom)</option>
                      <option value="column_major">Column Major (top to bottom, left to right)</option>
                    </select>
                  </div>

                  {/* Adjacency Strictness */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Adjacency Rules Strictness
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      value={formData.adjacency_strictness}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          adjacency_strictness: e.target.value as 'hard' | 'soft',
                        })
                      }
                      disabled={generating}
                      aria-label="Adjacency Rules Strictness"
                    >
                      <option value="hard">Hard (No same-class adjacency allowed)</option>
                      <option value="soft">Soft (Minimize adjacency, allow if necessary)</option>
                    </select>
                  </div>

                  {/* Async Option */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="async"
                      checked={formData.async}
                      onChange={(e) => setFormData({ ...formData, async: e.target.checked })}
                      className="mr-2"
                      disabled={generating}
                    />
                    <label htmlFor="async" className="text-sm text-gray-700">
                      Run in background (recommended for &gt;500 students)
                    </label>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add notes about this allocation run..."
                      disabled={generating}
                    />
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => navigate('/admin/allocations')}
                  disabled={generating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate()}
                  className="min-w-[200px]"
                >
                  {generating ? (
                    <>
                      <svg className="inline animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    '🎯 Generate Allocation'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Info Section */}
      <Card className="p-4 mt-6 bg-blue-50 border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">How It Works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Students are grouped by class level</li>
          <li>✓ Checkerboard seating pattern maximizes separation</li>
          <li>✓ Round-robin placement prevents same-class adjacency</li>
          <li>✓ Conflicts are automatically detected and resolved</li>
          <li>✓ Teachers can be assigned to halls after generation</li>
        </ul>
      </Card>
    </div>
  );
};

export default AllocationGenerator;
