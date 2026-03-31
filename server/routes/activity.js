import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET / - List recent activity, optional ?entity_type=&limit=
router.get('/', (req, res) => {
  try {
    const { entity_type, limit } = req.query;
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));

    let sql = 'SELECT * FROM activity_log WHERE 1=1';
    const params = [];
    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limitNum);

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
