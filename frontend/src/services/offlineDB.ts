import Dexie, { Table } from 'dexie';

export type ConnectivityStatus = 'ONLINE' | 'LAN_ONLY' | 'OFFLINE';

export interface MetaEntry {
  key: string;
  value: string;
  updatedAt?: string;
}

export interface ExamPackage {
  examId: number;
  downloadedAt: string;
  packageVersion: string;
  data: any;
}

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED_LOCAL' | 'SYNCED';

export interface AttemptRecord {
  attemptId: string;
  examId: number;
  studentId: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string;
  lastSavedAt?: string;
  receiptCode?: string;
}

export interface AnswerRecord {
  attemptId: string;
  questionId: number;
  answer: any;
  updatedAt: string;
}

export type SyncItemStatus = 'PENDING' | 'DONE' | 'FAILED';
export type SyncItemType = 'SUBMIT_ATTEMPT' | 'UPLOAD_LOGS';

export interface SyncQueueItem {
  id?: number;
  attemptId: string;
  type: SyncItemType;
  status: SyncItemStatus;
  createdAt: string;
  lastTriedAt?: string;
  retryCount: number;
  lastError?: string;
}

export interface CheatLogItem {
  id?: number;
  attemptId: string;
  eventType: string;
  payload?: any;
  createdAt: string;
}

class OfflineDexieDB extends Dexie {
  meta!: Table<MetaEntry, string>;
  examPackages!: Table<ExamPackage, number>;
  attempts!: Table<AttemptRecord, string>;
  answers!: Table<AnswerRecord, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  cheatLogs!: Table<CheatLogItem, number>;

  constructor() {
    super('CBTOfflineDB');

    this.version(1).stores({
      meta: 'key',
      examPackages: 'examId, downloadedAt, packageVersion',
      attempts: 'attemptId, examId, studentId, status, startedAt, submittedAt, lastSavedAt',
      answers: '[attemptId+questionId], attemptId, questionId, updatedAt',
      syncQueue: '++id, attemptId, type, status, createdAt, lastTriedAt, retryCount',
      cheatLogs: '++id, attemptId, eventType, createdAt',
    });
  }
}

export const offlineDB = new OfflineDexieDB();

export default offlineDB;
