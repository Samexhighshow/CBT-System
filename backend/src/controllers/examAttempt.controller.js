const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Start Exam
 */
exports.startExam = async (req, res) => {
  try {
    const { attemptId } = req.body;
    const { id: studentId } = req.user;
    const { examId } = req.params;
    
    const id = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO exam_attempts (id, student_id, exam_id, start_time, status)
       VALUES (?, ?, ?, NOW(), 'in_progress')`,
      [id, studentId, examId]
    );
    connection.release();

    res.status(201).json({ attemptId: id, message: 'Exam started' });
  } catch (err) {
    logger.error(`Start exam error: ${err.message}`);
    res.status(500).json({ error: 'Failed to start exam' });
  }
};

/**
 * Save Answer
 */
exports.saveAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selectedOptionId, answerText } = req.body;
    
    const id = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO student_answers (id, exam_attempt_id, question_id, selected_option_id, answer_text, last_modified)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE selected_option_id = VALUES(selected_option_id), 
       answer_text = VALUES(answer_text), last_modified = NOW()`,
      [id, attemptId, questionId, selectedOptionId || null, answerText || null]
    );
    connection.release();

    res.json({ message: 'Answer saved' });
  } catch (err) {
    logger.error(`Save answer error: ${err.message}`);
    res.status(500).json({ error: 'Failed to save answer' });
  }
};

/**
 * Submit Exam
 */
exports.submitExam = async (req, res) => {
  try {
    const { attemptId } = req.params;
    
    const connection = await pool.getConnection();
    
    // Get exam attempt details
    const [attempts] = await connection.query(
      'SELECT * FROM exam_attempts WHERE id = ?',
      [attemptId]
    );

    if (attempts.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attempts[0];

    // Calculate score
    const [answers] = await connection.query(
      `SELECT sa.*, qo.is_correct, eq.marks 
       FROM student_answers sa
       LEFT JOIN question_options qo ON sa.selected_option_id = qo.id
       LEFT JOIN exam_questions eq ON sa.question_id = eq.id
       WHERE sa.exam_attempt_id = ?`,
      [attemptId]
    );

    let totalMarks = 0;
    for (let answer of answers) {
      if (answer.is_correct) {
        totalMarks += answer.marks || 1;
        // Update answer with marks
        await connection.query(
          'UPDATE student_answers SET is_correct = TRUE, marks_obtained = ? WHERE id = ?',
          [answer.marks || 1, answer.id]
        );
      }
    }

    // Get exam to calculate percentage
    const [exams] = await connection.query(
      'SELECT total_marks FROM exams WHERE id = ?',
      [attempt.exam_id]
    );

    const percentage = (totalMarks / exams[0].total_marks) * 100;

    // Update exam attempt
    await connection.query(
      `UPDATE exam_attempts SET total_marks_obtained = ?, percentage = ?, submit_time = NOW(), status = 'submitted' WHERE id = ?`,
      [totalMarks, percentage.toFixed(2), attemptId]
    );

    connection.release();

    res.json({ 
      message: 'Exam submitted successfully',
      totalMarks,
      percentage: percentage.toFixed(2)
    });
  } catch (err) {
    logger.error(`Submit exam error: ${err.message}`);
    res.status(500).json({ error: 'Failed to submit exam' });
  }
};

/**
 * Get Attempt
 */
exports.getAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    
    const connection = await pool.getConnection();
    const [attempts] = await connection.query(
      'SELECT * FROM exam_attempts WHERE id = ?',
      [attemptId]
    );
    connection.release();

    if (attempts.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    res.json(attempts[0]);
  } catch (err) {
    logger.error(`Get attempt error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get attempt' });
  }
};

/**
 * Get Student Exam Attempt
 */
exports.getStudentExamAttempt = async (req, res) => {
  try {
    const { examId, studentId } = req.params;
    
    const connection = await pool.getConnection();
    const [attempts] = await connection.query(
      'SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ? ORDER BY created_at DESC LIMIT 1',
      [examId, studentId]
    );
    connection.release();

    if (attempts.length === 0) {
      return res.status(404).json({ error: 'No attempt found' });
    }

    res.json(attempts[0]);
  } catch (err) {
    logger.error(`Get student exam attempt error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get attempt' });
  }
};

/**
 * List Attempts (Admin)
 */
exports.listAttempts = async (req, res) => {
  try {
    const { studentId, examId, status } = req.query;
    
    let query = `SELECT ea.*, s.student_id, s.first_name, e.title as exam_title
                 FROM exam_attempts ea
                 INNER JOIN students s ON ea.student_id = s.id
                 INNER JOIN exams e ON ea.exam_id = e.id
                 WHERE 1=1`;
    const params = [];

    if (studentId) {
      query += ' AND ea.student_id = ?';
      params.push(studentId);
    }

    if (examId) {
      query += ' AND ea.exam_id = ?';
      params.push(examId);
    }

    if (status) {
      query += ' AND ea.status = ?';
      params.push(status);
    }

    query += ' ORDER BY ea.submit_time DESC';

    const connection = await pool.getConnection();
    const [attempts] = await connection.query(query, params);
    connection.release();

    res.json(attempts);
  } catch (err) {
    logger.error(`List attempts error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get attempts' });
  }
};

/**
 * Get Exam Attempts
 */
exports.getExamAttempts = async (req, res) => {
  try {
    const { examId } = req.params;
    
    const connection = await pool.getConnection();
    const [attempts] = await connection.query(
      `SELECT ea.*, s.student_id, s.first_name, s.last_name
       FROM exam_attempts ea
       INNER JOIN students s ON ea.student_id = s.id
       WHERE ea.exam_id = ?
       ORDER BY ea.total_marks_obtained DESC, s.first_name ASC`,
      [examId]
    );
    connection.release();

    res.json(attempts);
  } catch (err) {
    logger.error(`Get exam attempts error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get attempts' });
  }
};
