const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Create Exam
 */
exports.createExam = async (req, res) => {
  try {
    const { title, subjectId, classLevel, departmentId, description, totalQuestions, totalMarks, durationMinutes, passMark, startTime, endTime } = req.body;
    
    const id = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO exams (id, title, subject_id, class_level, department_id, description, total_questions, total_marks, duration_minutes, pass_mark, start_time, end_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, subjectId, classLevel, departmentId || null, description, totalQuestions, totalMarks, durationMinutes, passMark, startTime, endTime, req.user.id]
    );
    connection.release();

    res.status(201).json({ id, message: 'Exam created successfully' });
  } catch (err) {
    logger.error(`Create exam error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create exam' });
  }
};

/**
 * List Exams
 */
exports.listExams = async (req, res) => {
  try {
    const { classLevel, subjectId, departmentId } = req.query;
    
    let query = `SELECT e.*, s.name as subject_name, d.name as department_name 
                 FROM exams e
                 LEFT JOIN subjects s ON e.subject_id = s.id
                 LEFT JOIN departments d ON e.department_id = d.id
                 WHERE e.is_active = TRUE`;
    const params = [];

    if (classLevel) {
      query += ' AND e.class_level = ?';
      params.push(classLevel);
    }

    if (subjectId) {
      query += ' AND e.subject_id = ?';
      params.push(subjectId);
    }

    if (departmentId) {
      query += ' AND e.department_id = ?';
      params.push(departmentId);
    }

    query += ' ORDER BY e.start_time DESC';

    const connection = await pool.getConnection();
    const [exams] = await connection.query(query, params);
    connection.release();

    res.json(exams);
  } catch (err) {
    logger.error(`List exams error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get exams' });
  }
};

/**
 * Get Exam Details
 */
exports.getExamDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    const [exams] = await connection.query(
      'SELECT * FROM exams WHERE id = ?',
      [id]
    );
    connection.release();

    if (exams.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    res.json(exams[0]);
  } catch (err) {
    logger.error(`Get exam details error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get exam details' });
  }
};

/**
 * Update Exam
 */
exports.updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, totalMarks, durationMinutes, passMark, startTime, endTime } = req.body;
    
    const connection = await pool.getConnection();
    await connection.query(
      `UPDATE exams SET title = ?, description = ?, total_marks = ?, duration_minutes = ?, pass_mark = ?, start_time = ?, end_time = ? WHERE id = ?`,
      [title, description, totalMarks, durationMinutes, passMark, startTime, endTime, id]
    );
    connection.release();

    res.json({ message: 'Exam updated successfully' });
  } catch (err) {
    logger.error(`Update exam error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update exam' });
  }
};

/**
 * Delete Exam
 */
exports.deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE exams SET is_active = FALSE WHERE id = ?',
      [id]
    );
    connection.release();

    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    logger.error(`Delete exam error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete exam' });
  }
};

/**
 * Release Results
 */
exports.releaseResults = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE exams SET is_results_released = TRUE, released_at = NOW() WHERE id = ?',
      [id]
    );
    connection.release();

    res.json({ message: 'Results released successfully' });
  } catch (err) {
    logger.error(`Release results error: ${err.message}`);
    res.status(500).json({ error: 'Failed to release results' });
  }
};

/**
 * Get Exam Questions (for student)
 */
exports.getExamQuestions = async (req, res) => {
  try {
    const { id, studentId } = req.params;
    
    const connection = await pool.getConnection();
    
    // Get questions
    const [questions] = await connection.query(
      `SELECT id, question_text, question_type, marks, image_url FROM exam_questions 
       WHERE exam_id = ? ORDER BY order_index ASC`,
      [id]
    );

    // Get options for MCQ questions
    for (let q of questions) {
      if (q.question_type === 'MCQ') {
        const [options] = await connection.query(
          `SELECT id, option_text, option_key FROM question_options WHERE question_id = ? ORDER BY order_index ASC`,
          [q.id]
        );
        q.options = options;
      }
    }
    
    connection.release();

    res.json(questions);
  } catch (err) {
    logger.error(`Get exam questions error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get questions' });
  }
};

/**
 * Get Available Exams for Student
 */
exports.getAvailableExams = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const connection = await pool.getConnection();
    const [exams] = await connection.query(
      `SELECT e.*, s.name as subject_name 
       FROM exams e
       INNER JOIN student_exams se ON e.id = se.exam_id
       INNER JOIN subjects s ON e.subject_id = s.id
       WHERE se.student_id = ? AND e.is_active = TRUE
       AND NOW() >= e.start_time AND NOW() <= e.end_time
       ORDER BY e.start_time ASC`,
      [studentId]
    );
    connection.release();

    res.json(exams);
  } catch (err) {
    logger.error(`Get available exams error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get exams' });
  }
};
