const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Register Student
 */
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, gender, dateOfBirth, classLevel, departmentId, tradeSubjects, password } = req.body;
    
    // TODO: Check registration window
    // TODO: Validate input
    // TODO: Hash password
    // TODO: Generate student ID
    // TODO: Assign subjects based on class/department
    // TODO: Save to database

    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    logger.error(`Student registration error: ${err.message}`);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * Get Registration Status
 */
exports.getRegistrationStatus = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [windows] = await connection.query(
      `SELECT id, name, class_level, start_date, end_date, is_active 
       FROM registration_windows 
       WHERE is_active = TRUE AND NOW() BETWEEN start_date AND end_date`
    );
    connection.release();

    res.json({
      registrationOpen: windows.length > 0,
      windows: windows
    });
  } catch (err) {
    logger.error(`Get registration status error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get registration status' });
  }
};

/**
 * Get Student Profile
 */
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.user;
    
    const connection = await pool.getConnection();
    const [students] = await connection.query(
      'SELECT * FROM students WHERE id = ?',
      [id]
    );
    connection.release();

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(students[0]);
  } catch (err) {
    logger.error(`Get profile error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

/**
 * Update Student Profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.user;
    const { phone, email } = req.body;

    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE students SET phone = ?, email = ? WHERE id = ?',
      [phone, email, id]
    );
    connection.release();

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    logger.error(`Update profile error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * Get Assigned Exams
 */
exports.getAssignedExams = async (req, res) => {
  try {
    const { id, classLevel, departmentId } = req.user;

    const connection = await pool.getConnection();
    const [exams] = await connection.query(
      `SELECT DISTINCT e.* FROM exams e
       INNER JOIN student_exams se ON e.id = se.exam_id
       WHERE se.student_id = ? AND e.is_active = TRUE
       ORDER BY e.start_time ASC`,
      [id]
    );
    connection.release();

    res.json(exams);
  } catch (err) {
    logger.error(`Get assigned exams error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get exams' });
  }
};

/**
 * Get Student Results
 */
exports.getResults = async (req, res) => {
  try {
    const { id } = req.user;

    const connection = await pool.getConnection();
    const [results] = await connection.query(
      `SELECT 
        ea.id,
        e.title as exam_title,
        s.name as subject_name,
        ea.total_marks_obtained,
        ea.percentage,
        ea.submit_time,
        e.is_results_released
       FROM exam_attempts ea
       INNER JOIN exams e ON ea.exam_id = e.id
       INNER JOIN subjects s ON e.subject_id = s.id
       WHERE ea.student_id = ? AND ea.status IN ('submitted', 'synced')
       ORDER BY ea.submit_time DESC`,
      [id]
    );
    connection.release();

    res.json(results);
  } catch (err) {
    logger.error(`Get results error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get results' });
  }
};
