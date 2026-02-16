import offlineDB, {
  AccessCodeRecord,
  SyncItemType,
  SyncQueueItem,
  ensureDeviceId,
  setMetaValue,
} from './offlineDB';
import { checkReachability, getReachableBaseUrl } from './reachability';

const SYNC_LIMIT = 10;
const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

export interface SyncSummary {
  processed: number;
  succeeded: number;
  failed: number;
}

const nowIso = () => new Date().toISOString();

const backoffMsForRetry = (retryCount: number): number => {
  const base = 30_000;
  return Math.min(base * Math.pow(2, Math.max(0, retryCount)), MAX_BACKOFF_MS);
};

const canRetryItem = (item: SyncQueueItem): boolean => {
  if (item.status === 'PENDING') return true;
  if (item.status !== 'FAILED') return false;
  if (!item.lastTriedAt) return true;
  const elapsed = Date.now() - new Date(item.lastTriedAt).getTime();
  return elapsed >= backoffMsForRetry(item.retryCount);
};

const queueKeyFor = (item: Pick<SyncQueueItem, 'type' | 'entityId' | 'payloadRef'>) =>
  `${item.type}:${item.entityId}:${item.payloadRef || ''}`;

class SyncService {
  private timer: number | null = null;
  private isRunning = false;

  start(): void {
    if (this.timer) {
      window.clearInterval(this.timer);
    }

    this.timer = window.setInterval(() => {
      void this.runFullSync().catch(() => undefined);
    }, SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  async enqueue(entityId: string, type: SyncItemType, payloadRef?: string): Promise<void> {
    const key = queueKeyFor({ type, entityId, payloadRef });
    const existing = await offlineDB.syncQueue
      .where('status')
      .anyOf('PENDING', 'FAILED')
      .toArray();

    const found = existing.find((item) => queueKeyFor(item) === key);
    if (found) {
      return;
    }

    await offlineDB.syncQueue.add({
      type,
      entityId,
      payloadRef,
      status: 'PENDING',
      createdAt: nowIso(),
      retryCount: 0,
    });
  }

  async pendingCount(): Promise<number> {
    const [pending, failed] = await Promise.all([
      offlineDB.syncQueue.where('status').equals('PENDING').count(),
      offlineDB.syncQueue.where('status').equals('FAILED').count(),
    ]);
    return pending + failed;
  }

  async runFullSync(): Promise<SyncSummary> {
    const reachability = await checkReachability();
    if (reachability.status === 'OFFLINE') {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    await this.syncDown();
    return this.syncNow();
  }

  async syncDown(): Promise<void> {
    const reachability = await checkReachability();
    const baseUrl = getReachableBaseUrl(reachability);
    if (!baseUrl) {
      return;
    }

    try {
      await Promise.all([
        this.syncOfflineUsers(baseUrl),
        this.syncOfflineStudents(baseUrl),
        this.syncOfflineExams(baseUrl),
      ]);
      await setMetaValue('lastSyncTime', nowIso());
      await setMetaValue('lastSyncError', '');
    } catch (error: any) {
      await setMetaValue('lastSyncError', error?.message || 'Sync-down failed');
      throw error;
    }
  }

  async syncNow(): Promise<SyncSummary> {
    if (this.isRunning) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isRunning = true;
    const summary: SyncSummary = { processed: 0, succeeded: 0, failed: 0 };

    try {
      const reachability = await checkReachability();
      const baseUrl = getReachableBaseUrl(reachability);
      if (!baseUrl) {
        return summary;
      }

      const allQueue = await offlineDB.syncQueue.orderBy('createdAt').toArray();
      const batch = allQueue.filter(canRetryItem).slice(0, SYNC_LIMIT);

      for (const item of batch) {
        summary.processed += 1;
        const ok = await this.processQueueItem(item, baseUrl);
        if (ok) {
          summary.succeeded += 1;
        } else {
          summary.failed += 1;
        }
      }

      await setMetaValue('lastSyncTime', nowIso());
      if (summary.failed === 0) {
        await setMetaValue('lastSyncError', '');
      }
    } finally {
      this.isRunning = false;
    }

    return summary;
  }

  private async processQueueItem(item: SyncQueueItem, baseUrl: string): Promise<boolean> {
    const triedAt = nowIso();

    try {
      if (item.type === 'UPSERT_ACCESS_CODES') {
        const sent = await this.syncAccessCodeBatch(baseUrl, item);
        if (!sent) {
          await offlineDB.syncQueue.update(item.id!, {
            status: 'DONE',
            lastTriedAt: triedAt,
          });
          return true;
        }
      } else if (item.type === 'CODE_USED') {
        const sent = await this.syncCodeUsage(baseUrl, item.entityId);
        if (!sent) {
          await offlineDB.syncQueue.update(item.id!, {
            status: 'DONE',
            lastTriedAt: triedAt,
          });
          return true;
        }
      } else if (item.type === 'SUBMIT_ATTEMPT') {
        const syncedAttempt = await this.syncAttemptSubmission(baseUrl, item.entityId);
        if (!syncedAttempt) {
          await offlineDB.syncQueue.update(item.id!, {
            status: 'DONE',
            lastTriedAt: triedAt,
          });
          return true;
        }
      } else if (item.type === 'SYNC_DOWN') {
        await this.syncDown();
      }

      await offlineDB.syncQueue.update(item.id!, {
        status: 'DONE',
        lastTriedAt: triedAt,
      });

      return true;
    } catch (error: any) {
      const message = error?.message || 'Sync failed';
      await offlineDB.syncQueue.update(item.id!, {
        status: 'FAILED',
        lastTriedAt: triedAt,
        retryCount: item.retryCount + 1,
        lastError: message,
      });
      await setMetaValue('lastSyncError', message);
      return false;
    }
  }

  private async syncAccessCodeBatch(baseUrl: string, item: SyncQueueItem): Promise<boolean> {
    const examId = Number(item.entityId);
    let rows: AccessCodeRecord[] = [];

    if (item.payloadRef) {
      rows = await offlineDB.accessCodes.where('batchId').equals(item.payloadRef).toArray();
    } else if (!Number.isNaN(examId)) {
      rows = await offlineDB.accessCodes.where('examId').equals(examId).toArray();
    }

    if (rows.length === 0) {
      return false;
    }

    const payload = {
      codes: rows.map((row) => ({
        codeId: row.codeId,
        examId: row.examId,
        studentId: row.studentId,
        code: row.code,
        status: row.status,
        issuedAt: row.issuedAt,
        usedAt: row.usedAt,
        attemptId: row.attemptId,
        usedByDeviceId: row.usedByDeviceId,
        updatedAt: row.updatedAt,
      })),
    };

    const response = await fetch(`${baseUrl}/sync/access-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Access-code sync failed (${response.status})`);
    }

    return true;
  }

  private async syncCodeUsage(baseUrl: string, codeId: string): Promise<boolean> {
    const code = await offlineDB.accessCodes.get(codeId);
    if (!code) {
      return false;
    }

    const payload = {
      codeId: code.codeId,
      usedAt: code.usedAt,
      attemptId: code.attemptId,
      deviceId: code.usedByDeviceId,
      status: code.status,
      updatedAt: code.updatedAt,
    };

    const response = await fetch(`${baseUrl}/sync/code-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Code-usage sync failed (${response.status})`);
    }

    return true;
  }

  private async syncAttemptSubmission(baseUrl: string, attemptId: string): Promise<boolean> {
    const attempt = await offlineDB.attempts.get(attemptId);
    if (!attempt) {
      return false;
    }

    const [answers, cheatLogs, deviceId] = await Promise.all([
      offlineDB.answers.where('attemptId').equals(attemptId).toArray(),
      offlineDB.cheatLogs.where('attemptId').equals(attemptId).toArray(),
      ensureDeviceId(),
    ]);

    if (answers.length === 0 && attempt.status !== 'SUBMITTED_LOCAL') {
      return false;
    }

    const payload = {
      attemptId: attempt.attemptId,
      examId: attempt.examId,
      studentId: attempt.studentId,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt || nowIso(),
      receiptCode: attempt.receiptCode,
      deviceId,
      answers: answers.map((item) => ({
        questionId: item.questionId,
        answer: item.answer,
        updatedAt: item.updatedAt,
      })),
      cheatLogs: cheatLogs.map((log) => ({
        eventType: log.eventType,
        payload: log.payload,
        createdAt: log.createdAt,
      })),
    };

    const response = await fetch(`${baseUrl}/sync/attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Attempt sync failed (${response.status})`);
    }

    await offlineDB.attempts.update(attempt.attemptId, {
      status: 'SYNCED',
    });

    return true;
  }

