const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const { validateToken, isStudent } = require('../middleware/auth.middleware');

// Student Registration (public, within registration window)
router.post('/register', studentController.register);

// Get registration window status
router.get('/registration-status', studentController.getRegistrationStatus);

// Protected routes (student only)
router.get('/profile', validateToken, isStudent, studentController.getProfile);
router.put('/profile', validateToken, isStudent, studentController.updateProfile);
router.get('/assigned-exams', validateToken, isStudent, studentController.getAssignedExams);
router.get('/results', validateToken, isStudent, studentController.getResults);

module.exports = router;
