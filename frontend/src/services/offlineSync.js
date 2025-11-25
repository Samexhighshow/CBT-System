import laravelApi from './laravelApi';
import { offlineDB } from './offlineDB';
import { v4 as uuidv4 } from 'uuid';

/**
 * Offline Sync Service
 * Manages queuing of offline attempts and syncing them to the Laravel backend
 */

const SYNC_QUEUE_KEY = 'cbt_sync_queue';
const DEVICE_ID_KEY = 'cbt_device_id';

export const offlineSync = {
  /**
   * Get or create a unique device ID
   */
  getDeviceId: () => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  },

  /**
   * Queue an offline attempt for later sync
   */
  queueAttempt: async (examId, studentId, answers, startedAt, endedAt) => {
    const attempt = {
      attempt_uuid: uuidv4(),
      exam_id: examId,
      student_id: studentId,
      device_id: offlineSync.getDeviceId(),
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: Math.floor((new Date(endedAt) - new Date(startedAt)) / 1000),
      answers: answers,
      status: 'queued',
      created_at: new Date().toISOString()
    };

    // Store in IndexedDB
    const attemptRecord = await offlineDB.createAttempt(attempt);

    // Add to queue in localStorage
    const queue = offlineSync.getSyncQueue();
    queue.push({ attempt_uuid: attempt.attempt_uuid, db_id: attemptRecord });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

    return attemptRecord;
  },

  /**
   * Get pending sync queue from localStorage
   */
  getSyncQueue: () => {
    const queue = localStorage.getItem(SYNC_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  },

  /**
   * Sync a single queued attempt to the backend
   */
  syncAttempt: async (attemptUuid) => {
    try {
      const attempt = await offlineDB.getAttempt(attemptUuid);
      if (!attempt) {
        throw new Error(`Attempt ${attemptUuid} not found in local storage`);
      }

      // Prepare payload
      const payload = {
        attempt_uuid: attempt.attempt_uuid,
        exam_id: attempt.exam_id,
        student_id: attempt.student_id,
        device_id: attempt.device_id,
        started_at: attempt.started_at,
        ended_at: attempt.ended_at,
        duration_seconds: attempt.duration_seconds,
        answers: attempt.answers,
        answers_hash: offlineSync.hashAnswers(attempt.answers)
      };

      // Send to backend
      const response = await laravelApi.exams.syncAttempt(payload);

      // Mark as synced locally
      await offlineDB.updateAttempt(attemptUuid, {
        status: 'synced',
        synced_at: new Date().toISOString(),
        score: response.data.score
      });

      // Remove from queue
      offlineSync.removeFromQueue(attempt.attempt_uuid);

      return response.data;
    } catch (error) {
      console.error(`Failed to sync attempt ${attemptUuid}:`, error);
      throw error;
    }
  },

  /**
   * Sync all pending attempts
   */
  syncAll: async () => {
    const queue = offlineSync.getSyncQueue();
    const results = [];
    const failed = [];

    for (const item of queue) {
      try {
        const result = await offlineSync.syncAttempt(item.attempt_uuid);
        results.push(result);
      } catch (error) {
        failed.push({ attempt_uuid: item.attempt_uuid, error: error.message });
      }
    }

    return { synced: results, failed };
  },

  /**
   * Remove an attempt from the sync queue
   */
  removeFromQueue: (attemptUuid) => {
    const queue = offlineSync.getSyncQueue();
    const filtered = queue.filter(item => item.attempt_uuid !== attemptUuid);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
  },

  /**
   * Simple hash of answers for integrity check
   */
  hashAnswers: (answers) => {
    const answerStr = JSON.stringify(answers.sort((a, b) => a.question_id - b.question_id));
    // In production, use crypto.subtle.digest for better hashing
    return btoa(answerStr); // Base64 encode for now
  },

  /**
   * Check if there are pending attempts
   */
  hasPendingAttempts: () => {
    return offlineSync.getSyncQueue().length > 0;
  }
};

export default offlineSync;
