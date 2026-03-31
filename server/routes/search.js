import express from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);

    const scope = getOwnerScope(req);
    const like = `%${q}%`;
    const results = [];

    // Bugs
    const bugs = scope.isAdmin
      ? db.prepare(`
          SELECT b.id, 'bug' AS type, b.title AS label, b.status AS meta,
                 p.name AS context
          FROM bugs b
          LEFT JOIN projects p ON p.id = b.project_id
          WHERE b.title LIKE ?
          ORDER BY b.id DESC
          LIMIT 10
        `).all(like)
      : db.prepare(`
          SELECT b.id, 'bug' AS type, b.title AS label, b.status AS meta,
                 p.name AS context
          FROM bugs b
          LEFT JOIN projects p ON p.id = b.project_id
          WHERE b.title LIKE ? AND b.owner_key = ?
          ORDER BY b.id DESC
          LIMIT 10
        `).all(like, scope.ownerKey);
    bugs.forEach((r) => results.push(r));

    // Test cases
    const tcs = scope.isAdmin
      ? db.prepare(`
          SELECT tc.id, 'testcase' AS type,
                 COALESCE(tc.description, '') AS label,
                 tc.result AS meta,
                 p.name AS context
          FROM test_cases tc
          LEFT JOIN builds bd ON bd.id = tc.build_id
          LEFT JOIN versions v ON v.id = bd.version_id
          LEFT JOIN projects p ON p.id = v.project_id
          WHERE tc.description LIKE ?
          ORDER BY tc.id DESC
          LIMIT 10
        `).all(like)
      : db.prepare(`
          SELECT tc.id, 'testcase' AS type,
                 COALESCE(tc.description, '') AS label,
                 tc.result AS meta,
                 p.name AS context
          FROM test_cases tc
          LEFT JOIN builds bd ON bd.id = tc.build_id
          LEFT JOIN versions v ON v.id = bd.version_id
          LEFT JOIN projects p ON p.id = v.project_id
          WHERE tc.description LIKE ? AND p.owner_key = ?
          ORDER BY tc.id DESC
          LIMIT 10
        `).all(like, scope.ownerKey);
    tcs.forEach((r) => results.push(r));

    // Builds
    const builds = scope.isAdmin
      ? db.prepare(`
          SELECT b.id, 'build' AS type, b.name AS label, NULL AS meta,
                 p.name AS context, b.version_id, v.project_id
          FROM builds b
          LEFT JOIN versions v ON v.id = b.version_id
          LEFT JOIN projects p ON p.id = v.project_id
          WHERE b.name LIKE ?
          ORDER BY b.id DESC
          LIMIT 5
        `).all(like)
      : db.prepare(`
          SELECT b.id, 'build' AS type, b.name AS label, NULL AS meta,
                 p.name AS context, b.version_id, v.project_id
          FROM builds b
          LEFT JOIN versions v ON v.id = b.version_id
          LEFT JOIN projects p ON p.id = v.project_id
          WHERE b.name LIKE ? AND p.owner_key = ?
          ORDER BY b.id DESC
          LIMIT 5
        `).all(like, scope.ownerKey);
    builds.forEach((r) => results.push({ ...r, versionId: r.version_id, projectId: r.project_id }));

    // Projects
    const projects = scope.isAdmin
      ? db.prepare(`
          SELECT id, 'project' AS type, name AS label, NULL AS meta, NULL AS context
          FROM projects
          WHERE name LIKE ?
          ORDER BY id DESC
          LIMIT 5
        `).all(like)
      : db.prepare(`
          SELECT id, 'project' AS type, name AS label, NULL AS meta, NULL AS context
          FROM projects
          WHERE name LIKE ? AND owner_key = ?
          ORDER BY id DESC
          LIMIT 5
        `).all(like, scope.ownerKey);
    projects.forEach((r) => results.push(r));

    // Test Plans
    const plans = scope.isAdmin
      ? db.prepare(`
          SELECT id, 'testplan' AS type, name AS label, status AS meta, NULL AS context
          FROM test_plans
          WHERE name LIKE ?
          ORDER BY id DESC
          LIMIT 5
        `).all(like)
      : db.prepare(`
          SELECT id, 'testplan' AS type, name AS label, status AS meta, NULL AS context
          FROM test_plans
          WHERE name LIKE ? AND owner_key = ?
          ORDER BY id DESC
          LIMIT 5
        `).all(like, scope.ownerKey);
    plans.forEach((r) => results.push(r));

    res.json(results.slice(0, 25));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

export default router;
