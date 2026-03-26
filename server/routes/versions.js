import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET / - List versions for a project with build count
router.get('/', (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId query parameter is required' });
    }

    const versions = db.prepare(`
      SELECT v.*, COUNT(b.id) AS build_count
      FROM versions v
      LEFT JOIN builds b ON b.version_id = v.id
      WHERE v.project_id = ?
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `).all(projectId);

    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create version
router.post('/', (req, res) => {
  try {
    const { projectId, name } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Version name is required' });
    }

    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
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
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Version name is required' });
    }

    const result = db.prepare('UPDATE versions SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
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
    const result = db.prepare('DELETE FROM versions WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
