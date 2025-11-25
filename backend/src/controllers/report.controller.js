const pool = require('../../config/database');
const logger = require('../utils/logger');

/**
 * Student Report
 */
exports.studentReport = async (req, res) => {
  try {
    const { classLevel, departmentId } = req.query;
    
    let query = 'SELECT id, student_id, first_name, last_name, email, class_level, registration_date FROM students WHERE is_active = TRUE';
    const params = [];

    if (classLevel) {
      query += ' AND class_level = ?';
      params.push(classLevel);
    }

    if (departmentId) {
      query += ' AND department_id = ?';
      params.push(departmentId);
    }

    query += ' ORDER BY first_name ASC';

    const connection = await pool.getConnection();
    const [students] = await connection.query(query, params);
    connection.release();

    res.json(students);
  } catch (err) {
    logger.error(`Student report error: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

/**
 * Exam Report
 */
exports.examReport = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [exams] = await connection.query(
      `SELECT e.id, e.title, s.name as subject_name, e.class_level, e.total_questions, 
              e.total_marks, e.start_time, e.end_time, e.is_results_released,
              COUNT(DISTINCT ea.id) as total_attempts
       FROM exams e
       LEFT JOIN subjects s ON e.subject_id = s.id
       LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
       WHERE e.is_active = TRUE
       GROUP BY e.id
       ORDER BY e.start_time DESC`
    );
    connection.release();

    res.json(exams);
  } catch (err) {
    logger.error(`Exam report error: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

/**
 * Results Report
 */
exports.resultsReport = async (req, res) => {
  try {
    const { classLevel, departmentId, examId } = req.query;
    
    let query = `SELECT ea.id, s.student_id, CONCAT(s.first_name, ' ', s.last_name) as student_name,
                        e.title as exam_title, ea.total_marks_obtained, ea.percentage, 
                        ea.submit_time, ea.status, e.pass_mark
                 FROM exam_attempts ea
                 INNER JOIN students s ON ea.student_id = s.id
                 INNER JOIN exams e ON ea.exam_id = e.id
                 WHERE ea.status IN ('submitted', 'synced')`;
    const params = [];

    if (classLevel) {
      query += ' AND s.class_level = ?';
      params.push(classLevel);
    }

    if (departmentId) {
      query += ' AND s.department_id = ?';
      params.push(departmentId);
    }

    if (examId) {
      query += ' AND ea.exam_id = ?';
      params.push(examId);
    }

    query += ' ORDER BY ea.submit_time DESC';

    const connection = await pool.getConnection();
    const [results] = await connection.query(query, params);
    connection.release();

    res.json(results);
  } catch (err) {
    logger.error(`Results report error: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

/**
 * Exam Attempts Report
 */
exports.examAttemptsReport = async (req, res) => {
  try {
    const { examId } = req.params;
    
    const connection = await pool.getConnection();
    const [attempts] = await connection.query(
      `SELECT ea.id, s.student_id, CONCAT(s.first_name, ' ', s.last_name) as student_name,
              ea.start_time, ea.submit_time, ea.total_marks_obtained, ea.percentage,
              ea.status
       FROM exam_attempts ea
       INNER JOIN students s ON ea.student_id = s.id
       WHERE ea.exam_id = ?
       ORDER BY ea.total_marks_obtained DESC`,
      [examId]
    );
    connection.release();

    res.json(attempts);
  } catch (err) {
    logger.error(`Exam attempts report error: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

/**
 * Export Students CSV
 */
exports.exportStudentsCSV = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [students] = await connection.query(
      'SELECT student_id, first_name, last_name, email, phone, gender, class_level FROM students WHERE is_active = TRUE'
    );
    connection.release();

    let csv = 'Student ID,First Name,Last Name,Email,Phone,Gender,Class Level\n';
    students.forEach(s => {
      csv += `${s.student_id},"${s.first_name}","${s.last_name}","${s.email}","${s.phone}","${s.gender}","${s.class_level}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
    res.send(csv);
  } catch (err) {
    logger.error(`Export students CSV error: ${err.message}`);
    res.status(500).json({ error: 'Failed to export data' });
  }
};

/**
 * Export Results CSV
 */
exports.exportResultsCSV = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [results] = await connection.query(
      `SELECT s.student_id, CONCAT(s.first_name, ' ', s.last_name) as student_name,
              e.title as exam_title, ea.total_marks_obtained, ea.percentage, ea.submit_time
       FROM exam_attempts ea
       INNER JOIN students s ON ea.student_id = s.id
       INNER JOIN exams e ON ea.exam_id = e.id
       WHERE ea.status IN ('submitted', 'synced')
       ORDER BY ea.submit_time DESC`
    );
    connection.release();

    let csv = 'Student ID,Student Name,Exam,Marks Obtained,Percentage,Submit Time\n';
    results.forEach(r => {
      csv += `${r.student_id},"${r.student_name}","${r.exam_title}",${r.total_marks_obtained},${r.percentage},"${r.submit_time}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
    res.send(csv);
  } catch (err) {
    logger.error(`Export results CSV error: ${err.message}`);
    res.status(500).json({ error: 'Failed to export data' });
  }
};

/**
 * Export Results PDF
 */
exports.exportResultsPDF = async (req, res) => {
  try {
    // TODO: Implement PDF export using a library like pdfkit or puppeteer
    res.json({ message: 'PDF export coming soon' });
  } catch (err) {
    logger.error(`Export results PDF error: ${err.message}`);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
};