  private async syncOfflineUsers(baseUrl: string): Promise<void> {
    const since = (await offlineDB.meta.get('offlineUsersLastSyncAt'))?.value || '';
    const token = localStorage.getItem('auth_token');

    const headers: HeadersInit = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/cbt/offline-users${since ? `?since=${encodeURIComponent(String(since))}` : ''}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    // Endpoint is admin-protected; if unavailable, skip without failing entire sync.
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return;
    }
    if (!response.ok) {
      throw new Error(`Offline users sync failed (${response.status})`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    if (rows.length > 0) {
      await offlineDB.offlineUsers.bulkPut(rows);
    }
    await setMetaValue('offlineUsersLastSyncAt', payload?.synced_at || nowIso());
  }

  private async syncOfflineStudents(baseUrl: string): Promise<void> {
    const since = (await offlineDB.meta.get('offlineStudentsLastSyncAt'))?.value || '';
    const response = await fetch(`${baseUrl}/cbt/offline-students${since ? `?since=${encodeURIComponent(String(since))}` : ''}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Offline students sync failed (${response.status})`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    if (rows.length > 0) {
      await offlineDB.students.bulkPut(rows);
    }
    await setMetaValue('offlineStudentsLastSyncAt', payload?.synced_at || nowIso());
  }

  private async syncOfflineExams(baseUrl: string): Promise<void> {
    const since = (await offlineDB.meta.get('offlineExamsLastSyncAt'))?.value || '';
    const response = await fetch(`${baseUrl}/cbt/offline-exams${since ? `?since=${encodeURIComponent(String(since))}` : ''}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Offline exams sync failed (${response.status})`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    if (rows.length > 0) {
      await offlineDB.exams.bulkPut(rows);
    }
    await setMetaValue('offlineExamsLastSyncAt', payload?.synced_at || nowIso());
  }
}

export const syncService = new SyncService();
export default syncService;
