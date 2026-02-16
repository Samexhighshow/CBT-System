import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card } from '../../components';
import offlineDB, { AttemptRecord, SyncQueueItem } from '../../services/offlineDB';
import syncService from '../../services/syncService';

interface MetaMap {
  [key: string]: any;
}

const downloadJson = (fileName: string, data: unknown): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const SyncDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [meta, setMeta] = useState<MetaMap>({});
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [queue, attemptsData, metaEntries] = await Promise.all([
      offlineDB.syncQueue.orderBy('createdAt').reverse().toArray(),
      offlineDB.attempts.toArray(),
      offlineDB.meta.toArray(),
    ]);

    const metaMap: MetaMap = {};
    metaEntries.forEach((entry) => {
      metaMap[entry.key] = entry.value;
    });

    setQueueItems(queue);
    setAttempts(attemptsData);
    setMeta(metaMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 15000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const attemptMap = useMemo(() => {
    const map = new Map<string, AttemptRecord>();
    attempts.forEach((attempt) => map.set(attempt.attemptId, attempt));
    return map;
  }, [attempts]);

  const pendingCount = queueItems.filter((item) => item.status === 'PENDING').length;
  const failedCount = queueItems.filter((item) => item.status === 'FAILED').length;
  const doneCount = queueItems.filter((item) => item.status === 'DONE').length;
  const inProgressCount = attempts.filter((attempt) => attempt.status === 'IN_PROGRESS').length;

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await syncService.runFullSync();
    } finally {
      setSyncing(false);
      loadData();
    }
  };

  const handleClearDone = async () => {
    await offlineDB.syncQueue.where('status').equals('DONE').delete();
    loadData();
  };

  const handleRetryFailed = async () => {
    await offlineDB.syncQueue
      .where('status')
      .equals('FAILED')
      .modify({ status: 'PENDING', lastError: undefined, lastTriedAt: undefined });
    loadData();
  };

  const handleExportAttempt = async (attemptId: string) => {
    const [attempt, answers, cheatLogs, syncItems] = await Promise.all([
      offlineDB.attempts.get(attemptId),
      offlineDB.answers.where('attemptId').equals(attemptId).toArray(),
      offlineDB.cheatLogs.where('attemptId').equals(attemptId).toArray(),
      offlineDB.syncQueue.where('entityId').equals(attemptId).toArray(),
    ]);

    const payload = {
      attempt,
      answers,
      cheatLogs,
      syncQueue: syncItems,
      exportedAt: new Date().toISOString(),
    };

    const fileName = `offline-attempt-${attemptId}.json`;
    downloadJson(fileName, payload);
  };

  const handleExportPending = async () => {
    const pending = queueItems.filter((item) => item.status === 'PENDING');
    const uniqueAttempts = Array.from(new Set(
      pending
        .filter((item) => item.type === 'SUBMIT_ATTEMPT')
        .map((item) => item.entityId)
    ));
    const exports = [] as Array<{ attemptId: string; payload: unknown }>;

    for (const attemptId of uniqueAttempts) {
      const [attempt, answers, cheatLogs, syncItems] = await Promise.all([
        offlineDB.attempts.get(attemptId),
        offlineDB.answers.where('attemptId').equals(attemptId).toArray(),
        offlineDB.cheatLogs.where('attemptId').equals(attemptId).toArray(),
        offlineDB.syncQueue.where('entityId').equals(attemptId).toArray(),
      ]);

      exports.push({
        attemptId,
        payload: {
          attempt,
          answers,
          cheatLogs,
          syncQueue: syncItems,
        },
      });
    }

    downloadJson('offline-pending-attempts.json', {
      exportedAt: new Date().toISOString(),
      total: exports.length,
      attempts: exports,
    });
  };

  return (
    <div className="app-shell section-shell">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Offline Sync Dashboard</h1>
            <p className="text-xs md:text-sm text-gray-600 mt-1">
              Review offline attempts stored in this browser and manage sync actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadData} variant="secondary" size="sm">
              <i className='bx bx-refresh text-sm'></i>
              Refresh
            </Button>
            <Button onClick={handleSyncNow} variant="primary" size="sm" loading={syncing}>
              <i className='bx bx-sync text-sm'></i>
              Sync Now
            </Button>
            <Button onClick={handleExportPending} variant="outline" size="sm" disabled={pendingCount === 0}>
              <i className='bx bx-download text-sm'></i>
              Export Pending
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
          <Card className="bg-blue-50 panel-compact">
            <p className="text-xs md:text-sm text-gray-600">Pending Queue</p>
            <h3 className="text-lg md:text-xl font-bold text-blue-600 mt-1">{pendingCount}</h3>
          </Card>
          <Card className="bg-orange-50 panel-compact">
            <p className="text-xs md:text-sm text-gray-600">Failed Queue</p>
            <h3 className="text-lg md:text-xl font-bold text-orange-600 mt-1">{failedCount}</h3>
          </Card>
          <Card className="bg-green-50 panel-compact">
            <p className="text-xs md:text-sm text-gray-600">Synced Items</p>
            <h3 className="text-lg md:text-xl font-bold text-green-600 mt-1">{doneCount}</h3>
          </Card>
          <Card className="bg-purple-50 panel-compact">
            <p className="text-xs md:text-sm text-gray-600">In-Progress Attempts</p>
            <h3 className="text-lg md:text-xl font-bold text-purple-600 mt-1">{inProgressCount}</h3>
          </Card>
        </div>

        <Card>
          <div className="flex flex-col md:flex-row justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Last Sync</p>
              <p className="text-xs text-gray-600">
                {meta.lastSyncTime ? new Date(meta.lastSyncTime).toLocaleString() : 'No sync yet'}
              </p>
              {meta.lastSyncError && (
                <p className="text-xs text-red-600 mt-1">Last error: {meta.lastSyncError}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRetryFailed} variant="secondary" size="sm" disabled={failedCount === 0}>
                <i className='bx bx-refresh text-sm'></i>
                Retry Failed
              </Button>
              <Button onClick={handleClearDone} variant="secondary" size="sm" disabled={doneCount === 0}>
                <i className='bx bx-trash text-sm'></i>
                Clear Done
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b">
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Exam</th>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Queue</th>
                  <th className="py-2 pr-4">Last Tried</th>
                  <th className="py-2 pr-4">Retries</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueItems.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-gray-500">
                      No queued sync items found.
                    </td>
                  </tr>
                )}
                {queueItems.map((item) => {
                  const attempt = item.type === 'SUBMIT_ATTEMPT' ? attemptMap.get(item.entityId) : undefined;
                  return (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-mono text-xs break-all">{item.entityId}</td>
                      <td className="py-2 pr-4 text-xs">{item.type}</td>
                      <td className="py-2 pr-4">{attempt?.examId ?? '-'}</td>
                      <td className="py-2 pr-4">{attempt?.studentId ?? '-'}</td>
                      <td className="py-2 pr-4">{attempt?.status ?? '-'}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs font-semibold">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-600">
                        {item.lastTriedAt ? new Date(item.lastTriedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-2 pr-4">{item.retryCount}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleExportAttempt(item.entityId)}
                            variant="outline"
                            size="sm"
                            disabled={item.type !== 'SUBMIT_ATTEMPT'}
                          >
                            Export
                          </Button>
                          {item.status === 'FAILED' && (
                            <Button
                              onClick={async () => {
                                await offlineDB.syncQueue.update(item.id!, {
                                  status: 'PENDING',
                                  lastError: undefined,
                                  lastTriedAt: undefined,
                                });
                                loadData();
                              }}
                              variant="secondary"
                              size="sm"
                            >
                              Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loading && (
            <p className="text-xs text-gray-500 mt-3">Loading offline queue...</p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SyncDashboard;
