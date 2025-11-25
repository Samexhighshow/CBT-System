const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { validateToken, isAdmin } = require('../middleware/auth.middleware');

// Admin routes
router.post('/', validateToken, isAdmin, departmentController.createDepartment);
router.get('/', departmentController.listDepartments);
router.get('/:id', departmentController.getDepartment);
router.put('/:id', validateToken, isAdmin, departmentController.updateDepartment);
router.delete('/:id', validateToken, isAdmin, departmentController.deleteDepartment);

// Department subjects management
router.post('/:id/subjects', validateToken, isAdmin, departmentController.addSubjectToDepartment);
router.delete('/:id/subjects/:subjectId', validateToken, isAdmin, departmentController.removeSubjectFromDepartment);
router.get('/:id/subjects', departmentController.getDepartmentSubjects);

// Trade subjects management
router.post('/:id/trade-subjects', validateToken, isAdmin, departmentController.addTradeSubject);
router.delete('/:id/trade-subjects/:tradeSubjectId', validateToken, isAdmin, departmentController.removeTradeSubject);
router.get('/:id/trade-subjects', departmentController.getDepartmentTradeSubjects);

module.exports = router;
