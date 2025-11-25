const express = require('express');
const cors = require('express-cors');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./src/utils/logger');

// Load environment variables
dotenv.config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/students', require('./src/routes/student.routes'));
app.use('/api/admins', require('./src/routes/admin.routes'));
app.use('/api/exams', require('./src/routes/exam.routes'));
app.use('/api/subjects', require('./src/routes/subject.routes'));
app.use('/api/departments', require('./src/routes/department.routes'));
app.use('/api/exam-attempts', require('./src/routes/examAttempt.routes'));
app.use('/api/reports', require('./src/routes/report.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    environment: process.env.NODE_ENV
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// Error Handler
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`✓ Server running on http://localhost:${PORT}`);
  logger.info(`✓ Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
