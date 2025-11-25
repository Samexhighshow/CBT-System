const express = require('express');
const router = express.Router();
const examController = require('../controllers/exam.controller');
const { validateToken, isAdmin, isStudent } = require('../middleware/auth.middleware');

// Public route
router.get('/available/:studentId', examController.getAvailableExams);

// Admin routes
router.post('/', validateToken, isAdmin, examController.createExam);
router.get('/', validateToken, isAdmin, examController.listExams);
router.get('/:id', validateToken, examController.getExamDetails);
router.put('/:id', validateToken, isAdmin, examController.updateExam);
router.delete('/:id', validateToken, isAdmin, examController.deleteExam);

// Release results
router.put('/:id/release-results', validateToken, isAdmin, examController.releaseResults);

// Get exam for student taking it
router.get('/:id/questions/:studentId', validateToken, isStudent, examController.getExamQuestions);

module.exports = router;
