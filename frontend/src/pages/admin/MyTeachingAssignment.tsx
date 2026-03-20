import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess, showConfirm } from '../../utils/alerts';

interface ScopeOption {
  id: number;
  name: string;
}

interface ScopeRow {
  id: number;
  subject_id: number;
  subject_name: string;
  class_id: number;
  class_name: string;
}

interface PendingRequest {
  batch_id: string;
  reason: string;
  created_at: string;
  scopes: ScopeRow[];
}

interface AssignmentPayload {
  current_approved_scopes: ScopeRow[];
  pending_request: PendingRequest | null;
  latest_rejection: {
    reason: string;
    reviewed_at: string;
  } | null;
}

const MyTeachingAssignment: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const [subjects, setSubjects] = useState<ScopeOption[]>([]);
  const [classes, setClasses] = useState<ScopeOption[]>([]);
  const [assignment, setAssignment] = useState<AssignmentPayload>({
    current_approved_scopes: [],
    pending_request: null,
    latest_rejection: null,
  });

  const [draftRows, setDraftRows] = useState<Array<{ subject_id: number; class_id: number }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [reason, setReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [optionsRes, assignmentRes] = await Promise.all([
        api.get('/preferences/options'),
        api.get('/preferences/teacher/assignment'),
      ]);

      const options = optionsRes?.data || {};
      const subjectRows = Array.isArray(options?.subjects) ? options.subjects : [];
      const classRows = Array.isArray(options?.classes) ? options.classes : [];

      setSubjects(
        subjectRows
          .map((row: any) => ({ id: Number(row.id), name: String(row.name || '') }))
          .filter((row: ScopeOption) => row.id > 0 && row.name)
      );
      setClasses(
        classRows
          .map((row: any) => ({ id: Number(row.id), name: String(row.name || '') }))
          .filter((row: ScopeOption) => row.id > 0 && row.name)
      );

      const payload = (assignmentRes?.data || {}) as AssignmentPayload;
      setAssignment({
        current_approved_scopes: Array.isArray(payload.current_approved_scopes) ? payload.current_approved_scopes : [],
        pending_request: payload.pending_request || null,
        latest_rejection: payload.latest_rejection || null,
      });
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load teaching assignment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingExists = Boolean(assignment.pending_request);

  const draftRowsDisplay = useMemo(() => {
    return draftRows.map((row) => ({
      ...row,
      subject_name: subjects.find((item) => item.id === row.subject_id)?.name || `Subject ${row.subject_id}`,
      class_name: classes.find((item) => item.id === row.class_id)?.name || `Class ${row.class_id}`,
    }));
  }, [draftRows, subjects, classes]);

  const handleAddPair = () => {
    const subjectId = Number(selectedSubjectId);
    const classId = Number(selectedClassId);

    if (!subjectId || !classId) {
      showError('Select both subject and class');
      return;
    }

    const exists = draftRows.some((row) => row.subject_id === subjectId && row.class_id === classId);
    if (exists) {
      showError('This subject + class pair is already added');
      return;
    }

    setDraftRows((prev) => [...prev, { subject_id: subjectId, class_id: classId }]);
  };

  const submitRequest = async () => {
    if (pendingExists) {
      showError('You already have a pending request. Cancel it first before submitting another.');
      return;
    }

    if (draftRows.length === 0) {
      showError('Add at least one Subject + Class pair');
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      showError('Reason is required (minimum 5 characters).');
      return;
    }

    const ok = await showConfirm('Submit this scope change request for admin approval?');
    if (!ok) return;

    try {
      setSaving(true);
      await api.post('/preferences/teacher/scope-requests', {
        subjects: draftRows,
        reason: trimmedReason,
      });
      showSuccess('Request submitted successfully. Waiting for admin review.');
      setDraftRows([]);
      setReason('');
      setShowRequestForm(false);
      await loadData();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const cancelPendingRequest = async () => {
    const pending = assignment.pending_request;
    if (!pending) return;

    const ok = await showConfirm('Cancel your pending request?');
    if (!ok) return;

    try {
      setCancelling(true);
      await api.delete('/preferences/teacher/scope-requests/pending', {
        data: { batch_id: pending.batch_id },
      });
      showSuccess('Pending request cancelled.');
      await loadData();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell section-shell">
        <Card>
          <div className="py-8 text-center text-gray-500">Loading teaching assignment...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell section-shell space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Teaching Assignment</h1>
        <p className="text-sm text-gray-600 mt-1">View approved scope and request subject/class assignment changes.</p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Current Assignment (Approved)</h2>
        {assignment.current_approved_scopes.length === 0 ? (
          <p className="text-sm text-amber-700">No approved assignment yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignment.current_approved_scopes.map((row) => (
              <span key={row.id} className="px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-800">
                {row.subject_name} • {row.class_name}
              </span>
            ))}
          </div>
        )}
      </Card>

      {assignment.pending_request && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-amber-800">Pending Request</h2>
              <p className="text-sm text-gray-600 mt-1">Submitted and waiting for admin review.</p>
              <p className="text-sm text-gray-700 mt-2">
                <span className="font-medium">Reason:</span> {assignment.pending_request.reason}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {assignment.pending_request.scopes.map((row) => (
                  <span key={row.id} className="px-2.5 py-1 rounded-full text-xs bg-amber-100 text-amber-800">
                    {row.subject_name} • {row.class_name}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={cancelPendingRequest}
              disabled={cancelling}
              className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Request'}
            </button>
          </div>
        </Card>
      )}

      {assignment.latest_rejection?.reason && !assignment.pending_request && (
        <Card>
          <h2 className="text-lg font-semibold text-red-800">Last Rejection</h2>
          <p className="text-sm text-red-700 mt-1">{assignment.latest_rejection.reason}</p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Request Scope Change</h2>
          <button
            type="button"
            onClick={() => setShowRequestForm((prev) => !prev)}
            disabled={pendingExists}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {showRequestForm ? 'Hide Form' : 'Request Change'}
          </button>
        </div>

        {pendingExists && (
          <p className="text-sm text-amber-700 mb-3">You already have a pending request. Wait for review or cancel it first.</p>
        )}

        {showRequestForm && !pendingExists && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>

              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddPair}
                className="px-3 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                Add Pair
              </button>
            </div>

            <div className="border border-gray-200 rounded p-3">
              {draftRowsDisplay.length === 0 ? (
                <p className="text-sm text-gray-500">No requested pairs yet.</p>
              ) : (
                <div className="space-y-2">
                  {draftRowsDisplay.map((row) => (
                    <div key={`${row.subject_id}-${row.class_id}`} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
                      <span className="text-sm text-gray-800">{row.subject_name} • {row.class_name}</span>
                      <button
                        type="button"
                        onClick={() => setDraftRows((prev) => prev.filter((item) => !(item.subject_id === row.subject_id && item.class_id === row.class_id)))}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for change <span className="text-red-500">*</span></label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Explain why you need this subject/class reassignment"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={submitRequest}
                disabled={saving || draftRows.length === 0 || reason.trim().length < 5}
                className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MyTeachingAssignment;
