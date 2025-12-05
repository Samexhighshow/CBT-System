import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Button, Alert, Loading } from '../../components';
import { api } from '../../services/api';

interface Teacher {
  id: number;
  name?: string;
  user?: {
    name: string;
    email: string;
  };
  email?: string;
}

interface Hall {
  id: number;
  name: string;
  rows: number;
  columns: number;
  teachers_needed: number;
  assignedTeachers?: Array<{
    teacher: Teacher;
    role: string;
  }>;
}

const TeacherAssignment: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<any>(null);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<{
    [hallId: number]: Array<{ teacher_id: number; role: string }>;
  }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Load data regardless of examId - show all halls and let admin assign teachers
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Load halls and teachers
      const [hallsRes, teachersRes] = await Promise.all([
        api.get('/halls'),
        api.get('/teachers'),
      ]);

      setHalls(hallsRes.data.data || hallsRes.data);
      setTeachers(teachersRes.data.data || teachersRes.data);
      
      // If examId is provided, load exam data
      if (examId) {
        try {
          const examRes = await api.get(`/exams/${examId}`);
          setExam(examRes.data);
        } catch (err) {
          console.warn('Failed to load exam data');
        }
      }

      // Initialize assignments from existing data
      const initialAssignments: any = {};
      (hallsRes.data.data || hallsRes.data).forEach((hall: Hall) => {
        if (hall.assignedTeachers) {
          initialAssignments[hall.id] = hall.assignedTeachers.map((a) => ({
            teacher_id: a.teacher.id,
            role: a.role,
          }));
        } else {
          initialAssignments[hall.id] = [];
        }
      });
      setAssignments(initialAssignments);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addTeacherSlot = (hallId: number) => {
    setAssignments((prev) => ({
      ...prev,
      [hallId]: [...(prev[hallId] || []), { teacher_id: 0, role: 'invigilator' }],
    }));
  };

  const removeTeacherSlot = (hallId: number, index: number) => {
    setAssignments((prev) => ({
      ...prev,
      [hallId]: prev[hallId].filter((_, i) => i !== index),
    }));
  };

  const updateAssignment = (
    hallId: number,
    index: number,
    field: 'teacher_id' | 'role',
    value: any
  ) => {
    setAssignments((prev) => ({
      ...prev,
      [hallId]: prev[hallId].map((a, i) =>
        i === index ? { ...a, [field]: field === 'teacher_id' ? parseInt(value) : value } : a
      ),
    }));
  };

  const saveAssignments = async (hallId: number) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post(`/halls/${hallId}/assign-teachers`, {
        exam_id: examId,
        teachers: assignments[hallId].filter((a) => a.teacher_id > 0),
      });
      setSuccess(`Teachers assigned to ${halls.find((h) => h.id === hallId)?.name} successfully`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const saveAllAssignments = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      for (const hall of halls) {
        if (assignments[hall.id] && assignments[hall.id].length > 0) {
          await api.post(`/halls/${hall.id}/assign-teachers`, {
            exam_id: examId,
            teachers: assignments[hall.id].filter((a) => a.teacher_id > 0),
          });
        }
      }
      setSuccess('All teacher assignments saved successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save some assignments');
    } finally {
      setSaving(false);
    }
  };

  const getAssignmentStatus = (hall: Hall) => {
    const assigned = assignments[hall.id]?.filter((a) => a.teacher_id > 0).length || 0;
    const needed = hall.teachers_needed;
    
    if (assigned === 0) return { text: 'Not Assigned', color: 'text-gray-500' };
    if (assigned < needed) return { text: `${assigned}/${needed}`, color: 'text-orange-600' };
    if (assigned === needed) return { text: 'Complete', color: 'text-green-600' };
    return { text: `${assigned}/${needed} (Over)`, color: 'text-blue-600' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loading />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Teacher Assignment</h1>
          <p className="text-gray-600">{exam?.title}</p>
          <p className="text-sm text-gray-500">
            Assign invigilators to exam halls
          </p>
        </div>
        <Button onClick={saveAllAssignments} disabled={saving} className="flex items-center gap-2">
          {saving ? 'Saving...' : <><i className='bx bx-save'></i> Save All Assignments</>}
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Halls</div>
          <div className="text-2xl font-bold">{halls.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Teachers Needed</div>
          <div className="text-2xl font-bold text-blue-600">
            {halls.reduce((sum, h) => sum + h.teachers_needed, 0)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Teachers Assigned</div>
          <div className="text-2xl font-bold text-green-600">
            {Object.values(assignments).reduce(
              (sum, arr) => sum + arr.filter((a) => a.teacher_id > 0).length,
              0
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Available Teachers</div>
          <div className="text-2xl font-bold">{teachers.length}</div>
        </Card>
      </div>

      {/* Hall Assignment Cards */}
      <div className="space-y-4">
        {halls.map((hall) => {
          const status = getAssignmentStatus(hall);
          return (
            <Card key={hall.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold">{hall.name}</h3>
                  <p className="text-sm text-gray-600">
                    Capacity: {hall.rows} × {hall.columns} = {hall.rows * hall.columns} seats | 
                    Teachers Needed: {hall.teachers_needed}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${status.color}`}>{status.text}</div>
                  <div className="flex space-x-2 mt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => addTeacherSlot(hall.id)}
                      className="flex items-center gap-1"
                    >
                      <i className='bx bx-plus'></i> Add Teacher
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveAssignments(hall.id)}
                      disabled={saving}
                      className="flex items-center gap-1"
                    >
                      <i className='bx bx-save'></i> Save
                    </Button>
                  </div>
                </div>
              </div>

              {/* Teacher Assignment Rows */}
              <div className="space-y-3">
                {(assignments[hall.id] || []).map((assignment, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="flex-1">
                      <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={assignment.teacher_id}
                        onChange={(e) =>
                          updateAssignment(hall.id, index, 'teacher_id', e.target.value)
                        }
                        title="Select teacher"
                      >
                        <option value={0}>-- Select Teacher --</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name || teacher.user?.name} (
                            {teacher.email || teacher.user?.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-40">
                      <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={assignment.role}
                        onChange={(e) => updateAssignment(hall.id, index, 'role', e.target.value)}
                        title="Select role"
                      >
                        <option value="invigilator">Invigilator</option>
                        <option value="chief_invigilator">Chief Invigilator</option>
                        <option value="assistant">Assistant</option>
                      </select>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => removeTeacherSlot(hall.id, index)}
                    >
                      <i className='bx bx-x'></i>
                    </Button>
                  </div>
                ))}

                {(!assignments[hall.id] || assignments[hall.id].length === 0) && (
                  <div className="text-center py-4 text-gray-500">
                    No teachers assigned yet. Click "Add Teacher" to start.
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {halls.length === 0 && (
        <Alert type="info" message="No exam halls configured yet. Please create halls first." />
      )}
    </div>
  );
};

export default TeacherAssignment;
