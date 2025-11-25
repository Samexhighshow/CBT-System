const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { validateToken, isAdmin } = require('../middleware/auth.middleware');

// Admin only routes
router.get('/students', validateToken, isAdmin, reportController.studentReport);
router.get('/exams', validateToken, isAdmin, reportController.examReport);
router.get('/results', validateToken, isAdmin, reportController.resultsReport);
router.get('/attempts/:examId', validateToken, isAdmin, reportController.examAttemptsReport);

// Export data
router.get('/export/students', validateToken, isAdmin, reportController.exportStudentsCSV);
router.get('/export/results', validateToken, isAdmin, reportController.exportResultsCSV);
router.get('/export/pdf/:examId', validateToken, isAdmin, reportController.exportResultsPDF);

module.exports = router;
