import { Router } from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';

const router = Router();

// GET / - List versions for a project with build count
router.get('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId query parameter is required' });
    }

    const versions = scope.isAdmin
      ? db.prepare(`
          SELECT v.*, COUNT(b.id) AS build_count
          FROM versions v
          LEFT JOIN builds b ON b.version_id = v.id
          WHERE v.project_id = ?
          GROUP BY v.id
          ORDER BY v.created_at DESC
        `).all(projectId)
      : db.prepare(`
          SELECT v.*, COUNT(b.id) AS build_count
          FROM versions v
          JOIN projects p ON p.id = v.project_id
          LEFT JOIN builds b ON b.version_id = v.id
          WHERE v.project_id = ? AND p.owner_key = ?
          GROUP BY v.id
          ORDER BY v.created_at DESC
        `).all(projectId, scope.ownerKey);

    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create version
router.post('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { projectId, name } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Version name is required' });
    }

    const project = scope.isAdmin
      ? db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
      : db.prepare('SELECT id FROM projects WHERE id = ? AND owner_key = ?').get(projectId, scope.ownerKey);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = db.prepare('INSERT INTO versions (project_id, name) VALUES (?, ?)').run(projectId, name.trim());
    const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(version);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - Rename version
router.put('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Version name is required' });
    }

    const result = scope.isAdmin
      ? db.prepare('UPDATE versions SET name = ? WHERE id = ?').run(name.trim(), req.params.id)
      : db.prepare(`
          UPDATE versions
          SET name = ?
          WHERE id = ?
            AND project_id IN (SELECT id FROM projects WHERE owner_key = ?)
        `).run(name.trim(), req.params.id, scope.ownerKey);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(req.params.id);
    res.json(version);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - Delete version (cascade)
router.delete('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const result = scope.isAdmin
      ? db.prepare('DELETE FROM versions WHERE id = ?').run(req.params.id)
      : db.prepare(`
          DELETE FROM versions
          WHERE id = ?
            AND project_id IN (SELECT id FROM projects WHERE owner_key = ?)
        `).run(req.params.id, scope.ownerKey);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
