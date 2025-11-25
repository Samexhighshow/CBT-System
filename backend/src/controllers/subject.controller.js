const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Create Subject
 */
exports.createSubject = async (req, res) => {
  try {
    const { name, code, description, appliesToClass, isCompulsory, totalQuestions, timeDurationMinutes } = req.body;
    
    const id = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO subjects (id, name, code, description, applies_to_class, is_compulsory, total_questions, time_duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, code, description, appliesToClass, isCompulsory, totalQuestions, timeDurationMinutes]
    );
    connection.release();

    res.status(201).json({ id, message: 'Subject created successfully' });
  } catch (err) {
    logger.error(`Create subject error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create subject' });
  }
};

/**
 * List Subjects
 */
exports.listSubjects = async (req, res) => {
  try {
    const { classLevel, compulsoryOnly } = req.query;
    
    let query = 'SELECT * FROM subjects WHERE is_active = TRUE';
    const params = [];

    if (classLevel) {
      query += ' AND applies_to_class IN (?, "BOTH")';
      params.push(classLevel);
    }

    if (compulsoryOnly === 'true') {
      query += ' AND is_compulsory = TRUE';
    }

    query += ' ORDER BY name ASC';

    const connection = await pool.getConnection();
    const [subjects] = await connection.query(query, params);
    connection.release();

    res.json(subjects);
  } catch (err) {
    logger.error(`List subjects error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get subjects' });
  }
};

/**
 * Get Subject
 */
exports.getSubject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    const [subjects] = await connection.query(
      'SELECT * FROM subjects WHERE id = ?',
      [id]
    );
    connection.release();

    if (subjects.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    res.json(subjects[0]);
  } catch (err) {
    logger.error(`Get subject error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get subject' });
  }
};

/**
 * Update Subject
 */
exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, isCompulsory, totalQuestions, timeDurationMinutes } = req.body;
    
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE subjects SET name = ?, code = ?, description = ?, is_compulsory = ?, 
       total_questions = ?, time_duration_minutes = ? WHERE id = ?`,
      [name, code, description, isCompulsory, totalQuestions, timeDurationMinutes, id]
    );
    connection.release();

    res.json({ message: 'Subject updated successfully' });
  } catch (err) {
    logger.error(`Update subject error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update subject' });
  }
};

/**
 * Delete Subject
 */
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE subjects SET is_active = FALSE WHERE id = ?',
      [id]
    );
    connection.release();

    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    logger.error(`Delete subject error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
};

/**
 * Get Subjects by Class
 */
exports.getSubjectsByClass = async (req, res) => {
  try {
    const { classLevel } = req.params;
    
    const connection = await pool.getConnection();
    const [subjects] = await connection.query(
      `SELECT * FROM subjects 
       WHERE (applies_to_class = ? OR applies_to_class = 'BOTH') AND is_active = TRUE
       ORDER BY is_compulsory DESC, name ASC`,
      [classLevel]
    );
    connection.release();

    res.json(subjects);
  } catch (err) {
    logger.error(`Get subjects by class error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get subjects' });
  }
};

/**
 * Get Subjects by Department
 */
exports.getSubjectsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    
    const connection = await pool.getConnection();
    const [subjects] = await connection.query(
      `SELECT s.* FROM subjects s
       INNER JOIN department_subjects ds ON s.id = ds.subject_id
       WHERE ds.department_id = ? AND s.is_active = TRUE
       ORDER BY ds.is_compulsory DESC, s.name ASC`,
      [departmentId]
    );
    connection.release();

    res.json(subjects);
  } catch (err) {
    logger.error(`Get subjects by department error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get subjects' });
  }
};
