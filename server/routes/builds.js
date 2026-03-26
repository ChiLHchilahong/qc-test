import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET / - List builds for a version with computed stats
router.get('/', (req, res) => {
  try {
    const { versionId } = req.query;
    if (!versionId) {
      return res.status(400).json({ error: 'versionId query parameter is required' });
    }

    const builds = db.prepare(`
      SELECT
        b.*,
        COUNT(tc.id) AS total,
        SUM(CASE WHEN tc.result = 'Passed' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN tc.result = 'Failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN tc.result = 'Not Run' THEN 1 ELSE 0 END) AS not_run,
        SUM(CASE WHEN tc.test_status = 'Yes' THEN 1 ELSE 0 END) AS yes_count,
        SUM(CASE WHEN tc.test_status = 'To Do' THEN 1 ELSE 0 END) AS todo_count
      FROM builds b
      LEFT JOIN test_cases tc ON tc.build_id = b.id
      WHERE b.version_id = ?
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all(versionId);

    res.json(builds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create build
router.post('/', (req, res) => {
  try {
    const { versionId, name } = req.body;
    if (!versionId) {
      return res.status(400).json({ error: 'versionId is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Build name is required' });
    }

    const version = db.prepare('SELECT id FROM versions WHERE id = ?').get(versionId);
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
    const sourceBuild = db.prepare('SELECT * FROM builds WHERE id = ?').get(req.params.id);
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
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Build name is required' });
    }

    const result = db.prepare('UPDATE builds SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
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
    const result = db.prepare('DELETE FROM builds WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
