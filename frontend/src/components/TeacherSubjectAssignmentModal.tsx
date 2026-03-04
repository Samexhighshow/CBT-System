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
  const [scopeRows, setScopeRows] = useState<Array<{ subject_id: number; class_id: number }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
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
      setScopeRows([]);
      setSelectedSubjectId('');
      setSelectedClassId('');
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

  const rowKey = (row: { subject_id: number; class_id: number }) => `${row.subject_id}:${row.class_id}`;

  const handleAddPair = () => {
    if (!selectedSubjectId || !selectedClassId) {
      setError('Select both subject and class.');
      return;
    }

    const newRow = { subject_id: Number(selectedSubjectId), class_id: Number(selectedClassId) };
    if (scopeRows.some((r) => rowKey(r) === rowKey(newRow))) {
      setError('This subject + class pair is already added.');
      return;
    }

    setError('');
    setScopeRows((prev) => [...prev, newRow]);
  };

  const handleSubmit = async () => {
    if (scopeRows.length === 0) {
      setError('Please add at least one Subject + Class assignment');
      return;
    }

    if (requestReason.trim().length < 5) {
      setError('Reason is required (minimum 5 characters).');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post('/preferences/teacher/subjects', {
        subjects: scopeRows,
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

  const displayRows = useMemo(
    () =>
      scopeRows.map((row) => ({
        ...row,
        subject_name: subjects.find((s) => s.id === row.subject_id)?.name || `Subject #${row.subject_id}`,
        class_name: classes.find((c) => c.id === row.class_id)?.name || `Class #${row.class_id}`,
      })),
    [scopeRows, subjects, classes]
  );

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
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')}
                    className="border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                    className="border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select class</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddPair}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Add Pair
                  </button>
                </div>

                <div className="border border-gray-200 rounded">
                  {displayRows.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No scope pairs selected yet.</div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {displayRows.map((row) => (
                        <div key={`${row.subject_id}-${row.class_id}`} className="p-3 flex items-center justify-between">
                          <div className="text-sm text-gray-800">
                            {row.subject_name} � {row.class_name}
                          </div>
                          <button
                            type="button"
                            onClick={() => setScopeRows((prev) => prev.filter((x) => rowKey(x) !== rowKey(row)))}
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
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
            <Button onClick={handleSubmit} disabled={scopeRows.length === 0 || requestReason.trim().length < 5 || submitting} loading={submitting}>
              Submit for Approval ({scopeRows.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSubjectAssignmentModal;
