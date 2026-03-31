import { Router } from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';

const router = Router();

// GET / - List builds for a version with computed stats
router.get('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { versionId } = req.query;
    if (!versionId) {
      return res.status(400).json({ error: 'versionId query parameter is required' });
    }

    const builds = scope.isAdmin
      ? db.prepare(`
          SELECT
            b.*,
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
            END) AS not_run,
            SUM(CASE WHEN tc.test_status = 'Yes' THEN 1 ELSE 0 END) AS yes_count,
            SUM(CASE WHEN tc.test_status = 'To Do' THEN 1 ELSE 0 END) AS todo_count
          FROM builds b
          LEFT JOIN test_cases tc ON tc.build_id = b.id
          WHERE b.version_id = ?
          GROUP BY b.id
          ORDER BY b.created_at DESC
        `).all(versionId)
      : db.prepare(`
          SELECT
            b.*,
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
            END) AS not_run,
            SUM(CASE WHEN tc.test_status = 'Yes' THEN 1 ELSE 0 END) AS yes_count,
            SUM(CASE WHEN tc.test_status = 'To Do' THEN 1 ELSE 0 END) AS todo_count
          FROM builds b
          JOIN versions v ON v.id = b.version_id
          JOIN projects p ON p.id = v.project_id
          LEFT JOIN test_cases tc ON tc.build_id = b.id
          WHERE b.version_id = ? AND p.owner_key = ?
          GROUP BY b.id
          ORDER BY b.created_at DESC
        `).all(versionId, scope.ownerKey);

    res.json(builds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create build
router.post('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { versionId, name } = req.body;
    if (!versionId) {
      return res.status(400).json({ error: 'versionId is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Build name is required' });
    }

    const version = scope.isAdmin
      ? db.prepare('SELECT id FROM versions WHERE id = ?').get(versionId)
      : db.prepare(`
          SELECT v.id
          FROM versions v
          JOIN projects p ON p.id = v.project_id
          WHERE v.id = ? AND p.owner_key = ?
        `).get(versionId, scope.ownerKey);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const result = db.prepare('INSERT INTO builds (version_id, name) VALUES (?, ?)').run(versionId, name.trim());
    const build = db.prepare('SELECT * FROM builds WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(build);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/copy - Copy build with all test cases
router.post('/:id/copy', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const sourceBuild = scope.isAdmin
      ? db.prepare('SELECT * FROM builds WHERE id = ?').get(req.params.id)
      : db.prepare(`
          SELECT b.*
          FROM builds b
          JOIN versions v ON v.id = b.version_id
          JOIN projects p ON p.id = v.project_id
          WHERE b.id = ? AND p.owner_key = ?
        `).get(req.params.id, scope.ownerKey);
    if (!sourceBuild) {
      return res.status(404).json({ error: 'Source build not found' });
    }

    const copyName = req.body.name || `${sourceBuild.name} (Copy)`;

    const copyBuild = db.transaction(() => {
      const result = db.prepare('INSERT INTO builds (version_id, name) VALUES (?, ?)').run(
        sourceBuild.version_id,
        copyName
      );
      const newBuildId = result.lastInsertRowid;

      const testCases = db.prepare('SELECT * FROM test_cases WHERE build_id = ? ORDER BY sort_order').all(req.params.id);

      const insertTC = db.prepare(`
        INSERT INTO test_cases (build_id, feature, description, test_to_perform, test_status, result, issue, note, sort_order)
        VALUES (?, ?, ?, ?, ?, 'Not Run', ?, ?, ?)
      `);

      for (const tc of testCases) {
        insertTC.run(newBuildId, tc.feature, tc.description, tc.test_to_perform, tc.test_status, tc.issue, tc.note, tc.sort_order);
      }

      return db.prepare('SELECT * FROM builds WHERE id = ?').get(newBuildId);
    });

    const newBuild = copyBuild();
    res.status(201).json(newBuild);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - Rename build
router.put('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Build name is required' });
    }

    const result = scope.isAdmin
      ? db.prepare('UPDATE builds SET name = ? WHERE id = ?').run(name.trim(), req.params.id)
      : db.prepare(`
          UPDATE builds
          SET name = ?
          WHERE id = ?
            AND version_id IN (
              SELECT v.id
              FROM versions v
              JOIN projects p ON p.id = v.project_id
              WHERE p.owner_key = ?
            )
        `).run(name.trim(), req.params.id, scope.ownerKey);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }

    const build = db.prepare('SELECT * FROM builds WHERE id = ?').get(req.params.id);
    res.json(build);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - Delete build (cascade)
router.delete('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const result = scope.isAdmin
      ? db.prepare('DELETE FROM builds WHERE id = ?').run(req.params.id)
      : db.prepare(`
          DELETE FROM builds
          WHERE id = ?
            AND version_id IN (
              SELECT v.id
              FROM versions v
              JOIN projects p ON p.id = v.project_id
              WHERE p.owner_key = ?
            )
        `).run(req.params.id, scope.ownerKey);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
