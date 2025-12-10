import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Alert, Loading } from '../../components';
import api from '../../services/api';

interface AllocationRun {
  id: number;
  exam: any;
  mode: string;
  seat_numbering: string;
  created_at: string;
  metadata: any;
}

interface Allocation {
  id: number;
  hall: any;
  student: any;
  row: number;
  column: number;
  seat_number: number;
  class_level: string;
}

interface Conflict {
  id: number;
  type: string;
  details: any;
  resolved: boolean;
  allocation: Allocation;
  conflictingAllocation: Allocation;
}

const AllocationViewer: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [run, setRun] = useState<AllocationRun | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHall, setSelectedHall] = useState<any>(null);
  const [gridLayout, setGridLayout] = useState<any>(null);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    if (runId) {
      fetchAllocationRun();
      fetchConflicts();
    }
  }, [runId]);

  const fetchAllocationRun = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/allocations/run/${runId}`);
      setRun(response.data.run);
      setAllocations(response.data.run.allocations || []);

      // Auto-select first hall
      const halls = getUniqueHalls(response.data.run.allocations || []);
      if (halls.length > 0) {
        selectHall(halls[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load allocation');
    } finally {
      setLoading(false);
    }
  };

  const fetchConflicts = async () => {
    try {
      const response = await api.get(`/allocations/conflicts/${runId}`);
      setConflicts(response.data.conflicts || []);
    } catch (err) {
      console.error('Failed to fetch conflicts:', err);
    }
  };

  const getUniqueHalls = (allocs: Allocation[]) => {
    const hallsMap = new Map();
    allocs.forEach((alloc) => {
      if (!hallsMap.has(alloc.hall.id)) {
        hallsMap.set(alloc.hall.id, alloc.hall);
      }
    });
    return Array.from(hallsMap.values());
  };

  const selectHall = async (hall: any) => {
    setSelectedHall(hall);
    try {
      const response = await api.get(`/halls/${hall.id}/grid-layout`, {
        params: { allocation_run_id: runId },
      });
      setGridLayout(response.data.grid);
    } catch (err) {
      console.error('Failed to fetch grid layout:', err);
    }
  };

  const getClassList = () => {
    const classes = new Set<string>();
    allocations.forEach((alloc) => {
      if (alloc.class_level) {
        classes.add(alloc.class_level);
      }
    });
    return Array.from(classes).sort();
  };

  const isConflictingSeat = (row: number, column: number) => {
    return conflicts.some(
      (c) =>
        (c.allocation.row === row && c.allocation.column === column) ||
        (c.conflictingAllocation.row === row && c.conflictingAllocation.column === column)
    );
  };

  const exportPDF = () => {
    window.open(`${api.defaults.baseURL}/allocations/export/pdf/${runId}`, '_blank');
  };

  const exportExcel = () => {
    window.open(`${api.defaults.baseURL}/allocations/export/excel/${runId}`, '_blank');
  };

  const handleRegenerate = async () => {
    if (!window.confirm('This will create a new allocation run. Continue?')) return;

    try {
      const response = await api.post(`/allocations/regenerate/${runId}`);
      navigate(`/admin/allocations/${response.data.allocation_run_id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to regenerate');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loading />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6">
        <Alert type="error" message="Allocation run not found" />
      </div>
    );
  }

  const halls = getUniqueHalls(allocations);

  return (
    <div className="app-shell section-shell">
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Seat Allocation Viewer</h1>
            <p className="text-xs md:text-sm text-gray-600">{run.exam.title}</p>
            <p className="text-xs text-gray-500 mt-1">
              Generated: {new Date(run.created_at).toLocaleString()} | Mode: {run.mode}
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-1.5">
            <Button variant="secondary" onClick={exportPDF} className="text-xs md:text-sm py-1.5 px-2">
              📄 Export PDF
            </Button>
            <Button variant="secondary" onClick={exportExcel} className="text-xs md:text-sm py-1.5 px-2">
              📊 Export Excel
            </Button>
            <Button onClick={handleRegenerate} className="text-xs md:text-sm py-1.5 px-2">🔄 Regenerate</Button>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3 mb-4">
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Total Students</div>
          <div className="text-lg md:text-xl font-bold">{run.metadata?.total_students || 0}</div>
        </Card>
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Halls Used</div>
          <div className="text-lg md:text-xl font-bold text-blue-600">{halls.length}</div>
        </Card>
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Conflicts</div>
          <div className={`text-lg md:text-xl font-bold ${conflicts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {run.metadata?.total_conflicts || 0}
          </div>
        </Card>
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Unresolved</div>
          <div className="text-lg md:text-xl font-bold text-orange-600">
            {conflicts.filter((c) => !c.resolved).length}
          </div>
        </Card>
        <Card className="panel-compact">
          <div className="text-xs md:text-sm text-gray-600">Seat Numbering</div>
          <div className="text-xs md:text-sm font-medium">
            {run.seat_numbering === 'row_major' ? 'Row Major' : 'Column Major'}
          </div>
        </Card>
      </div>

      {/* Hall Tabs */}
      <div className="mb-3 flex space-x-1.5 overflow-x-auto">
        {halls.map((hall) => (
          <button
            key={hall.id}
            onClick={() => selectHall(hall)}
            className={`px-4 py-2 rounded-t-lg whitespace-nowrap ${
              selectedHall?.id === hall.id
                ? 'bg-white border-t-2 border-x-2 border-blue-500 font-medium'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {hall.name}
            <span className="ml-2 text-sm text-gray-600">
              ({allocations.filter((a) => a.hall.id === hall.id).length}/{hall.capacity})
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Filter by Class:</label>
        <select
          className="border border-gray-300 rounded-md px-3 py-1"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Filter by Class"
        >
          <option value="all">All Classes</option>
          {getClassList().map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>

        <div className="flex items-center space-x-4 ml-auto text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 mr-2"></div>
            <span>Occupied</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 border border-red-400 mr-2"></div>
            <span>Conflict</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-50 border border-gray-300 mr-2"></div>
            <span>Empty</span>
          </div>
        </div>
      </div>

      {/* Seating Grid */}
      {selectedHall && gridLayout && (
        <Card className="p-6 overflow-x-auto">
          <h3 className="text-lg font-bold mb-4">{selectedHall.name} - Seating Chart</h3>
          <div className="inline-block min-w-full">
            {Object.keys(gridLayout).map((rowKey) => {
              const row = parseInt(rowKey);
              return (
                <div key={row} className="flex">
                  {Object.keys(gridLayout[row]).map((colKey) => {
                    const col = parseInt(colKey);
                    const cell = gridLayout[row][col];
                    const student = cell.student;
                    const hasConflict = isConflictingSeat(row, col);
                    const matchesFilter =
                      classFilter === 'all' ||
                      (student && student.class_level === classFilter);

                    return (
                      <div
                        key={`${row}-${col}`}
                        className={`
                          border border-gray-300 p-2 m-0.5 min-w-[80px] min-h-[60px] text-xs
                          ${
                            student
                              ? hasConflict
                                ? 'bg-red-100 border-red-400'
                                : matchesFilter
                                ? 'bg-blue-100 border-blue-300'
                                : 'bg-gray-100'
                              : 'bg-gray-50'
                          }
                        `}
                        title={
                          student
                            ? `${student.name || student.user?.name} (${student.class_level})`
                            : 'Empty'
                        }
                      >
                        <div className="font-bold text-center">{cell.seat_number}</div>
                        {student && (
                          <>
                            <div className="text-center truncate">
                              {(student.name || student.user?.name || '').substring(0, 12)}
                            </div>
                            <div className="text-center text-gray-600">{student.class_level}</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Conflicts List */}
      {conflicts.length > 0 && (
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-bold mb-4 text-red-600">
            Adjacency Conflicts ({conflicts.filter((c) => !c.resolved).length} Unresolved)
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {conflicts.map((conflict, idx) => (
              <div
                key={conflict.id}
                className={`p-3 rounded border ${
                  conflict.resolved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">
                      {conflict.type.replace(/_/g, ' ')}
                    </span>
                    <div className="text-sm text-gray-700 mt-1">
                      {conflict.allocation.student?.name} (Row {conflict.allocation.row}, Col{' '}
                      {conflict.allocation.column}) ↔{' '}
                      {conflict.conflictingAllocation.student?.name} (Row{' '}
                      {conflict.conflictingAllocation.row}, Col{' '}
                      {conflict.conflictingAllocation.column})
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Class: {conflict.details.class}
                    </div>
                  </div>
                  {conflict.resolved ? (
                    <span className="text-green-600 text-sm">✓ Resolved</span>
                  ) : (
                    <span className="text-red-600 text-sm">⚠ Unresolved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AllocationViewer;
