// Offline Exam Management
import { useState, useEffect, useCallback } from 'react';

export interface OfflineAnswer {
  question_id: number;
  selected_option_id?: number;
  answer_text?: string;
  timestamp: number;
}

export interface OfflineExamData {
  exam_id: number;
  exam: any;
  questions: any[];
  started_at: string;
  answers: OfflineAnswer[];
  cheating_events: any[];
}

export interface OfflineSubmission {
  id?: number;
  exam_id: number;
  student_id: number;
  answers: OfflineAnswer[];
  cheating_events: any[];
  started_at: string;
  submitted_at: string;
  synced: boolean;
  token: string;
}

class OfflineExamManager {
  private dbName = 'CBT_System';
  private dbVersion = 1;

  // Open IndexedDB
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('exam_data')) {
          db.createObjectStore('exam_data', { keyPath: 'exam_id' });
        }
        if (!db.objectStoreNames.contains('pending_submissions')) {
          db.createObjectStore('pending_submissions', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('cheating_logs')) {
          db.createObjectStore('cheating_logs', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // Store exam data for offline use
  async storeExamData(examId: number, exam: any, questions: any[]): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('exam_data', 'readwrite');
      const store = tx.objectStore('exam_data');
      
      const examData: OfflineExamData = {
        exam_id: examId,
        exam,
        questions,
        started_at: new Date().toISOString(),
        answers: [],
        cheating_events: [],
      };
      
      await store.put(examData);
      console.log('Exam data stored offline');
    } catch (error) {
      console.error('Failed to store exam data:', error);
      throw error;
    }
  }

  // Get stored exam data
  async getExamData(examId: number): Promise<OfflineExamData | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('exam_data', 'readonly');
      const store = tx.objectStore('exam_data');
      
      return new Promise((resolve, reject) => {
        const request = store.get(examId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get exam data:', error);
      return null;
    }
  }

  // Save answer offline
  async saveAnswer(examId: number, answer: OfflineAnswer): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('exam_data', 'readwrite');
      const store = tx.objectStore('exam_data');
      
      const examData = await this.getExamData(examId);
      if (!examData) {
        throw new Error('Exam data not found');
      }

      // Update or add answer
      const existingIndex = examData.answers.findIndex(
        a => a.question_id === answer.question_id
      );
      
      if (existingIndex >= 0) {
        examData.answers[existingIndex] = answer;
      } else {
        examData.answers.push(answer);
      }

      await store.put(examData);
    } catch (error) {
      console.error('Failed to save answer:', error);
      throw error;
    }
  }

  // Store exam submission for later sync
  async storeSubmission(submission: Omit<OfflineSubmission, 'id'>): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('pending_submissions', 'readwrite');
      const store = tx.objectStore('pending_submissions');
      
      await store.add(submission);
      console.log('Submission stored for sync');
      
      // Register background sync if available
      if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        // Type assertion for background sync (not fully typed in TypeScript)
        await (registration as any).sync.register('sync-exam-answers');
      }
    } catch (error) {
      console.error('Failed to store submission:', error);
      throw error;
    }
  }

  // Get pending submissions
  async getPendingSubmissions(): Promise<OfflineSubmission[]> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('pending_submissions', 'readonly');
      const store = tx.objectStore('pending_submissions');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get pending submissions:', error);
      return [];
    }
  }

  // Sync pending submissions
  async syncPendingSubmissions(apiCall: (submission: OfflineSubmission) => Promise<boolean>): Promise<number> {
    try {
      const pendingSubmissions = await this.getPendingSubmissions();
      let syncedCount = 0;

      for (const submission of pendingSubmissions) {
        try {
          const success = await apiCall(submission);
          
          if (success && submission.id) {
            // Remove synced submission
            const db = await this.openDB();
            const tx = db.transaction('pending_submissions', 'readwrite');
            const store = tx.objectStore('pending_submissions');
            await store.delete(submission.id);
            syncedCount++;
          }
        } catch (error) {
          console.error('Failed to sync submission:', error);
        }
      }

      return syncedCount;
    } catch (error) {
      console.error('Failed to sync submissions:', error);
      return 0;
    }
  }

  // Clear exam data after successful submission
  async clearExamData(examId: number): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('exam_data', 'readwrite');
      const store = tx.objectStore('exam_data');
      await store.delete(examId);
    } catch (error) {
      console.error('Failed to clear exam data:', error);
    }
  }

  // Check if exam data exists
  async hasExamData(examId: number): Promise<boolean> {
    const data = await this.getExamData(examId);
    return data !== null;
  }
}

export const offlineExamManager = new OfflineExamManager();

// React hook for offline exam functionality
export const useOfflineExam = (examId: number) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [examData, setExamData] = useState<OfflineExamData | null>(null);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load exam data from IndexedDB
  const loadExamData = useCallback(async () => {
    const data = await offlineExamManager.getExamData(examId);
    setExamData(data);
    return data;
  }, [examId]);

  // Store exam for offline use
  const storeExam = useCallback(async (exam: any, questions: any[]) => {
    await offlineExamManager.storeExamData(examId, exam, questions);
    await loadExamData();
  }, [examId, loadExamData]);

  // Save answer
  const saveAnswer = useCallback(async (answer: OfflineAnswer) => {
    await offlineExamManager.saveAnswer(examId, answer);
    await loadExamData();
  }, [examId, loadExamData]);

  // Check pending submissions
  useEffect(() => {
    const checkPending = async () => {
      const pending = await offlineExamManager.getPendingSubmissions();
      setPendingSync(pending.length);
    };
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    isOnline,
    examData,
    pendingSync,
    loadExamData,
    storeExam,
    saveAnswer,
  };
};
