import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';

const router = Router();
const SALT_ROUNDS = 10;

router.get('/has-accounts', (_req, res) => {
  try {
    const row = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    res.json({ hasAnyAccount: Number(row?.count || 0) > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username) return res.status(400).json({ error: 'Vui lòng nhập tài khoản' });
    if (password.length < 4) return res.status(400).json({ error: 'Mật khẩu phải từ 4 ký tự' });

    const existed = db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(username);
    if (existed) return res.status(409).json({ error: 'Tài khoản đã tồn tại' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashed);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tài khoản và mật khẩu' });
    }

    const user = db
      .prepare('SELECT id, username, password FROM users WHERE lower(username) = lower(?)')
      .get(username);

    if (!user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });

    // Transparent migration: if stored password is not a bcrypt hash, compare plain text
    // then re-hash and save for future logins
    const isBcrypt = String(user.password || '').startsWith('$2');
    let valid = false;
    if (isBcrypt) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      valid = user.password === password;
      if (valid) {
        // Upgrade to bcrypt hash
        const hashed = await bcrypt.hash(password, SALT_ROUNDS);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
      }
    }

    if (!valid) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });

    res.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
