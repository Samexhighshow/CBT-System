import React, { useEffect, useState } from 'react';
import { Card } from '../../components';
import { api } from '../../services/api';
import { showConfirm, showError, showSuccess } from '../../utils/alerts';

interface ScopeRow {
  id: number;
  subject_id: number;
  subject_name: string;
  class_id: number;
  class_name: string;
}

interface PendingRequest {
  batch_id: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  reason: string;
  requested_at: string;
  requested_scopes: ScopeRow[];
  current_approved_scopes: ScopeRow[];
}

const TeacherScopeRequests: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [processingBatch, setProcessingBatch] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/teacher-scope-requests');
      const rows = Array.isArray(res?.data?.pending_requests) ? res.data.pending_requests : [];
      setRequests(rows);
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to load pending teacher scope requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const approveBatch = async (batchId: string) => {
    const ok = await showConfirm('Approve this teacher scope change request?');
    if (!ok) return;

    try {
      setProcessingBatch(batchId);
      await api.post(`/admin/teacher-scope-requests/${encodeURIComponent(batchId)}/approve`);
      showSuccess('Scope request approved and active assignment updated.');
      await loadRequests();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to approve scope request');
    } finally {
      setProcessingBatch(null);
    }
  };

  const rejectBatch = async (batchId: string) => {
    const reason = window.prompt('Enter rejection reason:')?.trim() || '';
    if (!reason) {
      showError('Rejection reason is required');
      return;
    }

    try {
      setProcessingBatch(batchId);
      await api.post(`/admin/teacher-scope-requests/${encodeURIComponent(batchId)}/reject`, { reason });
      showSuccess('Scope request rejected.');
      await loadRequests();
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Failed to reject scope request');
    } finally {
      setProcessingBatch(null);
    }
  };

  return (
    <div className="app-shell section-shell space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Teacher Scope Change Requests</h1>
          <p className="text-sm text-gray-600 mt-1">Review and approve or reject pending teacher assignment changes.</p>
        </div>
        <button
          type="button"
          onClick={loadRequests}
          className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <Card>
          <div className="py-8 text-center text-gray-500">Loading pending requests...</div>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-gray-500">No pending teacher scope requests.</div>
        </Card>
      ) : (
        requests.map((request) => (
          <Card key={request.batch_id} className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{request.user.name}</h2>
                <p className="text-sm text-gray-600">{request.user.email}</p>
                <p className="text-sm text-gray-700 mt-2">
                  <span className="font-medium">Reason:</span> {request.reason || 'No reason provided'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => approveBatch(request.batch_id)}
                  disabled={processingBatch === request.batch_id}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processingBatch === request.batch_id ? 'Working...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => rejectBatch(request.batch_id)}
                  disabled={processingBatch === request.batch_id}
                  className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-60"
                >
                  {processingBatch === request.batch_id ? 'Working...' : 'Reject'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded border border-gray-200 p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Assignment (Approved)</h3>
                {request.current_approved_scopes.length === 0 ? (
                  <p className="text-xs text-gray-500">No current approved scope.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {request.current_approved_scopes.map((row) => (
                      <span key={row.id} className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                        {row.subject_name} • {row.class_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded border border-blue-200 bg-blue-50 p-3">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Requested Assignment</h3>
                <div className="flex flex-wrap gap-1.5">
                  {request.requested_scopes.map((row) => (
                    <span key={row.id} className="px-2 py-0.5 rounded text-xs bg-white border border-blue-200 text-blue-800">
                      {row.subject_name} • {row.class_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default TeacherScopeRequests;
