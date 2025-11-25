const express = require('express');
const router = express.Router();
const examAttemptController = require('../controllers/examAttempt.controller');
const { validateToken, isStudent, isAdmin } = require('../middleware/auth.middleware');

// Student routes
router.post('/start/:examId', validateToken, isStudent, examAttemptController.startExam);
router.post('/:attemptId/save-answer', validateToken, isStudent, examAttemptController.saveAnswer);
router.post('/:attemptId/submit', validateToken, isStudent, examAttemptController.submitExam);

// Get student's exam attempt
router.get('/:attemptId', validateToken, examAttemptController.getAttempt);

// Get student's attempt for specific exam
router.get('/exam/:examId/student/:studentId', validateToken, examAttemptController.getStudentExamAttempt);

// Admin routes
router.get('/', validateToken, isAdmin, examAttemptController.listAttempts);
router.get('/exam/:examId', validateToken, isAdmin, examAttemptController.getExamAttempts);

module.exports = router;
