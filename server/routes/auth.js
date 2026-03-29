import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/has-accounts', (_req, res) => {
  try {
    const row = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    res.json({ hasAnyAccount: Number(row?.count || 0) > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username) return res.status(400).json({ error: 'Vui lòng nhập tài khoản' });
    if (password.length < 4) return res.status(400).json({ error: 'Mật khẩu phải từ 4 ký tự' });

    const existed = db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(username);
    if (existed) return res.status(409).json({ error: 'Tài khoản đã tồn tại' });

    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, password);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tài khoản và mật khẩu' });
    }

    const user = db
      .prepare('SELECT id, username FROM users WHERE lower(username) = lower(?) AND password = ?')
      .get(username, password);

    if (!user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });

    res.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
