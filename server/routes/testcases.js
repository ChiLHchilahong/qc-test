import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET / - List all test cases for a build ordered by sort_order
router.get('/', (req, res) => {
  try {
    const { buildId } = req.query;
    if (!buildId) {
      return res.status(400).json({ error: 'buildId query parameter is required' });
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
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object is required' });
    }

    const allowedFields = ['feature', 'description', 'test_to_perform', 'test_status', 'result', 'issue', 'note', 'sort_order'];
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
    const { buildId, feature, description, testToPerform, testStatus, result, issue, note } = req.body;
    if (!buildId) {
      return res.status(400).json({ error: 'buildId is required' });
    }

    const build = db.prepare('SELECT id FROM builds WHERE id = ?').get(buildId);
    if (!build) {
      return res.status(404).json({ error: 'Build not found' });
    }

    // Get next sort_order for this build
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM test_cases WHERE build_id = ?'
    ).get(buildId);

    const result2 = db.prepare(`
      INSERT INTO test_cases (build_id, feature, description, test_to_perform, test_status, result, issue, note, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      buildId,
      feature || null,
      description || null,
      testToPerform || null,
      testStatus || 'To Do',
      result || 'Not Run',
      issue || null,
      note || null,
      maxOrder.max_order + 1
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
    const allowedFields = ['feature', 'description', 'test_to_perform', 'test_status', 'result', 'issue', 'note', 'sort_order'];
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

    values.push(req.params.id);
    const result = db.prepare(`UPDATE test_cases SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

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
    const result = db.prepare('DELETE FROM test_cases WHERE id = ?').run(req.params.id);
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
    const { buildId, testCases } = req.body;
    if (!buildId) {
      return res.status(400).json({ error: 'buildId is required' });
    }
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({ error: 'testCases array is required and must not be empty' });
    }

    const build = db.prepare('SELECT id FROM builds WHERE id = ?').get(buildId);
    if (!build) {
      return res.status(404).json({ error: 'Build not found' });
    }

    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM test_cases WHERE build_id = ?'
    ).get(buildId);

    const importAll = db.transaction(() => {
      const insert = db.prepare(`
        INSERT INTO test_cases (build_id, feature, description, test_to_perform, test_status, result, issue, note, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          order++
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
