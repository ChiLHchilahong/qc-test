import { Router } from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';

const router = Router();

const ALLOWED_SEVERITY = ['Critical', 'Major', 'Minor', 'Trivial'];
const ALLOWED_PRIORITY = ['High', 'Medium', 'Low'];
const ALLOWED_STATUS   = ['Open', 'In Progress', 'Fixed', 'Retest', 'Closed'];

// GET / - List bugs (supports ?project_id, ?build_id, ?status, ?severity filters)
router.get('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { project_id, build_id, status, severity } = req.query;

    let sql = `
      SELECT b.*,
             p.name AS project_name,
             v.name AS version_name,
             bl.name AS build_name
      FROM bugs b
      LEFT JOIN projects p ON p.id = b.project_id
      LEFT JOIN versions v ON v.id = b.version_id
      LEFT JOIN builds bl ON bl.id = b.build_id
      WHERE 1=1
    `;
    const params = [];

    if (!scope.isAdmin) {
      sql += ' AND b.owner_key = ?';
      params.push(scope.ownerKey);
    }
    if (project_id) { sql += ' AND b.project_id = ?'; params.push(project_id); }
    if (build_id)   { sql += ' AND b.build_id = ?';   params.push(build_id); }
    if (status)     { sql += ' AND b.status = ?';     params.push(status); }
    if (severity)   { sql += ' AND b.severity = ?';   params.push(severity); }

    sql += ' ORDER BY b.id DESC';

    const bugs = db.prepare(sql).all(...params);
    res.json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create bug
router.post('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const {
      title, description, steps_to_reproduce, expected_result, actual_result,
      severity, priority, status, environment,
      project_id, version_id, build_id, test_case_id,
      reported_by, assigned_to,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const result = db.prepare(`
      INSERT INTO bugs
        (title, description, steps_to_reproduce, expected_result, actual_result,
         severity, priority, status, environment,
         project_id, version_id, build_id, test_case_id,
         reported_by, assigned_to, owner_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(title).trim(),
      description || '',
      steps_to_reproduce || '',
      expected_result || '',
      actual_result || '',
      ALLOWED_SEVERITY.includes(severity) ? severity : 'Major',
      ALLOWED_PRIORITY.includes(priority) ? priority : 'Medium',
      ALLOWED_STATUS.includes(status) ? status : 'Open',
      environment || '',
      project_id || null,
      version_id || null,
      build_id || null,
      test_case_id || null,
      reported_by || '',
      assigned_to || '',
      scope.ownerKey,
    );

    const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(bug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - Update bug
router.put('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const id = req.params.id;

    const existing = scope.isAdmin
      ? db.prepare('SELECT id FROM bugs WHERE id = ?').get(id)
      : db.prepare('SELECT id FROM bugs WHERE id = ? AND owner_key = ?').get(id, scope.ownerKey);

    if (!existing) return res.status(404).json({ error: 'Bug not found' });

    const allowed = [
      'title', 'description', 'steps_to_reproduce', 'expected_result', 'actual_result',
      'severity', 'priority', 'status', 'environment',
      'project_id', 'version_id', 'build_id', 'test_case_id',
      'reported_by', 'assigned_to',
    ];

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(req.body)) {
      if (allowed.includes(key)) {
        // Validate enum fields
        if (key === 'severity' && !ALLOWED_SEVERITY.includes(value)) continue;
        if (key === 'priority' && !ALLOWED_PRIORITY.includes(value)) continue;
        if (key === 'status'   && !ALLOWED_STATUS.includes(value))   continue;
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push("updated_at = datetime('now')");
    db.prepare(`UPDATE bugs SET ${setClauses.join(', ')} WHERE id = ?`).run(...values, id);

    const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
    res.json(bug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - Delete bug
router.delete('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const id = req.params.id;

    const result = scope.isAdmin
      ? db.prepare('DELETE FROM bugs WHERE id = ?').run(id)
      : db.prepare('DELETE FROM bugs WHERE id = ? AND owner_key = ?').run(id, scope.ownerKey);

    if (result.changes === 0) return res.status(404).json({ error: 'Bug not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
