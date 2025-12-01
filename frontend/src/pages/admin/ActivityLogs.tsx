import React, { useState, useEffect } from 'react';
import { Card, Button, SkeletonTable } from '../../components';
import { api } from '../../services/api';
import { showError, showSuccess } from '../../utils/alerts';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface ActivityLog {
  id: number;
  log_name: string;
  description: string;
  subject_type: string | null;
  subject_id: number | null;
  event: string | null;
  causer_type: string | null;
  causer_id: number | null;
  properties: any;
  created_at: string;
  causer?: {
    id: number;
    name: string;
    email: string;
  };
}

interface ActivityStats {
  total_activities: number;
  today_activities: number;
  top_events: Array<{ event: string; count: number }>;
  top_users: Array<{ causer_id: number; count: number; causer: any }>;
}

const ActivityLogs: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    event: '',
    from_date: '',
    to_date: '',
    causer_id: '',
    search: '',
  });

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        ...(filters.event && { event: filters.event }),
        ...(filters.from_date && { from_date: filters.from_date }),
        ...(filters.to_date && { to_date: filters.to_date }),
        ...(filters.causer_id && { causer_id: filters.causer_id }),
        ...(filters.search && { search: filters.search }),
      });
      
      const response = await api.get(`/activity-logs?${params}`);
      if (response.data) {
        setLogs(response.data.data);
        setTotalPages(response.data.last_page);
      }
    } catch (error: any) {
      console.error('Failed to fetch activity logs:', error);
      showError('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/activity-logs/stats');
      if (response.data) {
        setStats(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    loadLogs();
    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]);

  useKeyboardShortcuts({
    onRefresh: loadLogs,
  });

  const handleCleanup = async () => {
    const daysInput = prompt('Delete logs older than how many days?', '90');
    if (!daysInput) return;

    try {
      const response = await api.delete('/activity-logs/cleanup', {
        data: { days: parseInt(daysInput) },
      });
      showSuccess(response.data.message);
      loadLogs();
      loadStats();
    } catch (error) {
      showError('Failed to cleanup logs');
    }
  };

  const getEventBadgeColor = (event: string | null) => {
    if (!event) return 'bg-gray-100 text-gray-800';
    const colors: Record<string, string> = {
      created: 'bg-green-100 text-green-800',
      updated: 'bg-blue-100 text-blue-800',
      deleted: 'bg-red-100 text-red-800',
      login: 'bg-purple-100 text-purple-800',
      logout: 'bg-gray-100 text-gray-800',
      exam_submitted: 'bg-orange-100 text-orange-800',
      graded: 'bg-indigo-100 text-indigo-800',
    };
    return colors[event] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-gray-600 mt-1">Monitor system activities and user actions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadLogs} variant="secondary">
            <i className='bx bx-refresh'></i>
            <span className="ml-2">Refresh</span>
          </Button>
          <Button onClick={handleCleanup} variant="secondary">
            <i className='bx bx-trash'></i>
            <span className="ml-2">Cleanup Old Logs</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-blue-50">
            <p className="text-sm text-gray-600">Total Activities</p>
            <h3 className="text-2xl font-bold text-blue-600 mt-1">
              {stats.total_activities.toLocaleString()}
            </h3>
          </Card>
          <Card className="bg-green-50">
            <p className="text-sm text-gray-600">Today's Activities</p>
            <h3 className="text-2xl font-bold text-green-600 mt-1">
              {stats.today_activities.toLocaleString()}
            </h3>
          </Card>
          <Card className="bg-purple-50">
            <p className="text-sm text-gray-600">Top Event</p>
            <h3 className="text-lg font-bold text-purple-600 mt-1">
              {stats.top_events[0]?.event || 'N/A'}
            </h3>
          </Card>
          <Card className="bg-orange-50">
            <p className="text-sm text-gray-600">Most Active User</p>
            <h3 className="text-sm font-bold text-orange-600 mt-1">
              {stats.top_users[0]?.causer?.name || 'N/A'}
            </h3>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search Description</label>
            <input
              type="text"
              placeholder="Search logs..."
              className="w-full border rounded px-3 py-2"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Event Type</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={filters.event}
              onChange={e => setFilters({ ...filters, event: e.target.value })}
              aria-label="Filter by event type"
            >
              <option value="">All Events</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="deleted">Deleted</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="exam_submitted">Exam Submitted</option>
              <option value="graded">Graded</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={filters.from_date}
              onChange={e => setFilters({ ...filters, from_date: e.target.value })}
              aria-label="Filter from date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={filters.to_date}
              onChange={e => setFilters({ ...filters, to_date: e.target.value })}
              aria-label="Filter to date"
            />
          </div>
        </div>
      </Card>

      {/* Activity Logs Table */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Activity History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <SkeletonTable rows={10} cols={5} />
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500 text-center" colSpan={5}>
                    No activity logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getEventBadgeColor(log.event)}`}>
                        {log.event || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.causer?.name || 'System'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.subject_type ? log.subject_type.split('\\').pop() : 'N/A'}
                      {log.subject_id ? ` #${log.subject_id}` : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <Button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              variant="secondary"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              variant="secondary"
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ActivityLogs;
