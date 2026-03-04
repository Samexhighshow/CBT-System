/**
 * Offline Data Validator
 * Validates and refreshes offline cached data to prevent stale UI
 */
import offlineDB from './offlineDB';

const DATA_FRESHNESS_HOURS = 12; // Refresh data older than 12 hours
const CACHE_EXPIRY_MS = DATA_FRESHNESS_HOURS * 60 * 60 * 1000;

interface DataFreshness {
  table: string;
  lastUpdated: string | null;
  isStale: boolean;
  recordCount: number;
}

export class OfflineDataValidator {
  /**
   * Check if offline data is stale
   */
  static async checkFreshness(): Promise<DataFreshness[]> {
    const freshness: DataFreshness[] = [];
    const now = Date.now();

    try {
      // Check exams
      const exams = await offlineDB.exams.toArray();
      const oldestExam = exams.length > 0 
        ? exams.reduce((oldest, curr) => 
            new Date(curr.syncedAt).getTime() < new Date(oldest.syncedAt).getTime() ? curr : oldest
          )
        : null;
      
      freshness.push({
        table: 'exams',
        lastUpdated: oldestExam?.syncedAt || null,
        isStale: oldestExam ? now - new Date(oldestExam.syncedAt).getTime() > CACHE_EXPIRY_MS : false,
        recordCount: exams.length,
      });

      // Check students
      const students = await offlineDB.students.toArray();
      const oldestStudent = students.length > 0
        ? students.reduce((oldest, curr) =>
            new Date(curr.syncedAt).getTime() < new Date(oldest.syncedAt).getTime() ? curr : oldest
          )
        : null;
      
      freshness.push({
        table: 'students',
        lastUpdated: oldestStudent?.syncedAt || null,
        isStale: oldestStudent ? now - new Date(oldestStudent.syncedAt).getTime() > CACHE_EXPIRY_MS : false,
        recordCount: students.length,
      });

      // Check offline users
      const users = await offlineDB.offlineUsers.toArray();
      const oldestUser = users.length > 0
        ? users.reduce((oldest, curr) =>
            new Date(curr.lastSyncAt).getTime() < new Date(oldest.lastSyncAt).getTime() ? curr : oldest
          )
        : null;
      
      freshness.push({
        table: 'offlineUsers',
        lastUpdated: oldestUser?.lastSyncAt || null,
        isStale: oldestUser ? now - new Date(oldestUser.lastSyncAt).getTime() > CACHE_EXPIRY_MS : false,
        recordCount: users.length,
      });

      return freshness;
    } catch (error) {
      console.error('[OfflineDataValidator] Error checking freshness:', error);
      return freshness;
    }
  }

  /**
   * Mark data as stale to trigger refresh on next sync
   */
  static async markStaleData(): Promise<void> {
    try {
      console.log('[OfflineDataValidator] Marking all offline data as stale');
      
      // Clear synced data to force refresh
      const exams = await offlineDB.exams.toArray();
      for (const exam of exams) {
        await offlineDB.exams.update(exam.id, { 
          syncedAt: new Date(Date.now() - CACHE_EXPIRY_MS - 1000).toISOString()
        });
      }

      const students = await offlineDB.students.toArray();
      for (const student of students) {
        await offlineDB.students.update(student.id, {
          syncedAt: new Date(Date.now() - CACHE_EXPIRY_MS - 1000).toISOString()
        });
      }

      console.log('[OfflineDataValidator] Marked data as stale');
    } catch (error) {
      console.error('[OfflineDataValidator] Error marking data stale:', error);
    }
  }

  /**
   * Clear all offline data (hard reset)
   */
  static async clearAllData(): Promise<void> {
    try {
      console.log('[OfflineDataValidator] Clearing ALL offline data');
      
      await Promise.all([
        offlineDB.offlineUsers.clear(),
        offlineDB.students.clear(),
        offlineDB.exams.clear(),
        offlineDB.accessCodes.clear(),
        offlineDB.answers.clear(),
        offlineDB.attempts.clear(),
        offlineDB.cheatLogs.clear(),
        offlineDB.syncQueue.clear(),
      ]);

      console.log('[OfflineDataValidator] All offline data cleared');
    } catch (error) {
      console.error('[OfflineDataValidator] Error clearing data:', error);
    }
  }

  /**
   * Get summary of offline data
   */
  static async getSummary() {
    try {
      const [exams, students, users, codes, attempts, answers, pending] = await Promise.all([
        offlineDB.exams.count(),
        offlineDB.students.count(),
        offlineDB.offlineUsers.count(),
        offlineDB.accessCodes.count(),
        offlineDB.attempts.count(),
        offlineDB.answers.count(),
        offlineDB.syncQueue.where('status').equals('PENDING').count(),
      ]);

      return {
        exams,
        students,
        users,
        accessCodes: codes,
        attempts,
        answers,
        pendingSync: pending,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[OfflineDataValidator] Error getting summary:', error);
      return null;
    }
  }
}

export default OfflineDataValidator;
