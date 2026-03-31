import { Router } from 'express';
import db from '../db.js';
import { getOwnerScope } from '../owner-scope.js';

const router = Router();

function getOwnedBuild(scope, buildId) {
  return scope.isAdmin
    ? db.prepare('SELECT id FROM builds WHERE id = ?').get(buildId)
    : db.prepare(`
        SELECT b.id
        FROM builds b
        JOIN versions v ON v.id = b.version_id
        JOIN projects p ON p.id = v.project_id
        WHERE b.id = ? AND p.owner_key = ?
      `).get(buildId, scope.ownerKey);
}

// GET / - List all test cases for a build ordered by sort_order
router.get('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { buildId } = req.query;
    if (!buildId) {
      return res.status(400).json({ error: 'buildId query parameter is required' });
    }

    const build = getOwnedBuild(scope, buildId);
    if (!build) {
      return res.status(404).json({ error: 'Build not found' });
    }

    const testCases = db.prepare(
      'SELECT * FROM test_cases WHERE build_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(buildId);

    res.json(testCases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /bulk - Bulk update multiple test cases (must be before /:id)
router.put('/bulk', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object is required' });
    }

    const allowedFields = ['feature', 'description', 'test_to_perform', 'test_status', 'result', 'issue', 'note', 'sort_order', 'category'];
    const fieldMap = {
      testToPerform: 'test_to_perform',
      testStatus: 'test_status',
    };

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key] || key;
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    if (!scope.isAdmin) {
      const placeholdersOwned = ids.map(() => '?').join(',');
      const ownedCount = db.prepare(`
        SELECT COUNT(*) AS c
        FROM test_cases tc
        JOIN builds b ON b.id = tc.build_id
        JOIN versions v ON v.id = b.version_id
        JOIN projects p ON p.id = v.project_id
        WHERE tc.id IN (${placeholdersOwned}) AND p.owner_key = ?
      `).get(...ids, scope.ownerKey);

      if (Number(ownedCount?.c || 0) !== ids.length) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const placeholders = ids.map(() => '?').join(',');
    const sql = `UPDATE test_cases SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`;

    const bulkUpdate = db.transaction(() => {
      const result = db.prepare(sql).run([...values, ...ids]);
      return result.changes;
    });

    const changes = bulkUpdate();
    res.json({ success: true, updated: changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - Create test case
router.post('/', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { buildId, feature, description, testToPerform, testStatus, result, issue, note, category } = req.body;
    if (!buildId) {
      return res.status(400).json({ error: 'buildId is required' });
    }

    const build = getOwnedBuild(scope, buildId);
    if (!build) {
      return res.status(404).json({ error: 'Build not found' });
    }

    // Get next sort_order for this build
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM test_cases WHERE build_id = ?'
    ).get(buildId);

    const result2 = db.prepare(`
      INSERT INTO test_cases (build_id, feature, description, test_to_perform, test_status, result, issue, note, sort_order, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      buildId,
      feature || null,
      description || null,
      testToPerform || null,
      testStatus || 'To Do',
      result || 'Not Run',
      issue || null,
      note || null,
      maxOrder.max_order + 1,
      category || 'General'
    );

    const testCase = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(result2.lastInsertRowid);
    res.status(201).json(testCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - Update test case (partial update)
router.put('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const allowedFields = ['feature', 'description', 'test_to_perform', 'test_status', 'result', 'issue', 'note', 'sort_order', 'category'];
    const fieldMap = {
      testToPerform: 'test_to_perform',
      testStatus: 'test_status',
    };

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(req.body)) {
      const dbField = fieldMap[key] || key;
      if (allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const result = scope.isAdmin
      ? db.prepare(`UPDATE test_cases SET ${setClauses.join(', ')} WHERE id = ?`).run(...values, req.params.id)
      : db.prepare(`
          UPDATE test_cases
          SET ${setClauses.join(', ')}
          WHERE id = ?
            AND build_id IN (
              SELECT b.id
              FROM builds b
              JOIN versions v ON v.id = b.version_id
              JOIN projects p ON p.id = v.project_id
              WHERE p.owner_key = ?
            )
        `).run(...values, req.params.id, scope.ownerKey);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    const testCase = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    res.json(testCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - Delete test case
router.delete('/:id', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const result = scope.isAdmin
      ? db.prepare('DELETE FROM test_cases WHERE id = ?').run(req.params.id)
      : db.prepare(`
          DELETE FROM test_cases
          WHERE id = ?
            AND build_id IN (
              SELECT b.id
              FROM builds b
              JOIN versions v ON v.id = b.version_id
              JOIN projects p ON p.id = v.project_id
              WHERE p.owner_key = ?
            )
        `).run(req.params.id, scope.ownerKey);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import - Bulk import test cases
router.post('/import', (req, res) => {
  try {
    const scope = getOwnerScope(req);
    const { buildId, testCases } = req.body;
    if (!buildId) {
      return res.status(400).json({ error: 'buildId is required' });
    }
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({ error: 'testCases array is required and must not be empty' });
    }

    const build = getOwnedBuild(scope, buildId);
    if (!build) {
      return res.status(404).json({ error: 'Build not found' });
    }

    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM test_cases WHERE build_id = ?'
    ).get(buildId);

    const importAll = db.transaction(() => {
      const insert = db.prepare(`
        INSERT INTO test_cases (build_id, feature, description, test_to_perform, test_status, result, issue, note, sort_order, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let order = maxOrder.max_order + 1;
      const imported = [];

      for (const tc of testCases) {
        const result = insert.run(
          buildId,
          tc.feature || null,
          tc.description || null,
          tc.testToPerform || tc.test_to_perform || null,
          tc.testStatus || tc.test_status || 'To Do',
          tc.result || 'Not Run',
          tc.issue || null,
          tc.note || null,
          order++,
          tc.category || 'General'
        );
        imported.push(result.lastInsertRowid);
      }

      return imported;
    });

    const importedIds = importAll();
    res.status(201).json({ success: true, imported: importedIds.length, ids: importedIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
