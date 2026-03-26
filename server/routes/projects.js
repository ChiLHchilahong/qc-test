import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET / - List all projects with version count
router.get('/', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT p.*, COUNT(v.id) AS version_count
      FROM projects p
      LEFT JOIN versions v ON v.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create project
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = db.prepare('INSERT INTO projects (name) VALUES (?)').run(name.trim());
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - Rename project
router.put('/:id', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - Delete project (cascade)
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
