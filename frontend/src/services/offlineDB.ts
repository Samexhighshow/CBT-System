import Dexie, { Table } from 'dexie';
import { Exam, Question, ExamAnswer, Student, User } from '../types';

// Define the database schema
export interface OfflineExam extends Exam {
  syncStatus?: 'synced' | 'pending' | 'error';
  lastModified?: Date;
}

export interface OfflineAnswer extends ExamAnswer {
  syncStatus?: 'synced' | 'pending' | 'error';
  lastModified?: Date;
  examId: number;
  studentId: number;
}

export interface OfflineStudent extends Student {
  syncStatus?: 'synced' | 'pending' | 'error';
  lastModified?: Date;
}

export interface SyncQueue {
  id?: number;
  type: 'exam' | 'answer' | 'student' | 'result';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
}

// Create database class
class CBTDatabase extends Dexie {
  exams!: Table<OfflineExam, number>;
  questions!: Table<Question, number>;
  answers!: Table<OfflineAnswer, number>;
  students!: Table<OfflineStudent, number>;
  syncQueue!: Table<SyncQueue, number>;
  users!: Table<User, number>;

  constructor() {
    super('CBTDatabase');
    
    this.version(1).stores({
      exams: '++id, title, subject_id, syncStatus, lastModified',
      questions: '++id, exam_id, question_text',
      answers: '++id, exam_id, student_id, question_id, syncStatus, lastModified',
      students: '++id, email, registration_number, syncStatus, lastModified',
      syncQueue: '++id, type, action, status, timestamp',
      users: '++id, email, role',
    });
  }
}

// Create and export database instance
export const db = new CBTDatabase();

// Database operations
export const offlineDB = {
  // Exams
  exams: {
    getAll: async (): Promise<OfflineExam[]> => {
      return await db.exams.toArray();
    },

    getById: async (id: number): Promise<OfflineExam | undefined> => {
      return await db.exams.get(id);
    },

    add: async (exam: OfflineExam): Promise<number> => {
      exam.syncStatus = 'pending';
      exam.lastModified = new Date();
      return await db.exams.add(exam);
    },

    update: async (id: number, changes: Partial<OfflineExam>): Promise<number> => {
      changes.syncStatus = 'pending';
      changes.lastModified = new Date();
      return await db.exams.update(id, changes);
    },

    delete: async (id: number): Promise<void> => {
      await db.exams.delete(id);
    },

    clear: async (): Promise<void> => {
      await db.exams.clear();
    },
  },

  // Questions
  questions: {
    getAll: async (): Promise<Question[]> => {
      return await db.questions.toArray();
    },

    getByExamId: async (examId: number): Promise<Question[]> => {
      return await db.questions.where('exam_id').equals(examId).toArray();
    },

    getById: async (id: number): Promise<Question | undefined> => {
      return await db.questions.get(id);
    },

    add: async (question: Question): Promise<number> => {
      return await db.questions.add(question);
    },

    bulkAdd: async (questions: Question[]): Promise<number> => {
      return await db.questions.bulkAdd(questions);
    },

    update: async (id: number, changes: Partial<Question>): Promise<number> => {
      return await db.questions.update(id, changes);
    },

    delete: async (id: number): Promise<void> => {
      await db.questions.delete(id);
    },

    deleteByExamId: async (examId: number): Promise<void> => {
      await db.questions.where('exam_id').equals(examId).delete();
    },

    clear: async (): Promise<void> => {
      await db.questions.clear();
    },
  },

  // Answers
  answers: {
    getAll: async (): Promise<OfflineAnswer[]> => {
      return await db.answers.toArray();
    },

    getByExamId: async (examId: number): Promise<OfflineAnswer[]> => {
      return await db.answers.where('exam_id').equals(examId).toArray();
    },

    getByStudentId: async (studentId: number): Promise<OfflineAnswer[]> => {
      return await db.answers.where('student_id').equals(studentId).toArray();
    },

    add: async (answer: OfflineAnswer): Promise<number> => {
      answer.syncStatus = 'pending';
      answer.lastModified = new Date();
      return await db.answers.add(answer);
    },

    update: async (id: number, changes: Partial<OfflineAnswer>): Promise<number> => {
      changes.syncStatus = 'pending';
      changes.lastModified = new Date();
      return await db.answers.update(id, changes);
    },

    delete: async (id: number): Promise<void> => {
      await db.answers.delete(id);
    },

    clear: async (): Promise<void> => {
      await db.answers.clear();
    },

    getPending: async (): Promise<OfflineAnswer[]> => {
      return await db.answers.where('syncStatus').equals('pending').toArray();
    },
  },

  // Students
  students: {
    getAll: async (): Promise<OfflineStudent[]> => {
      return await db.students.toArray();
    },

    getById: async (id: number): Promise<OfflineStudent | undefined> => {
      return await db.students.get(id);
    },

    add: async (student: OfflineStudent): Promise<number> => {
      student.syncStatus = 'pending';
      student.lastModified = new Date();
      return await db.students.add(student);
    },

    update: async (id: number, changes: Partial<OfflineStudent>): Promise<number> => {
      changes.syncStatus = 'pending';
      changes.lastModified = new Date();
      return await db.students.update(id, changes);
    },

    delete: async (id: number): Promise<void> => {
      await db.students.delete(id);
    },

    clear: async (): Promise<void> => {
      await db.students.clear();
    },
  },

  // Sync Queue
  syncQueue: {
    getAll: async (): Promise<SyncQueue[]> => {
      return await db.syncQueue.toArray();
    },

    getPending: async (): Promise<SyncQueue[]> => {
      return await db.syncQueue.where('status').equals('pending').toArray();
    },

    add: async (item: Omit<SyncQueue, 'id'>): Promise<number> => {
      return await db.syncQueue.add(item as SyncQueue);
    },

    update: async (id: number, changes: Partial<SyncQueue>): Promise<number> => {
      return await db.syncQueue.update(id, changes);
    },

    delete: async (id: number): Promise<void> => {
      await db.syncQueue.delete(id);
    },

    clear: async (): Promise<void> => {
      await db.syncQueue.clear();
    },

    clearCompleted: async (): Promise<void> => {
      await db.syncQueue.where('status').equals('completed').delete();
    },
  },

  // Users
  users: {
    getAll: async (): Promise<User[]> => {
      return await db.users.toArray();
    },

    getById: async (id: number): Promise<User | undefined> => {
      return await db.users.get(id);
    },

    add: async (user: User): Promise<number> => {
      return await db.users.add(user);
    },

    update: async (id: number, changes: Partial<User>): Promise<number> => {
      return await db.users.update(id, changes);
    },

    delete: async (id: number): Promise<void> => {
      await db.users.delete(id);
    },

    clear: async (): Promise<void> => {
      await db.users.clear();
    },
  },

  // Utility functions
  clearAll: async (): Promise<void> => {
    await db.exams.clear();
    await db.questions.clear();
    await db.answers.clear();
    await db.students.clear();
    await db.syncQueue.clear();
    await db.users.clear();
  },

  getStats: async () => {
    const [examsCount, questionsCount, answersCount, studentsCount, syncQueueCount] = await Promise.all([
      db.exams.count(),
      db.questions.count(),
      db.answers.count(),
      db.students.count(),
      db.syncQueue.count(),
    ]);

    return {
      exams: examsCount,
      questions: questionsCount,
      answers: answersCount,
      students: studentsCount,
      syncQueue: syncQueueCount,
    };
  },
};

export default offlineDB;
