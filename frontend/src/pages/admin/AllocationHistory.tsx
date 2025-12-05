import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Alert, Loading } from '../../components';
import api from '../../services/api';

interface Exam {
  id: number;
  title: string;
  exam_date: string;
}

interface AllocationRun {
  id: number;
  exam: Exam;
  mode: string;
  seat_numbering: string;
  created_at: string;
  completed_at: string | null;
  created_by: {
    name: string;
  };
  metadata: {
    total_students?: number;
    total_conflicts?: number;
    unresolved_conflicts?: number;
    halls_used?: number;
    class_distribution?: any;
  };
}

const AllocationHistory: React.FC = () => {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState<AllocationRun[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchAllocations();
    }
  }, [selectedExam]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const response = await api.get('/exams');
      setExams(response.data.data || response.data);
      if (response.data.data?.length > 0) {
        setSelectedExam(response.data.data[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllocations = async () => {
    if (!selectedExam) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/allocations/exam/${selectedExam}`);
      setAllocations(response.data.allocations || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load allocations');
    } finally {
      setLoading(false);
    }
  };

  const viewAllocation = (runId: number) => {
    navigate(`/admin/allocations/${runId}`);
  };

  const regenerateAllocation = async (runId: number) => {
    if (!confirm('This will create a new allocation run. Continue?')) return;

    try {
      const response = await api.post(`/allocations/regenerate/${runId}`);
      navigate(`/admin/allocations/${response.data.allocation_run_id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to regenerate');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getModeLabel = (mode: string) => {
    return mode === 'auto' ? '🤖 Auto' : '✋ Manual';
  };

  const getNumberingLabel = (numbering: string) => {
    return numbering === 'row_major' ? 'Row Major' : 'Column Major';
  };

  const getStatusBadge = (run: AllocationRun) => {
    if (!run.completed_at) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">⏳ Processing</span>;
    }
    
    const conflicts = run.metadata?.unresolved_conflicts || 0;
    if (conflicts > 0) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">⚠ {conflicts} Conflicts</span>;
    }
    
    return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ Complete</span>;
  };

  if (loading && exams.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loading />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Allocation History</h1>
        <p className="text-gray-600">View past seat allocation runs</p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Exam Selector */}
      <Card className="p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
        <select
          className="w-full md:w-96 border border-gray-300 rounded-md px-3 py-2"
          value={selectedExam || ''}
          onChange={(e) => setSelectedExam(parseInt(e.target.value))}
          title="Select exam to view allocation history"
        >
          <option value="">-- Select Exam --</option>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.title} ({new Date(exam.exam_date).toLocaleDateString()})
            </option>
          ))}
        </select>
      </Card>

      {selectedExam && (
        <>
          {/* Summary Stats */}
          {allocations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4">
                <div className="text-sm text-gray-600">Total Runs</div>
                <div className="text-2xl font-bold">{allocations.length}</div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-600">Latest Run</div>
                <div className="text-sm font-medium">
                  {formatDate(allocations[0]?.created_at || '')}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-600">Completed Runs</div>
                <div className="text-2xl font-bold text-green-600">
                  {allocations.filter((a) => a.completed_at).length}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-600">Success Rate</div>
                <div className="text-2xl font-bold text-blue-600">
                  {allocations.length > 0
                    ? Math.round(
                        (allocations.filter(
                          (a) => a.completed_at && (a.metadata?.unresolved_conflicts || 0) === 0
                        ).length /
                          allocations.length) *
                          100
                      )
                    : 0}
                  %
                </div>
              </Card>
            </div>
          )}

          {/* Allocations List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loading />
            </div>
          ) : allocations.length === 0 ? (
            <Alert type="info" message="No allocations found for this exam yet." />
          ) : (
            <div className="space-y-4">
              {allocations.map((run) => (
                <Card key={run.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-bold">Run #{run.id}</h3>
                        {getStatusBadge(run)}
                        <span className="text-sm text-gray-600">{getModeLabel(run.mode)}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <div className="text-xs text-gray-600">Students</div>
                          <div className="font-medium">{run.metadata?.total_students || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Halls Used</div>
                          <div className="font-medium">{run.metadata?.halls_used || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Conflicts</div>
                          <div
                            className={`font-medium ${
                              (run.metadata?.total_conflicts || 0) > 0
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}
                          >
                            {run.metadata?.total_conflicts || 0}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Seat Numbering</div>
                          <div className="font-medium text-sm">
                            {getNumberingLabel(run.seat_numbering)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                        <span>👤 {run.created_by.name}</span>
                        <span>📅 {formatDate(run.created_at)}</span>
                        {run.completed_at && (
                          <span>✓ Completed {formatDate(run.completed_at)}</span>
                        )}
                      </div>

                      {/* Class Distribution */}
                      {run.metadata?.class_distribution && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(run.metadata.class_distribution).map(([cls, count]) => (
                            <span
                              key={cls}
                              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                            >
                              {cls}: {count as number}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      <Button size="sm" onClick={() => viewAllocation(run.id)}>
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => regenerateAllocation(run.id)}
                      >
                        🔄 Regenerate
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {!selectedExam && exams.length > 0 && (
        <Alert type="info" message="Please select an exam to view allocation history." />
      )}
    </div>
  );
};

export default AllocationHistory;
