import Dexie, { Table } from 'dexie';

export type ConnectivityStatus = 'ONLINE' | 'LAN_ONLY' | 'OFFLINE';

export interface MetaEntry {
  key: string;
  value: any;
  updatedAt?: string;
}

export interface OfflineUserRecord {
  userId: number;
  identifier: string;
  role: string;
  isActive: boolean;
  offlineLoginEnabled: boolean;
  pinHash: string;
  displayName?: string;
  lastSyncAt: string;
  updatedAt?: string;
}

export interface OfflineStudentRecord {
  studentId: number;
  matricOrCandidateNo: string;
  fullName: string;
  classId?: number | null;
  isActive: boolean;
  updatedAt: string;
}

export interface OfflineExamRecord {
  examId: number;
  title: string;
  classId?: number | null;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes?: number | null;
  updatedAt: string;
}

export type AccessCodeStatus = 'NEW' | 'USED' | 'VOID';

export interface AccessCodeRecord {
  codeId: string;
  examId: number;
  studentId: number;
  code: string;
  status: AccessCodeStatus;
  issuedAt: string;
  usedAt?: string | null;
  attemptId?: string | null;
  usedByDeviceId?: string | null;
  updatedAt: string;
  batchId?: string | null;
  serverId?: number | null;
}

export interface ExamPackage {
  examId: number;
  downloadedAt: string;
  packageVersion: string;
  packageId?: string;
  packageSignature?: string;
  expiresAt?: string | null;
  data: any;
}

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED_LOCAL' | 'SYNCED';

export interface AttemptRecord {
  attemptId: string;
  examId: number;
  studentId: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string | null;
  lastSavedAt?: string | null;
  receiptCode?: string;
}

export interface AnswerRecord {
  attemptId: string;
  questionId: number;
  answer: any;
  updatedAt: string;
}

export type SyncItemStatus = 'PENDING' | 'DONE' | 'FAILED';
export type SyncItemType = 'UPSERT_ACCESS_CODES' | 'CODE_USED' | 'SUBMIT_ATTEMPT' | 'SYNC_DOWN' | 'UPLOAD_LOGS';

export interface SyncQueueItem {
  id?: number;
  type: SyncItemType;
  entityId: string;
  status: SyncItemStatus;
  createdAt: string;
  lastTriedAt?: string;
  retryCount: number;
  payloadRef?: string;
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
  offlineUsers!: Table<OfflineUserRecord, number>;
  students!: Table<OfflineStudentRecord, number>;
  exams!: Table<OfflineExamRecord, number>;
  accessCodes!: Table<AccessCodeRecord, string>;
  attempts!: Table<AttemptRecord, string>;
  answers!: Table<AnswerRecord, [string, number]>;
  syncQueue!: Table<SyncQueueItem, number>;
  cheatLogs!: Table<CheatLogItem, number>;
  examPackages!: Table<ExamPackage, number>;

  constructor() {
    super('CBTOfflineDB');

    // Legacy schema kept so existing browser DBs can upgrade safely.
    this.version(1).stores({
      meta: 'key',
      examPackages: 'examId, downloadedAt, packageVersion',
      attempts: 'attemptId, examId, studentId, status, startedAt, submittedAt, lastSavedAt',
      answers: '[attemptId+questionId], attemptId, questionId, updatedAt',
      syncQueue: '++id, attemptId, type, status, createdAt, lastTriedAt, retryCount',
      cheatLogs: '++id, attemptId, eventType, createdAt',
    });

    this.version(2).stores({
      meta: 'key, updatedAt',
      offlineUsers: 'userId, identifier, role, isActive, offlineLoginEnabled, lastSyncAt, updatedAt, [identifier+role]',
      students: 'studentId, matricOrCandidateNo, classId, isActive, updatedAt',
      exams: 'examId, classId, status, startsAt, endsAt, updatedAt',
      accessCodes: 'codeId, examId, studentId, code, status, issuedAt, usedAt, attemptId, usedByDeviceId, updatedAt, batchId, [examId+studentId], [examId+studentId+status], [examId+studentId+code]',
      attempts: 'attemptId, examId, studentId, status, startedAt, submittedAt, lastSavedAt',
      answers: '[attemptId+questionId], attemptId, questionId, updatedAt',
      syncQueue: '++id, type, entityId, status, createdAt, lastTriedAt, retryCount, payloadRef',
      cheatLogs: '++id, attemptId, eventType, createdAt',
      examPackages: 'examId, downloadedAt, packageVersion',
    }).upgrade(async (tx) => {
      const now = new Date().toISOString();

      // Migrate legacy queue rows from attemptId -> entityId.
      const legacyQueue = await tx.table('syncQueue').toArray();
      for (const item of legacyQueue as any[]) {
        if (!item.entityId && item.attemptId) {
          await tx.table('syncQueue').put({
            ...item,
            entityId: String(item.attemptId),
            type: item.type || 'SUBMIT_ATTEMPT',
            status: item.status || 'PENDING',
            retryCount: Number(item.retryCount || 0),
            createdAt: item.createdAt || now,
          });
        }
      }

      const existingDeviceId = await tx.table('meta').get('deviceId');
      if (!existingDeviceId) {
        await tx.table('meta').put({
          key: 'deviceId',
          value: `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          updatedAt: now,
        });
      }
    });
  }
}

export const offlineDB = new OfflineDexieDB();

const DEVICE_ID_META_KEY = 'deviceId';

export const getMetaValue = async <T = any>(key: string): Promise<T | undefined> => {
  const row = await offlineDB.meta.get(key);
  return row?.value as T | undefined;
};

export const setMetaValue = async (key: string, value: any): Promise<void> => {
  await offlineDB.meta.put({
    key,
    value,
    updatedAt: new Date().toISOString(),
  });
};

export const ensureDeviceId = async (): Promise<string> => {
  const existing = await getMetaValue<string>(DEVICE_ID_META_KEY);
  if (existing) {
    return existing;
  }

  const generated = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await setMetaValue(DEVICE_ID_META_KEY, generated);
  return generated;
};

export default offlineDB;
