import offlineDB, { AttemptRecord, SyncItemType, SyncQueueItem } from './offlineDB';
import { checkReachability, getReachableBaseUrl } from './reachability';

const SYNC_ENDPOINT = '/sync/attempt';
const LOCAL_SYNC_ENDPOINT = '/local-sync/attempt';
const SYNC_LIMIT = 10;
const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const SYNC_SALT = process.env.REACT_APP_SYNC_SALT || '';

const hashPayload = async (input: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const buildSignature = async (attempt: AttemptRecord, answers: any[]): Promise<string> => {
  const raw = `${attempt.attemptId}${attempt.studentId}${attempt.examId}${JSON.stringify(answers)}${attempt.submittedAt || ''}${SYNC_SALT}`;
  return hashPayload(raw);
};

export interface SyncSummary {
  processed: number;
  succeeded: number;
  failed: number;
}

class SyncService {
  private timer: number | null = null;
  private isRunning = false;

  start(): void {
    if (this.timer) {
      window.clearInterval(this.timer);
    }

    this.timer = window.setInterval(() => {
      this.syncNow();
    }, SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  async enqueue(attemptId: string, type: SyncItemType): Promise<void> {
    const now = new Date().toISOString();
    const existing = await offlineDB.syncQueue
      .where({ attemptId, type })
      .and((item) => item.status === 'PENDING')
      .first();

    if (existing) {
      return;
    }

    await offlineDB.syncQueue.add({
      attemptId,
      type,
      status: 'PENDING',
      createdAt: now,
      retryCount: 0,
    });
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

      const endpoint = reachability.status === 'ONLINE'
        ? `${baseUrl}${SYNC_ENDPOINT}`
        : `${baseUrl}${LOCAL_SYNC_ENDPOINT}`;

      const pending = await offlineDB.syncQueue
        .where('status')
        .equals('PENDING')
        .sortBy('createdAt');

      const batch = pending.slice(0, SYNC_LIMIT);
      for (const item of batch) {
        summary.processed += 1;
        const result = await this.processItem(item, endpoint);
        if (result) {
          summary.succeeded += 1;
        } else {
          summary.failed += 1;
        }
      }

      await offlineDB.meta.put({
        key: 'lastSyncTime',
        value: new Date().toISOString(),
      });
    } finally {
      this.isRunning = false;
    }

    return summary;
  }

  private async processItem(item: SyncQueueItem, endpoint: string): Promise<boolean> {
    const now = new Date().toISOString();

    try {
      if (item.type === 'SUBMIT_ATTEMPT') {
        const attempt = await offlineDB.attempts.get(item.attemptId);
        if (!attempt) {
          await offlineDB.syncQueue.update(item.id!, {
            status: 'FAILED',
            lastTriedAt: now,
            retryCount: item.retryCount + 1,
            lastError: 'Attempt not found',
          });
          return false;
        }

        const answers = await offlineDB.answers
          .where('attemptId')
          .equals(item.attemptId)
          .toArray();

        const cheatLogs = await offlineDB.cheatLogs
          .where('attemptId')
          .equals(item.attemptId)
          .toArray();

        const payload = {
          attemptId: attempt.attemptId,
          examId: attempt.examId,
          studentId: attempt.studentId,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
          receiptCode: attempt.receiptCode,
          answers: answers.map((answer) => ({
            questionId: answer.questionId,
            answer: answer.answer,
            updatedAt: answer.updatedAt,
          })),
          cheatLogs: cheatLogs.map((log) => ({
            eventType: log.eventType,
            payload: log.payload,
            createdAt: log.createdAt,
          })),
        };

        const signature = await buildSignature(attempt, payload.answers);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...payload, signature }),
        });

        if (!res.ok) {
          throw new Error(`Sync failed: ${res.status}`);
        }

        await offlineDB.syncQueue.update(item.id!, {
          status: 'DONE',
          lastTriedAt: now,
        });

        await offlineDB.attempts.update(attempt.attemptId, {
          status: 'SYNCED',
        });

        return true;
      }

      await offlineDB.syncQueue.update(item.id!, {
        status: 'DONE',
        lastTriedAt: now,
      });
      return true;
    } catch (error: any) {
      await offlineDB.syncQueue.update(item.id!, {
        status: 'FAILED',
        lastTriedAt: now,
        retryCount: item.retryCount + 1,
        lastError: error?.message || 'Sync failed',
      });

      await offlineDB.meta.put({
        key: 'lastSyncError',
        value: error?.message || 'Sync failed',
        updatedAt: now,
      });
      return false;
    }
  }
}

export const syncService = new SyncService();
export default syncService;
