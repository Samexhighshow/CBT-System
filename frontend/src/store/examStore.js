import create from 'zustand';
import laravelApi from '../services/laravelApi';
import offlineSync from '../services/offlineSync';
import offlineDB from '../services/offlineDB';

const useExamStore = create((set, get) => ({
  exams: [],
  currentExam: null,
  currentAttempt: null,
  answers: {}, // { questionId: selectedOptionId or text answer }
  loading: false,
  error: null,
  timeRemaining: 0, // in seconds
  isOffline: false,
  hasPendingSync: false,

  // Fetch all exams
  fetchExams: async () => {
    set({ loading: true, error: null });
    try {
      const exams = await laravelApi.exams.list();
      set({ exams, loading: false });
      return { success: true };
    } catch (err) {
      const error = err.response?.data?.message || 'Failed to fetch exams';
      set({ error, loading: false });
      return { success: false, error };
    }
  },

  // Load a specific exam
  loadExam: async (examId) => {
    set({ loading: true, error: null });
    try {
      const exam = await laravelApi.exams.load(examId);
      set({ 
        currentExam: exam,
        answers: {},
        loading: false,
        timeRemaining: exam.duration_minutes * 60
      });
      
      // Save to offline DB
      await offlineDB.saveExam(exam);
      
      return { success: true };
    } catch (err) {
      // Try to load from offline DB
      try {
        const exam = await offlineDB.getExam(examId);
        set({ 
          currentExam: exam,
          answers: {},
          loading: false,
          timeRemaining: exam.duration_minutes * 60,
          isOffline: true
        });
        return { success: true };
      } catch (offlineErr) {
        const error = err.response?.data?.message || 'Failed to load exam';
        set({ error, loading: false });
        return { success: false, error };
      }
    }
  },

  // Start an exam
  startExam: async (examId) => {
    set({ loading: true, error: null });
    try {
      const attempt = await laravelApi.exams.start(examId);
      set({ 
        currentAttempt: attempt,
        answers: {},
        loading: false,
        timeRemaining: attempt.duration_seconds || 0
      });
      return { success: true, attemptId: attempt.id };
    } catch (err) {
      // Can still continue offline
      set({ 
        currentAttempt: { id: Date.now(), exam_id: examId },
        loading: false,
        isOffline: true
      });
      return { success: true };
    }
  },

  // Save answer to state
  saveAnswer: (questionId, answer) => {
    const answers = get().answers;
    set({ 
      answers: { ...answers, [questionId]: answer }
    });

    // Auto-save to IndexedDB for offline resilience
    const exam = get().currentExam;
    if (exam) {
      offlineDB.saveAnswer(exam.id, questionId, answer);
    }
  },

  // Submit exam
  submitExam: async () => {
    const { currentExam, currentAttempt, answers } = get();
    
    if (!currentExam || !currentAttempt) {
      set({ error: 'No exam loaded' });
      return { success: false };
    }

    set({ loading: true, error: null });

    try {
      const attempt = {
        exam_id: currentExam.id,
        answers,
        duration_seconds: currentExam.duration_minutes * 60,
        device_id: offlineSync.getDeviceId(),
        attempt_uuid: offlineSync.generateAttemptId()
      };

      // Check if online
      if (navigator.onLine) {
        const result = await laravelApi.exams.syncAttempt(attempt);
        set({ 
          currentAttempt: result,
          loading: false,
          hasPendingSync: false
        });
        return { success: true, score: result.score, synced: true };
      } else {
        // Queue for offline sync
        await offlineSync.queueAttempt(attempt);
        set({ 
          currentAttempt: attempt,
          loading: false,
          hasPendingSync: true,
          isOffline: true
        });
        return { success: true, synced: false };
      }
    } catch (err) {
      // Queue for retry
      const attempt = {
        exam_id: currentExam.id,
        answers,
        duration_seconds: currentExam.duration_minutes * 60,
        device_id: offlineSync.getDeviceId(),
        attempt_uuid: offlineSync.generateAttemptId()
      };
      
      await offlineSync.queueAttempt(attempt);
      set({ 
        loading: false,
        hasPendingSync: true,
        isOffline: true
      });

      return { success: true, synced: false };
    }
  },

  // Sync pending attempts
  syncAttempts: async () => {
    set({ loading: true, error: null });
    try {
      const results = await offlineSync.syncAll();
      set({ 
        loading: false,
        hasPendingSync: false,
        isOffline: false
      });
      return { success: true, results };
    } catch (err) {
      const error = err.message || 'Failed to sync attempts';
      set({ error, loading: false });
      return { success: false, error };
    }
  },

  // Update time remaining (called by timer)
  decrementTime: () => {
    const timeRemaining = get().timeRemaining;
    if (timeRemaining > 0) {
      set({ timeRemaining: timeRemaining - 1 });
    }
  },

  // Set offline status
  setOfflineStatus: (isOffline) => {
    set({ isOffline });
  },

  // Clear exam state
  clearExam: () => {
    set({
      currentExam: null,
      currentAttempt: null,
      answers: {},
      timeRemaining: 0,
      error: null
    });
  },

  // Check for pending sync
  checkPendingSync: async () => {
    const hasPending = await offlineSync.hasPendingAttempts();
    set({ hasPendingSync: hasPending });
    return hasPending;
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  }
}));

export default useExamStore;
