const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Create Department
 */
exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description, appliesToClass } = req.body;
    
    const id = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO departments (id, name, code, description, applies_to_class)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, code, description, appliesToClass || 'SSS']
    );
    connection.release();

    res.status(201).json({ id, message: 'Department created successfully' });
  } catch (err) {
    logger.error(`Create department error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create department' });
  }
};

/**
 * List Departments
 */
exports.listDepartments = async (req, res) => {
  try {
    const { appliesToClass } = req.query;
    
    let query = 'SELECT * FROM departments WHERE is_active = TRUE';
    const params = [];

    if (appliesToClass) {
      query += ' AND applies_to_class = ?';
      params.push(appliesToClass);
    }

    query += ' ORDER BY name ASC';

    const connection = await pool.getConnection();
    const [departments] = await connection.query(query, params);
    connection.release();

    res.json(departments);
  } catch (err) {
    logger.error(`List departments error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get departments' });
  }
};

/**
 * Get Department
 */
exports.getDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    const [departments] = await connection.query(
      'SELECT * FROM departments WHERE id = ?',
      [id]
    );
    connection.release();

    if (departments.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json(departments[0]);
  } catch (err) {
    logger.error(`Get department error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get department' });
  }
};

/**
 * Update Department
 */
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE departments SET name = ?, code = ?, description = ? WHERE id = ?',
      [name, code, description, id]
    );
    connection.release();

    res.json({ message: 'Department updated successfully' });
  } catch (err) {
    logger.error(`Update department error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update department' });
  }
};

/**
 * Delete Department
 */
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE departments SET is_active = FALSE WHERE id = ?',
      [id]
    );
    connection.release();

    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    logger.error(`Delete department error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete department' });
  }
};

/**
 * Add Subject to Department
 */
exports.addSubjectToDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectId, isCompulsory } = req.body;
    
    const depSubjId = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO department_subjects (id, department_id, subject_id, is_compulsory)
       VALUES (?, ?, ?, ?)`,
      [depSubjId, id, subjectId, isCompulsory || true]
    );
    connection.release();

    res.status(201).json({ id: depSubjId, message: 'Subject added to department' });
  } catch (err) {
    logger.error(`Add subject to department error: ${err.message}`);
    res.status(500).json({ error: 'Failed to add subject' });
  }
};

/**
 * Remove Subject from Department
 */
exports.removeSubjectFromDepartment = async (req, res) => {
  try {
    const { id, subjectId } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'DELETE FROM department_subjects WHERE department_id = ? AND subject_id = ?',
      [id, subjectId]
    );
    connection.release();

    res.json({ message: 'Subject removed from department' });
  } catch (err) {
    logger.error(`Remove subject from department error: ${err.message}`);
    res.status(500).json({ error: 'Failed to remove subject' });
  }
};

/**
 * Get Department Subjects
 */
exports.getDepartmentSubjects = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    const [subjects] = await connection.query(
      `SELECT s.*, ds.is_compulsory FROM subjects s
       INNER JOIN department_subjects ds ON s.id = ds.subject_id
       WHERE ds.department_id = ? AND s.is_active = TRUE
       ORDER BY ds.is_compulsory DESC, s.name ASC`,
      [id]
    );
    connection.release();

    res.json(subjects);
  } catch (err) {
    logger.error(`Get department subjects error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get subjects' });
  }
};

/**
 * Add Trade Subject to Department
 */
exports.addTradeSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { tradeSubjectId, isCompulsory, maxSelectable } = req.body;
    
    const deptTradeId = uuidv4();
    const connection = await pool.getConnection();
    
    await connection.query(
      `INSERT INTO department_trade_subjects (id, department_id, trade_subject_id, is_compulsory, max_selectable)
       VALUES (?, ?, ?, ?, ?)`,
      [deptTradeId, id, tradeSubjectId, isCompulsory || false, maxSelectable || 3]
    );
    connection.release();

    res.status(201).json({ id: deptTradeId, message: 'Trade subject added to department' });
  } catch (err) {
    logger.error(`Add trade subject error: ${err.message}`);
    res.status(500).json({ error: 'Failed to add trade subject' });
  }
};

/**
 * Remove Trade Subject from Department
 */
exports.removeTradeSubject = async (req, res) => {
  try {
    const { id, tradeSubjectId } = req.params;
    
    const connection = await pool.getConnection();
    await connection.query(
      'DELETE FROM department_trade_subjects WHERE department_id = ? AND trade_subject_id = ?',
      [id, tradeSubjectId]
    );
    connection.release();

    res.json({ message: 'Trade subject removed from department' });
  } catch (err) {
    logger.error(`Remove trade subject error: ${err.message}`);
    res.status(500).json({ error: 'Failed to remove trade subject' });
  }
};

/**
 * Get Department Trade Subjects
 */
exports.getDepartmentTradeSubjects = async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    const [tradeSubjects] = await connection.query(
      `SELECT ts.*, dts.is_compulsory, dts.max_selectable FROM trade_subjects ts
       INNER JOIN department_trade_subjects dts ON ts.id = dts.trade_subject_id
       WHERE dts.department_id = ? AND ts.is_active = TRUE
       ORDER BY ts.name ASC`,
      [id]
    );
    connection.release();

    res.json(tradeSubjects);
  } catch (err) {
    logger.error(`Get trade subjects error: ${err.message}`);
    res.status(500).json({ error: 'Failed to get trade subjects' });
  }
};
