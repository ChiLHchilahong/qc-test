import { Router } from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';

const router = Router();
const VALID_STATUSES = new Set(['Draft', 'Ready', 'In Progress', 'Blocked', 'Ready for Sign-off', 'Closed']);

function normalizeStatus(value) {
  const status = String(value || '').trim();
  return VALID_STATUSES.has(status) ? status : 'Draft';
}

function ensureOwnedProject(scope, projectId) {
  return scope.isAdmin
    ? db.prepare('SELECT id, owner_key FROM projects WHERE id = ?').get(projectId)
    : db.prepare('SELECT id, owner_key FROM projects WHERE id = ? AND owner_key = ?').get(projectId, scope.ownerKey);
}

function ensureOwnedVersion(scope, versionId) {
  return scope.isAdmin
    ? db.prepare('SELECT id, project_id FROM versions WHERE id = ?').get(versionId)
    : db.prepare(`
        SELECT v.id, v.project_id
        FROM versions v
        JOIN projects p ON p.id = v.project_id
        WHERE v.id = ? AND p.owner_key = ?
      `).get(versionId, scope.ownerKey);
}

// GET / - List test plans with optional filters
router.get('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const versionId = req.query.versionId ? Number(req.query.versionId) : null;
    const status = String(req.query.status || '').trim();

    const conditions = [];
    const values = [];

    if (!scope.isAdmin) {
      conditions.push('tp.owner_key = ?');
      values.push(scope.ownerKey);
    }
    if (projectId) {
      conditions.push('tp.project_id = ?');
      values.push(projectId);
    }
    if (versionId) {
      conditions.push('tp.version_id = ?');
      values.push(versionId);
    }
    if (status && VALID_STATUSES.has(status)) {
      conditions.push('tp.status = ?');
      values.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT
        tp.*,
        p.name AS project_name,
        v.name AS version_name
      FROM test_plans tp
      JOIN projects p ON p.id = tp.project_id
      LEFT JOIN versions v ON v.id = tp.version_id
      ${where}
      ORDER BY tp.created_at DESC, tp.id DESC
    `).all(...values);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - Get test plan details
router.get('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const id = Number(req.params.id);

    const row = scope.isAdmin
      ? db.prepare(`
          SELECT tp.*, p.name AS project_name, v.name AS version_name
          FROM test_plans tp
          JOIN projects p ON p.id = tp.project_id
          LEFT JOIN versions v ON v.id = tp.version_id
          WHERE tp.id = ?
        `).get(id)
      : db.prepare(`
          SELECT tp.*, p.name AS project_name, v.name AS version_name
          FROM test_plans tp
          JOIN projects p ON p.id = tp.project_id
          LEFT JOIN versions v ON v.id = tp.version_id
          WHERE tp.id = ? AND tp.owner_key = ?
        `).get(id, scope.ownerKey);

    if (!row) {
      return res.status(404).json({ error: 'Test plan not found' });
    }

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create test plan
router.post('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const {
      projectId,
      versionId,
      name,
      objective = '',
      scopeIn = '',
      scopeOut = '',
      entryCriteria = '',
      exitCriteria = '',
      status,
      assignee = '',
      plannedStartDate = null,
      plannedEndDate = null,
    } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Test plan name is required' });
    }

    const project = ensureOwnedProject(scope, Number(projectId));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let safeVersionId = null;
    if (versionId) {
      const version = ensureOwnedVersion(scope, Number(versionId));
      if (!version || Number(version.project_id) !== Number(projectId)) {
        return res.status(404).json({ error: 'Version not found in project' });
      }
      safeVersionId = Number(versionId);
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO test_plans (
        project_id, version_id, owner_key, name,
        objective, scope_in, scope_out,
        entry_criteria, exit_criteria,
        status, assignee,
        planned_start_date, planned_end_date,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(projectId),
      safeVersionId,
      scope.isAdmin ? (project.owner_key || scope.ownerKey) : scope.ownerKey,
      String(name).trim(),
      String(objective || ''),
      String(scopeIn || ''),
      String(scopeOut || ''),
      String(entryCriteria || ''),
      String(exitCriteria || ''),
      normalizeStatus(status),
      String(assignee || ''),
      plannedStartDate || null,
      plannedEndDate || null,
      now
    );

    const created = db.prepare('SELECT * FROM test_plans WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - Update test plan
router.put('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const id = Number(req.params.id);

    const existing = scope.isAdmin
      ? db.prepare('SELECT * FROM test_plans WHERE id = ?').get(id)
      : db.prepare('SELECT * FROM test_plans WHERE id = ? AND owner_key = ?').get(id, scope.ownerKey);

    if (!existing) {
      return res.status(404).json({ error: 'Test plan not found' });
    }

    const {
      name,
      objective,
      scopeIn,
      scopeOut,
      entryCriteria,
      exitCriteria,
      status,
      assignee,
      plannedStartDate,
      plannedEndDate,
      actualEndDate,
      signOffBy,
      signOffNote,
      versionId,
    } = req.body || {};

    let nextVersionId = existing.version_id;
    if (versionId !== undefined) {
      if (versionId === null || versionId === '') {
        nextVersionId = null;
      } else {
        const version = ensureOwnedVersion(scope, Number(versionId));
        if (!version || Number(version.project_id) !== Number(existing.project_id)) {
          return res.status(404).json({ error: 'Version not found in project' });
        }
        nextVersionId = Number(versionId);
      }
    }

    const nextName = name !== undefined ? String(name || '').trim() : existing.name;
    if (!nextName) {
      return res.status(400).json({ error: 'Test plan name is required' });
    }

    const updatePayload = {
      name: nextName,
      objective: objective !== undefined ? String(objective || '') : existing.objective,
      scope_in: scopeIn !== undefined ? String(scopeIn || '') : existing.scope_in,
      scope_out: scopeOut !== undefined ? String(scopeOut || '') : existing.scope_out,
      entry_criteria: entryCriteria !== undefined ? String(entryCriteria || '') : existing.entry_criteria,
      exit_criteria: exitCriteria !== undefined ? String(exitCriteria || '') : existing.exit_criteria,
      status: status !== undefined ? normalizeStatus(status) : existing.status,
      assignee: assignee !== undefined ? String(assignee || '') : existing.assignee,
      planned_start_date: plannedStartDate !== undefined ? (plannedStartDate || null) : existing.planned_start_date,
      planned_end_date: plannedEndDate !== undefined ? (plannedEndDate || null) : existing.planned_end_date,
      actual_end_date: actualEndDate !== undefined ? (actualEndDate || null) : existing.actual_end_date,
      sign_off_by: signOffBy !== undefined ? String(signOffBy || '') : existing.sign_off_by,
      sign_off_note: signOffNote !== undefined ? String(signOffNote || '') : existing.sign_off_note,
      version_id: nextVersionId,
      updated_at: new Date().toISOString(),
    };

    db.prepare(`
      UPDATE test_plans
      SET
        name = @name,
        objective = @objective,
        scope_in = @scope_in,
        scope_out = @scope_out,
        entry_criteria = @entry_criteria,
        exit_criteria = @exit_criteria,
        status = @status,
        assignee = @assignee,
        planned_start_date = @planned_start_date,
        planned_end_date = @planned_end_date,
        actual_end_date = @actual_end_date,
        sign_off_by = @sign_off_by,
        sign_off_note = @sign_off_note,
        version_id = @version_id,
        updated_at = @updated_at
      WHERE id = @id
    `).run({ ...updatePayload, id });

    const updated = db.prepare('SELECT * FROM test_plans WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/sign-off - Sign off test plan
router.post('/:id/sign-off', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const id = Number(req.params.id);
    const { note = '', status = 'Closed' } = req.body || {};

    const existing = scope.isAdmin
      ? db.prepare('SELECT * FROM test_plans WHERE id = ?').get(id)
      : db.prepare('SELECT * FROM test_plans WHERE id = ? AND owner_key = ?').get(id, scope.ownerKey);

    if (!existing) {
      return res.status(404).json({ error: 'Test plan not found' });
    }

    const nextStatus = VALID_STATUSES.has(status) ? status : 'Closed';
    db.prepare(`
      UPDATE test_plans
      SET
        status = ?,
        sign_off_by = ?,
        sign_off_note = ?,
        actual_end_date = COALESCE(actual_end_date, datetime('now')),
        updated_at = ?
      WHERE id = ?
    `).run(nextStatus, scope.isGuest ? 'guest' : (scope.username || 'unknown'), String(note || ''), new Date().toISOString(), id);

    const updated = db.prepare('SELECT * FROM test_plans WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - Delete test plan
router.delete('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const result = scope.isAdmin
      ? db.prepare('DELETE FROM test_plans WHERE id = ?').run(req.params.id)
      : db.prepare('DELETE FROM test_plans WHERE id = ? AND owner_key = ?').run(req.params.id, scope.ownerKey);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Test plan not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
