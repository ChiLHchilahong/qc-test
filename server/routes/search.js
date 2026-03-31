import express from 'express';
import db from '../db.js';
import { ownerFilter } from '../owner-scope.js';

const router = express.Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json([]);

  const { clause, params } = ownerFilter(req);
  // owner_key is not on all tables – use project-level scoping via owner_key on projects
  const like = `%${q}%`;

  const results = [];

  // Bugs
  const bugs = db.prepare(`
    SELECT b.id, 'bug' AS type, b.title AS label, b.status AS meta,
           p.name AS context
    FROM bugs b
    LEFT JOIN projects p ON p.id = b.project_id
    WHERE b.title LIKE ?
    LIMIT 10
  `).all(like);
  bugs.forEach((r) => results.push(r));

  // Test cases
  const tcs = db.prepare(`
    SELECT tc.id, 'testcase' AS type,
           COALESCE(tc.description, tc.test_no) AS label,
           tc.result AS meta,
           p.name AS context
    FROM test_cases tc
    LEFT JOIN builds bd ON bd.id = tc.build_id
    LEFT JOIN versions v ON v.id = bd.version_id
    LEFT JOIN projects p ON p.id = v.project_id
    WHERE tc.description LIKE ? OR tc.test_no LIKE ?
    LIMIT 10
  `).all(like, like);
  tcs.forEach((r) => results.push(r));

  // Builds
  const builds = db.prepare(`
    SELECT b.id, 'build' AS type, b.name AS label, b.status AS meta,
           p.name AS context, b.version_id, v.project_id
    FROM builds b
    LEFT JOIN versions v ON v.id = b.version_id
    LEFT JOIN projects p ON p.id = v.project_id
    WHERE b.name LIKE ?
    LIMIT 5
  `).all(like);
  builds.forEach((r) => results.push({ ...r, versionId: r.version_id, projectId: r.project_id }));

  // Projects
  const projects = db.prepare(`
    SELECT id, 'project' AS type, name AS label, status AS meta, NULL AS context
    FROM projects
    WHERE name LIKE ?
    LIMIT 5
  `).all(like);
  projects.forEach((r) => results.push(r));

  // Test Plans
  const plans = db.prepare(`
    SELECT id, 'testplan' AS type, name AS label, status AS meta, NULL AS context
    FROM test_plans
    WHERE name LIKE ?
    LIMIT 5
  `).all(like);
  plans.forEach((r) => results.push(r));

  res.json(results.slice(0, 25));
});

export default router;
