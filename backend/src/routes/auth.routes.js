const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateToken, validateRefresh } = require('../middleware/auth.middleware');

// Public Routes
router.post('/admin/login', authController.adminLogin);
router.post('/student/login', authController.studentLogin);
router.post('/refresh-token', validateRefresh, authController.refreshToken);

// Protected Routes
router.post('/logout', validateToken, authController.logout);

module.exports = router;
