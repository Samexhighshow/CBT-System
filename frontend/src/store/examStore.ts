import { create } from 'zustand';
import { Exam, Question, ExamAnswer } from '../types';

interface ExamState {
  // Current exam
  currentExam: Exam | null;
  questions: Question[];
  currentQuestionIndex: number;
  answers: { [questionId: number]: number };
  timeRemaining: number;
  
  // All exams
  exams: Exam[];
  availableExams: Exam[];
  completedExams: number[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentExam: (exam: Exam | null) => void;
  setQuestions: (questions: Question[]) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setAnswer: (questionId: number, optionId: number) => void;
  setAnswers: (answers: { [questionId: number]: number }) => void;
  setTimeRemaining: (time: number) => void;
  decrementTime: () => void;
  
  setExams: (exams: Exam[]) => void;
  setAvailableExams: (exams: Exam[]) => void;
  addCompletedExam: (examId: number) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Complex actions
  startExam: (exam: Exam, questions: Question[]) => void;
  submitExam: () => { [questionId: number]: number };
  resetExam: () => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  goToQuestion: (index: number) => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  // Initial state
  currentExam: null,
  questions: [],
  currentQuestionIndex: 0,
  answers: {},
  timeRemaining: 0,
  
  exams: [],
  availableExams: [],
  completedExams: [],
  
  isLoading: false,
  error: null,
  
  // Simple setters
  setCurrentExam: (exam) => set({ currentExam: exam }),
  setQuestions: (questions) => set({ questions }),
  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  
  setAnswer: (questionId, optionId) => set((state) => ({
    answers: { ...state.answers, [questionId]: optionId }
  })),
  
  setAnswers: (answers) => set({ answers }),
  
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  
  decrementTime: () => set((state) => ({
    timeRemaining: Math.max(0, state.timeRemaining - 1)
  })),
  
  setExams: (exams) => set({ exams }),
  setAvailableExams: (exams) => set({ availableExams: exams }),
  
  addCompletedExam: (examId) => set((state) => ({
    completedExams: [...state.completedExams, examId]
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  
  // Complex actions
  startExam: (exam, questions) => {
    set({
      currentExam: exam,
      questions,
      currentQuestionIndex: 0,
      answers: {},
      timeRemaining: (exam.duration_minutes || 60) * 60,
      error: null,
    });
  },
  
  submitExam: () => {
    const state = get();
    const answers = { ...state.answers };
    
    // Mark exam as completed
    if (state.currentExam?.id) {
      set((state) => ({
        completedExams: [...state.completedExams, state.currentExam!.id]
      }));
    }
    
    return answers;
  },
  
  resetExam: () => {
    set({
      currentExam: null,
      questions: [],
      currentQuestionIndex: 0,
      answers: {},
      timeRemaining: 0,
      error: null,
    });
  },
  
  nextQuestion: () => {
    const { currentQuestionIndex, questions } = get();
    if (currentQuestionIndex < questions.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },
  
  previousQuestion: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },
  
  goToQuestion: (index) => {
    const { questions } = get();
    if (index >= 0 && index < questions.length) {
      set({ currentQuestionIndex: index });
    }
  },
}));

export default useExamStore;
