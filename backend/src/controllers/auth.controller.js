const bcrypt = require('bcryptjs');
const jwtSimple = require('jwt-simple');
const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const SECRET = process.env.JWT_SECRET || 'your_secret_key';

/**
 * Admin Login
 */
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const connection = await pool.getConnection();
    const [admins] = await connection.query(
      'SELECT id, email, password_hash, role FROM admins WHERE email = ? AND is_active = TRUE',
      [email]
    );
    connection.release();

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = admins[0];
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin'
    };

    const token = jwtSimple.encode(payload, SECRET);
    const refreshToken = jwtSimple.encode({ ...payload, type: 'refresh' }, SECRET);

    res.json({
      token,
      refreshToken,
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    logger.error(`Admin login error: ${err.message}`);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Student Login
 */
exports.studentLogin = async (req, res) => {
  try {
    const { studentId, password } = req.body;
    
    const connection = await pool.getConnection();
    const [students] = await connection.query(
      'SELECT id, student_id, first_name, class_level, department_id FROM students WHERE student_id = ? AND is_active = TRUE',
      [studentId]
    );
    connection.release();

    if (students.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const student = students[0];
    // Add password verification logic here

    const payload = {
      id: student.id,
      studentId: student.student_id,
      name: student.first_name,
      classLevel: student.class_level,
      departmentId: student.department_id,
      role: 'student',
      type: 'student'
    };

    const token = jwtSimple.encode(payload, SECRET);
    const refreshToken = jwtSimple.encode({ ...payload, type: 'refresh' }, SECRET);

    res.json({
      token,
      refreshToken,
      user: {
        id: student.id,
        studentId: student.student_id,
        name: student.first_name,
        classLevel: student.class_level
      }
    });
  } catch (err) {
    logger.error(`Student login error: ${err.message}`);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Refresh Token
 */
exports.refreshToken = (req, res) => {
  try {
    const newPayload = { ...req.user };
    delete newPayload.type;
    
    const token = jwtSimple.encode(newPayload, SECRET);
    const refreshToken = jwtSimple.encode({ ...newPayload, type: 'refresh' }, SECRET);

    res.json({
      token,
      refreshToken
    });
  } catch (err) {
    logger.error(`Token refresh error: ${err.message}`);
    res.status(500).json({ error: 'Token refresh failed' });
  }
};

/**
 * Logout
 */
exports.logout = (req, res) => {
  // Token invalidation logic (optional - can use blacklist in production)
  res.json({ message: 'Logged out successfully' });
};
