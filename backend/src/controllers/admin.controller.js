const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Get Admin Dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Get totals
    const [studentCount] = await connection.query('SELECT COUNT(*) as count FROM students WHERE is_active = TRUE');
    const [examCount] = await connection.query('SELECT COUNT(*) as count FROM exams WHERE is_active = TRUE');
    const [attemptCount] = await connection.query('SELECT COUNT(*) as count FROM exam_attempts WHERE status = "submitted"');
    
    connection.release();

    res.json({
      totalStudents: studentCount[0].count,
      totalExams: examCount[0].count,
      totalSubmitted: attemptCount[0].count,
      timestamp: new Date()
    });
  } catch (err) {
    logger.error(`Get dashboard error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
};

/**
 * Get All Students
 */
exports.getAllStudents = async (req, res) => {
  try {
    const { classLevel, departmentId, search } = req.query;
    
    let query = 'SELECT * FROM students WHERE is_active = TRUE';
    const params = [];

    if (classLevel) {
      query += ' AND class_level = ?';
      params.push(classLevel);
    }

    if (departmentId) {
      query += ' AND department_id = ?';
      params.push(departmentId);
    }

    if (search) {
      query += ' AND (CONCAT(first_name, " ", last_name) LIKE ? OR student_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY first_name ASC';

    const connection = await pool.getConnection();
    const [students] = await connection.query(query, params);
    connection.release();

    res.json(students);
  } catch (err) {
    logger.error(`Get students error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get students' });
  }
};

/**
 * Get Student
 */
exports.getStudent = async (req, res) => {
  try {
    const { id } = req.params;
    
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
    logger.error(`Get student error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get student' });
  }
};

/**
 * Create Student
 */
exports.createStudent = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, gender, dateOfBirth, classLevel, departmentId } = req.body;
    
    const id = uuidv4();
    const studentId = `STU-${Date.now()}`;
    const password = 'password123'; // TODO: implement proper password generation
    
    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO students (id, student_id, first_name, last_name, email, phone, gender, date_of_birth, class_level, department_id, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, studentId, firstName, lastName, email, phone, gender, dateOfBirth, classLevel, departmentId || null, password]
    );
    connection.release();

    res.status(201).json({ id, studentId, message: 'Student created successfully' });
  } catch (err) {
    logger.error(`Create student error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create student' });
  }
};

/**
 * Update Student
 */
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, departmentId } = req.body;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE students SET first_name = ?, last_name = ?, email = ?, phone = ?, department_id = ? WHERE id = ?',
      [firstName, lastName, email, phone, departmentId || null, id]
    );
    connection.release();

    res.json({ message: 'Student updated successfully' });
  } catch (err) {
    logger.error(`Update student error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update student' });
  }
};

/**
 * Delete Student
 */
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE students SET is_active = FALSE WHERE id = ?',
      [id]
    );
    connection.release();

    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    logger.error(`Delete student error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete student' });
  }
};

/**
 * Create Registration Window
 */
exports.createRegistrationWindow = async (req, res) => {
  try {
    const { name, classLevel, departmentId, startDate, endDate } = req.body;
    
    const id = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO registration_windows (id, name, class_level, department_id, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, classLevel, departmentId || null, startDate, endDate]
    );
    connection.release();

    res.status(201).json({ id, message: 'Registration window created successfully' });
  } catch (err) {
    logger.error(`Create registration window error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create registration window' });
  }
};

/**
 * List Registration Windows
 */
exports.listRegistrationWindows = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [windows] = await connection.query(
      'SELECT * FROM registration_windows ORDER BY start_date DESC'
    );
    connection.release();

    res.json(windows);
  } catch (err) {
    logger.error(`List registration windows error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get registration windows' });
  }
};

/**
 * Update Registration Window
 */
exports.updateRegistrationWindow = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isActive } = req.body;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE registration_windows SET name = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?',
      [name, startDate, endDate, isActive, id]
    );
    connection.release();

    res.json({ message: 'Registration window updated successfully' });
  } catch (err) {
    logger.error(`Update registration window error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update registration window' });
  }
};

/**
 * Delete Registration Window
 */
exports.deleteRegistrationWindow = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'DELETE FROM registration_windows WHERE id = ?',
      [id]
    );
    connection.release();

    res.json({ message: 'Registration window deleted successfully' });
  } catch (err) {
    logger.error(`Delete registration window error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete registration window' });
  }
};

/**
 * Create Admin
 */
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    
    const id = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO admins (id, email, password_hash, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, email, password, firstName, lastName, role || 'admin']
    );
    connection.release();

    res.status(201).json({ id, message: 'Admin created successfully' });
  } catch (err) {
    logger.error(`Create admin error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create admin' });
  }
};

/**
 * List Admins
 */
exports.listAdmins = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [admins] = await connection.query(
      'SELECT id, email, first_name, last_name, role, is_active, last_login FROM admins ORDER BY first_name ASC'
    );
    connection.release();

    res.json(admins);
  } catch (err) {
    logger.error(`List admins error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get admins' });
  }
};

/**
 * Update Admin
 */
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, role, isActive } = req.body;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE admins SET email = ?, first_name = ?, last_name = ?, role = ?, is_active = ? WHERE id = ?',
      [email, firstName, lastName, role, isActive, id]
    );
    connection.release();

    res.json({ message: 'Admin updated successfully' });
  } catch (err) {
    logger.error(`Update admin error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update admin' });
  }
};

/**
 * Delete Admin
 */
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE admins SET is_active = FALSE WHERE id = ?',
      [id]
    );
    connection.release();

    res.json({ message: 'Admin deleted successfully' });
  } catch (err) {
    logger.error(`Delete admin error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
};
