const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { validateToken, isAdmin } = require('../middleware/auth.middleware');

// Protected routes - admin only
router.get('/dashboard', validateToken, isAdmin, adminController.getDashboard);
router.get('/students', validateToken, isAdmin, adminController.getAllStudents);
router.get('/students/:id', validateToken, isAdmin, adminController.getStudent);
router.post('/students', validateToken, isAdmin, adminController.createStudent);
router.put('/students/:id', validateToken, isAdmin, adminController.updateStudent);
router.delete('/students/:id', validateToken, isAdmin, adminController.deleteStudent);

// Registration windows
router.post('/registration-windows', validateToken, isAdmin, adminController.createRegistrationWindow);
router.get('/registration-windows', validateToken, isAdmin, adminController.listRegistrationWindows);
router.put('/registration-windows/:id', validateToken, isAdmin, adminController.updateRegistrationWindow);
router.delete('/registration-windows/:id', validateToken, isAdmin, adminController.deleteRegistrationWindow);

// Admin management (super admin only)
router.post('/', validateToken, isAdmin, adminController.createAdmin);
router.get('/', validateToken, isAdmin, adminController.listAdmins);
router.put('/:id', validateToken, isAdmin, adminController.updateAdmin);
router.delete('/:id', validateToken, isAdmin, adminController.deleteAdmin);

module.exports = router;
