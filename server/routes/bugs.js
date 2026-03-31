import { Router } from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';
import { logActivity } from '../activity.js';

const router = Router();

const ALLOWED_SEVERITY = ['Critical', 'Major', 'Minor', 'Trivial'];
const ALLOWED_PRIORITY = ['High', 'Medium', 'Low'];
const ALLOWED_STATUS   = ['Open', 'In Progress', 'Fixed', 'Retest', 'Closed'];

// GET / - List bugs (supports ?project_id, ?version_id, ?build_id, ?status, ?severity, ?test_plan_id, ?page, ?limit filters)
router.get('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { project_id, version_id, build_id, status, severity, test_plan_id, page, limit } = req.query;

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
    if (project_id)   { sql += ' AND b.project_id = ?';   params.push(project_id); }
    if (version_id)   { sql += ' AND b.version_id = ?';   params.push(version_id); }
    if (build_id)     { sql += ' AND b.build_id = ?';     params.push(build_id); }
    if (status)       { sql += ' AND b.status = ?';       params.push(status); }
    if (severity)     { sql += ' AND b.severity = ?';     params.push(severity); }
    if (test_plan_id) { sql += ' AND b.test_plan_id = ?'; params.push(test_plan_id); }

    sql += ' ORDER BY b.id DESC';

    // If page param provided, return paginated response
    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 25));
      const offset = (pageNum - 1) * limitNum;

      const countSql = `SELECT COUNT(*) AS cnt FROM (${sql}) t`;
      const total = db.prepare(countSql).get(...params)?.cnt || 0;

      const data = db.prepare(`${sql} LIMIT ? OFFSET ?`).all(...params, limitNum, offset);
      return res.json({ data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    }

    const bugs = db.prepare(sql).all(...params);
    res.json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /stats - Return per-status bug counts (with optional project_id / version_id filters)
router.get('/stats', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { project_id, version_id } = req.query;

    let sql = `
      SELECT status, COUNT(*) AS cnt
      FROM bugs b
      WHERE 1=1
    `;
    const params = [];
    if (!scope.isAdmin) { sql += ' AND b.owner_key = ?'; params.push(scope.ownerKey); }
    if (project_id) { sql += ' AND b.project_id = ?'; params.push(project_id); }
    if (version_id) { sql += ' AND b.version_id = ?'; params.push(version_id); }
    sql += ' GROUP BY status';

    const rows = db.prepare(sql).all(...params);
    const result = {};
    rows.forEach((r) => { result[r.status] = r.cnt; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - Get single bug with full details
router.get('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const id = req.params.id;

    const bug = scope.isAdmin
      ? db.prepare(`
          SELECT b.*,
                 p.name AS project_name,
                 v.name AS version_name,
                 bl.name AS build_name,
                 tc.description AS test_case_description
          FROM bugs b
          LEFT JOIN projects p ON p.id = b.project_id
          LEFT JOIN versions v ON v.id = b.version_id
          LEFT JOIN builds bl ON bl.id = b.build_id
          LEFT JOIN test_cases tc ON tc.id = b.test_case_id
          WHERE b.id = ?
        `).get(id)
      : db.prepare(`
          SELECT b.*,
                 p.name AS project_name,
                 v.name AS version_name,
                 bl.name AS build_name,
                 tc.description AS test_case_description
          FROM bugs b
          LEFT JOIN projects p ON p.id = b.project_id
          LEFT JOIN versions v ON v.id = b.version_id
          LEFT JOIN builds bl ON bl.id = b.build_id
          LEFT JOIN test_cases tc ON tc.id = b.test_case_id
          WHERE b.id = ? AND b.owner_key = ?
        `).get(id, scope.ownerKey);

    if (!bug) return res.status(404).json({ error: 'Bug not found' });
    res.json(bug);
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
    logActivity({ action: 'create', entity_type: 'bug', entity_id: bug.id, entity_label: bug.title, actor: req.headers['x-qc-username'] || '' });
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
      'project_id', 'version_id', 'build_id', 'test_case_id', 'test_plan_id',
      'reported_by', 'assigned_to', 'resolution_note',
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
  logActivity({ action: 'update', entity_type: 'bug', entity_id: bug.id, entity_label: bug.title, actor: req.headers['x-qc-username'] || '', detail: Object.keys(req.body).join(', ') });
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
    logActivity({ action: 'delete', entity_type: 'bug', entity_id: Number(id), actor: req.headers['x-qc-username'] || '' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /bulk-status - Bulk update status for multiple bugs
router.post('/bulk-status', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { ids, status, resolution_note } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const setClauses = ["status = ?", "updated_at = datetime('now')"];
    const baseValues = [status];
    if (resolution_note !== undefined) {
      setClauses.push('resolution_note = ?');
      baseValues.push(resolution_note);
    }

    const update = db.transaction(() => {
      let changed = 0;
      for (const id of ids) {
        const r = scope.isAdmin
          ? db.prepare(`UPDATE bugs SET ${setClauses.join(', ')} WHERE id = ?`).run(...baseValues, id)
          : db.prepare(`UPDATE bugs SET ${setClauses.join(', ')} WHERE id = ? AND owner_key = ?`).run(...baseValues, id, scope.ownerKey);
        changed += r.changes;
      }
      return changed;
    });

    const changed = update();
    logActivity({ action: 'bulk_status', entity_type: 'bug', actor: req.headers['x-qc-username'] || '', detail: `Set ${ids.length} bug(s) to ${status}` });
    res.json({ success: true, updated: changed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
