import Dexie from 'dexie';

/**
 * Local IndexedDB database for offline support
 */
const db = new Dexie('CBTSystemDB');

db.version(1).stores({
  exams: 'id',
  questions: 'id, examId',
  answers: 'id, attemptId',
  examAttempts: 'id, studentId',
  registrationData: 'id'
});

export const offlineDB = {
  // Exams
  saveExam: (exam) => db.exams.put(exam),
  getExam: (id) => db.exams.get(id),
  getAllExams: () => db.exams.toArray(),
  
  // Questions
  saveQuestions: (questions) => db.questions.bulkPut(questions),
  getQuestionsByExam: (examId) => db.questions.where('examId').equals(examId).toArray(),
  
  // Answers
  saveAnswer: (answer) => db.answers.put(answer),
  getAnswersByAttempt: (attemptId) => db.answers.where('attemptId').equals(attemptId).toArray(),
  updateAnswer: (id, data) => db.answers.update(id, data),
  
  // Exam Attempts
  createAttempt: (attempt) => db.examAttempts.add(attempt),
  getAttempt: (id) => db.examAttempts.get(id),
  updateAttempt: (id, data) => db.examAttempts.update(id, data),
  getAttemptsByStudent: (studentId) => db.examAttempts.where('studentId').equals(studentId).toArray(),
  
  // Registration Data
  saveRegistrationData: (data) => db.registrationData.put(data),
  getRegistrationData: () => db.registrationData.toArray(),
  
  // Clear all data
  clearAll: async () => {
    await db.exams.clear();
    await db.questions.clear();
    await db.answers.clear();
    await db.examAttempts.clear();
    await db.registrationData.clear();
  }
};

export default db;
