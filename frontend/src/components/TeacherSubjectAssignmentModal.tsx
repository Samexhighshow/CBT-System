import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { showSuccess, showError } from '../utils/alerts';
import Card from './Card';
import Button from './Button';
import Alert from './Alert';

interface Subject {
  id: number;
  name: string;
  code?: string;
}

interface SchoolClass {
  id: number;
  name: string;
}

interface TeacherSubjectAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TeacherSubjectAssignmentModal: React.FC<TeacherSubjectAssignmentModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set());
  const [assignments, setAssignments] = useState<Array<{ class_id: number; class_name: string; subject_ids: number[]; subject_names: string[] }>>([]);
  const [requestReason, setRequestReason] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingInfo, setPendingInfo] = useState<{ pending_count?: number; rejected_count?: number; latest_rejection_reason?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    } else {
      setSubjects([]);
      setClasses([]);
      setSelectedClassId('');
      setSelectedSubjectIds(new Set());
      setAssignments([]);
      setRequestReason('');
      setError('');
      setPendingInfo(null);
    }
  }, [isOpen]);

  const loadOptions = async () => {
    setLoadingSubjects(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('Session not ready. Please wait a moment and retry.');
        return;
      }

      const [optionsRes, statusRes] = await Promise.all([
        api.get('/preferences/options', { skipGlobalLoading: true } as any),
        api.get('/preferences/teacher/scope-status', { skipGlobalLoading: true } as any),
      ]);

      const options = optionsRes?.data || {};
      const subjectRows = Array.isArray(options?.subjects) ? options.subjects : [];
      const classRows = Array.isArray(options?.classes) ? options.classes : [];
      setSubjects(
        subjectRows
          .map((row: any) => ({ id: Number(row.id), name: String(row.name || '') }))
          .filter((row: Subject) => row.id > 0 && row.name)
      );
      setClasses(
        classRows
          .map((row: any) => ({ id: Number(row.id), name: String(row.name || '') }))
          .filter((row: SchoolClass) => row.id > 0 && row.name)
      );

      setPendingInfo(statusRes?.data || null);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Failed to load subjects and classes. Please try again.';
      setError(errorMsg);
      setSubjects([]);
      setClasses([]);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleToggleSubject = (subjectId: number) => {
    setSelectedSubjectIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subjectId)) {
        newSet.delete(subjectId);
      } else {
        newSet.add(subjectId);
      }
      return newSet;
    });
  };

  const handleAddClassAssignment = () => {
    if (!selectedClassId) {
      setError('Please select a class.');
      return;
    }

    if (selectedSubjectIds.size === 0) {
      setError('Please select at least one subject.');
      return;
    }

    // Check if this class already has an assignment
    if (assignments.some((a) => a.class_id === Number(selectedClassId))) {
      setError('This class is already added. Remove it first to modify.');
      return;
    }

    const selectedClass = classes.find((c) => c.id === Number(selectedClassId));
    const selectedSubjects = subjects.filter((s) => selectedSubjectIds.has(s.id));

    if (!selectedClass) {
      setError('Invalid class selection.');
      return;
    }

    const newAssignment = {
      class_id: Number(selectedClassId),
      class_name: selectedClass.name,
      subject_ids: Array.from(selectedSubjectIds),
      subject_names: selectedSubjects.map((s) => s.name),
    };

    setError('');
    setAssignments((prev) => [...prev, newAssignment]);
    setSelectedClassId('');
    setSelectedSubjectIds(new Set());
  };

  const handleRemoveAssignment = (classId: number) => {
    setAssignments((prev) => prev.filter((a) => a.class_id !== classId));
  };

  const handleSubmit = async () => {
    if (assignments.length === 0) {
      setError('Please add at least one class with subjects.');
      return;
    }

    if (requestReason.trim().length < 5) {
      setError('Reason is required (minimum 5 characters).');
      return;
    }

    // Convert to API format: flat array of subject+class pairs
    const scopePairs: Array<{ subject_id: number; class_id: number }> = [];
    assignments.forEach((assignment) => {
      assignment.subject_ids.forEach((subjectId) => {
        scopePairs.push({
          subject_id: subjectId,
          class_id: assignment.class_id,
        });
      });
    });

    setSubmitting(true);
    setError('');

    try {
      await api.post('/preferences/teacher/subjects', {
        subjects: scopePairs,
        reason: requestReason.trim(),
      });

      showSuccess('Scope request submitted for approval');
      onComplete();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to submit scope request';
      showError(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalPairs = useMemo(() => {
    return assignments.reduce((sum, a) => sum + a.subject_ids.length, 0);
  }, [assignments]);

  const availableSubjects = useMemo(() => {
    if (!selectedClassId) return subjects;
    // Can filter by class level if needed
    return subjects;
  }, [subjects, selectedClassId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome, Teacher</h2>
            <p className="text-gray-600">
              Select Subject + Class pairs and submit for admin approval before module access is enabled.
            </p>
          </div>

          {error && (
            <div className="space-y-2">
              <Alert type="error" message={error} onClose={() => setError('')} />
              <button
                type="button"
                onClick={loadOptions}
                className="text-xs font-medium text-blue-700 underline"
              >
                Retry loading options
              </button>
            </div>
          )}

          <Card>
            <h3 className="text-lg font-semibold mb-4">Request Teaching Scope</h3>
            {pendingInfo && (
              <div className="mb-3 text-xs text-gray-600">
                Pending: {pendingInfo.pending_count || 0} � Rejected: {pendingInfo.rejected_count || 0}
                {pendingInfo.latest_rejection_reason ? ` � Last rejection: ${pendingInfo.latest_rejection_reason}` : ''}
              </div>
            )}

            {loadingSubjects ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading options...</p>
              </div>
            ) : !Array.isArray(subjects) || subjects.length === 0 || classes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No subjects/classes available. Please contact an administrator.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Step 1: Select Class */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    1. Select Class
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value ? Number(e.target.value) : '');
                      setSelectedSubjectIds(new Set());
                    }}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={assignments.length > 0 && selectedClassId === ''}
                  >
                    <option value="">Choose a class...</option>
                    {classes
                      .filter((c) => !assignments.some((a) => a.class_id === c.id))
                      .map((schoolClass) => (
                        <option key={schoolClass.id} value={schoolClass.id}>
                          {schoolClass.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Step 2: Select Multiple Subjects */}
                {selectedClassId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      2. Select Subjects for {classes.find((c) => c.id === Number(selectedClassId))?.name} (check multiple)
                    </label>
                    <div className="border rounded p-3 max-h-64 overflow-y-auto bg-gray-50">
                      {availableSubjects.length === 0 ? (
                        <p className="text-sm text-gray-500">No subjects available</p>
                      ) : (
                        <div className="space-y-2">
                          {availableSubjects.map((subject) => (
                            <label
                              key={subject.id}
                              className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSubjectIds.has(subject.id)}
                                onChange={() => handleToggleSubject(subject.id)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-800">{subject.name}</span>
                              {subject.code && (
                                <span className="text-xs text-gray-500">({subject.code})</span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      {selectedSubjectIds.size} subject{selectedSubjectIds.size !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                )}

                {/* Add Button */}
                {selectedClassId && (
                  <button
                    type="button"
                    onClick={handleAddClassAssignment}
                    disabled={selectedSubjectIds.size === 0}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add {classes.find((c) => c.id === Number(selectedClassId))?.name} + {selectedSubjectIds.size} Subject{selectedSubjectIds.size !== 1 ? 's' : ''}
                  </button>
                )}

                {/* Display Added Assignments */}
                <div className="border border-gray-200 rounded">
                  {assignments.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      No assignments added yet. Select a class and subjects above.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {assignments.map((assignment) => (
                        <div key={assignment.class_id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 mb-1">
                                {assignment.class_name}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {assignment.subject_names.map((name, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {assignment.subject_ids.length} subject{assignment.subject_ids.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAssignment(assignment.class_id)}
                              className="ml-3 text-xs px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for request</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    rows={3}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="Explain why you need this assignment"
                  />
                </div>
              </div>
            )}
          </Card>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Skip for Now
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={assignments.length === 0 || requestReason.trim().length < 5 || submitting}
              loading={submitting}
            >
              Submit for Approval ({totalPairs} assignment{totalPairs !== 1 ? 's' : ''})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSubjectAssignmentModal;
