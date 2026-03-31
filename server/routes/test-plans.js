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

function clampPercent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampNonNegative(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function buildExecutionSummary(versionId) {
  if (!versionId) return null;

  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT b.id) AS build_count,
      COUNT(tc.id) AS total,
      SUM(CASE
        WHEN lower(trim(coalesce(tc.result, ''))) IN ('passed', 'pass') THEN 1
        ELSE 0
      END) AS passed,
      SUM(CASE
        WHEN lower(trim(coalesce(tc.result, ''))) IN ('failed', 'fail') THEN 1
        ELSE 0
      END) AS failed,
      SUM(CASE
        WHEN lower(trim(coalesce(tc.result, ''))) IN ('warning', 'warn') THEN 1
        ELSE 0
      END) AS warning,
      SUM(CASE
        WHEN lower(trim(coalesce(tc.result, ''))) IN ('in progress', 'in-progress', 'in_progress', 'inprogress') THEN 1
        ELSE 0
      END) AS in_progress,
      SUM(CASE
        WHEN tc.id IS NOT NULL AND lower(trim(coalesce(tc.result, ''))) NOT IN (
          'passed', 'pass',
          'failed', 'fail',
          'warning', 'warn',
          'in progress', 'in-progress', 'in_progress', 'inprogress'
        ) THEN 1
        ELSE 0
      END) AS not_run
    FROM builds b
    LEFT JOIN test_cases tc ON tc.build_id = b.id
    WHERE b.version_id = ?
  `).get(versionId);

  const total = Number(stats?.total || 0);
  const passed = Number(stats?.passed || 0);
  const failed = Number(stats?.failed || 0);
  const warning = Number(stats?.warning || 0);
  const inProgress = Number(stats?.in_progress || 0);
  const notRun = Number(stats?.not_run || 0);
  const executed = total - notRun;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const executionRate = total > 0 ? Math.round((executed / total) * 100) : 0;

  return {
    build_count: Number(stats?.build_count || 0),
    total,
    passed,
    failed,
    warning,
    in_progress: inProgress,
    not_run: notRun,
    executed,
    pass_rate: passRate,
    execution_rate: executionRate,
  };
}

function evaluateExecutionReadiness(summary, plan) {
  const thresholds = {
    min_pass_rate: clampPercent(plan?.min_pass_rate, 80),
    max_failed: clampNonNegative(plan?.max_failed, 0),
    max_not_run_percent: clampPercent(plan?.max_not_run_percent, 20),
  };

  if (!plan?.version_id) {
    return {
      status: 'NO_VERSION',
      can_sign_off: false,
      reasons: ['Link this plan to a version to evaluate readiness.'],
      thresholds,
    };
  }

  if (!summary || Number(summary.total || 0) === 0) {
    return {
      status: 'RISKY',
      can_sign_off: false,
      reasons: ['No test cases found in linked version.'],
      thresholds,
    };
  }

  const reasons = [];
  const passRate = Number(summary.pass_rate || 0);
  const failed = Number(summary.failed || 0);
  const notRunPercent = Number(summary.total || 0) > 0
    ? Math.round((Number(summary.not_run || 0) / Number(summary.total || 0)) * 100)
    : 100;

  if (failed > thresholds.max_failed) {
    reasons.push(`Failed (${failed}) vượt ngưỡng cho phép (${thresholds.max_failed}).`);
  }
  if (passRate < thresholds.min_pass_rate) {
    reasons.push(`Pass rate ${passRate}% thấp hơn ngưỡng ${thresholds.min_pass_rate}%.`);
  }
  if (notRunPercent > thresholds.max_not_run_percent) {
    reasons.push(`Not Run ${notRunPercent}% cao hơn ngưỡng ${thresholds.max_not_run_percent}%.`);
  }

  if (reasons.length === 0) {
    return {
      status: 'READY',
      can_sign_off: true,
      reasons: ['All quality thresholds are satisfied.'],
      thresholds,
    };
  }

  const hasBlockingFailed = failed > thresholds.max_failed;
  return {
    status: hasBlockingFailed ? 'BLOCKED' : 'RISKY',
    can_sign_off: false,
    reasons,
    thresholds,
  };
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

    const enriched = rows.map((row) => {
      const summary = buildExecutionSummary(row.version_id);
      const readiness = evaluateExecutionReadiness(summary, row);
      return {
        ...row,
        execution_readiness_status: readiness.status,
        execution_can_sign_off: readiness.can_sign_off,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import - Bulk import test plans
router.post('/import', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const inputPlans = Array.isArray(req.body?.plans) ? req.body.plans : [];
    if (inputPlans.length === 0) {
      return res.status(400).json({ error: 'plans array is required' });
    }

    const resolveProject = (projectIdRaw, projectNameRaw) => {
      const projectId = Number(projectIdRaw);
      if (Number.isFinite(projectId) && projectId > 0) {
        return ensureOwnedProject(scope, projectId);
      }

      const projectName = String(projectNameRaw || '').trim();
      if (!projectName) return null;
      return scope.isAdmin
        ? db.prepare('SELECT id, owner_key FROM projects WHERE name = ? ORDER BY id DESC').get(projectName)
        : db.prepare('SELECT id, owner_key FROM projects WHERE name = ? AND owner_key = ? ORDER BY id DESC').get(projectName, scope.ownerKey);
    };

    const resolveVersion = (versionIdRaw, versionNameRaw, projectId) => {
      const versionId = Number(versionIdRaw);
      if (Number.isFinite(versionId) && versionId > 0) {
        return ensureOwnedVersion(scope, versionId);
      }

      const versionName = String(versionNameRaw || '').trim();
      if (!versionName || !projectId) return null;

      return scope.isAdmin
        ? db.prepare('SELECT id, project_id FROM versions WHERE project_id = ? AND name = ? ORDER BY id DESC').get(projectId, versionName)
        : db.prepare(`
            SELECT v.id, v.project_id
            FROM versions v
            JOIN projects p ON p.id = v.project_id
            WHERE v.project_id = ? AND v.name = ? AND p.owner_key = ?
            ORDER BY v.id DESC
          `).get(projectId, versionName, scope.ownerKey);
    };

    const insertStmt = db.prepare(`
      INSERT INTO test_plans (
        project_id, version_id, owner_key, name,
        objective, scope_in, scope_out,
        entry_criteria, exit_criteria,
        status, min_pass_rate, max_failed, max_not_run_percent,
        assignee,
        planned_start_date, planned_end_date,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const imported = [];
    const errors = [];

    for (let i = 0; i < inputPlans.length; i++) {
      const row = inputPlans[i] || {};
      const name = String(row.name || '').trim();
      if (!name) {
        errors.push({ row: i + 1, error: 'Missing plan name' });
        continue;
      }

      const project = resolveProject(row.projectId, row.projectName);
      if (!project) {
        errors.push({ row: i + 1, error: 'Project not found or forbidden' });
        continue;
      }

      let versionId = null;
      const version = resolveVersion(row.versionId, row.versionName, project.id);
      if (version) {
        if (Number(version.project_id) !== Number(project.id)) {
          errors.push({ row: i + 1, error: 'Version does not belong to project' });
          continue;
        }
        versionId = Number(version.id);
      }

      const now = new Date().toISOString();
      const result = insertStmt.run(
        Number(project.id),
        versionId,
        scope.isAdmin ? (project.owner_key || scope.ownerKey) : scope.ownerKey,
        name,
        String(row.objective || ''),
        String(row.scopeIn || ''),
        String(row.scopeOut || ''),
        String(row.entryCriteria || ''),
        String(row.exitCriteria || ''),
        normalizeStatus(row.status),
        clampPercent(row.minPassRate, 80),
        clampNonNegative(row.maxFailed, 0),
        clampPercent(row.maxNotRunPercent, 20),
        String(row.assignee || ''),
        row.plannedStartDate || null,
        row.plannedEndDate || null,
        now
      );

      imported.push(result.lastInsertRowid);
    }

    res.json({
      success: true,
      imported: imported.length,
      importedIds: imported,
      errors,
    });
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

    const executionSummary = buildExecutionSummary(row.version_id);
    const executionReadiness = evaluateExecutionReadiness(executionSummary, row);
    res.json({ ...row, execution_summary: executionSummary, execution_readiness: executionReadiness });
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
      minPassRate,
      maxFailed,
      maxNotRunPercent,
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
        status, min_pass_rate, max_failed, max_not_run_percent, assignee,
        planned_start_date, planned_end_date,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      clampPercent(minPassRate, 80),
      clampNonNegative(maxFailed, 0),
      clampPercent(maxNotRunPercent, 20),
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
      minPassRate,
      maxFailed,
      maxNotRunPercent,
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
      min_pass_rate: minPassRate !== undefined ? clampPercent(minPassRate, 80) : clampPercent(existing.min_pass_rate, 80),
      max_failed: maxFailed !== undefined ? clampNonNegative(maxFailed, 0) : clampNonNegative(existing.max_failed, 0),
      max_not_run_percent: maxNotRunPercent !== undefined ? clampPercent(maxNotRunPercent, 20) : clampPercent(existing.max_not_run_percent, 20),
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
        min_pass_rate = @min_pass_rate,
        max_failed = @max_failed,
        max_not_run_percent = @max_not_run_percent,
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

    const executionSummary = buildExecutionSummary(existing.version_id);
    const readiness = evaluateExecutionReadiness(executionSummary, existing);
    if (!readiness.can_sign_off) {
      return res.status(409).json({ error: 'Test plan is not ready for sign-off', readiness });
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
