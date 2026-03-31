import { Router } from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';

const router = Router();

// GET / - List all projects with version count
router.get('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const projects = scope.isAdmin
      ? db.prepare(`
          SELECT p.*, COUNT(v.id) AS version_count
          FROM projects p
          LEFT JOIN versions v ON v.project_id = p.id
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `).all()
      : db.prepare(`
          SELECT p.*, COUNT(v.id) AS version_count
          FROM projects p
          LEFT JOIN versions v ON v.project_id = p.id
          WHERE p.owner_key = ?
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `).all(scope.ownerKey);

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create project
router.post('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = db.prepare('INSERT INTO projects (name, owner_key) VALUES (?, ?)').run(name.trim(), scope.ownerKey);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - Rename project
router.put('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = scope.isAdmin
      ? db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name.trim(), req.params.id)
      : db.prepare('UPDATE projects SET name = ? WHERE id = ? AND owner_key = ?').run(name.trim(), req.params.id, scope.ownerKey);
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
    const scope = getOwnerScope(req);
    const result = scope.isAdmin
      ? db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
      : db.prepare('DELETE FROM projects WHERE id = ? AND owner_key = ?').run(req.params.id, scope.ownerKey);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
