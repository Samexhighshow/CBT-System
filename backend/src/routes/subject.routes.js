const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subject.controller');
const { validateToken, isAdmin } = require('../middleware/auth.middleware');

// Admin routes
router.post('/', validateToken, isAdmin, subjectController.createSubject);
router.get('/', subjectController.listSubjects);
router.get('/:id', subjectController.getSubject);
router.put('/:id', validateToken, isAdmin, subjectController.updateSubject);
router.delete('/:id', validateToken, isAdmin, subjectController.deleteSubject);

// Get subjects by class level
router.get('/class/:classLevel', subjectController.getSubjectsByClass);

// Get subjects by department
router.get('/department/:departmentId', subjectController.getSubjectsByDepartment);

module.exports = router;
