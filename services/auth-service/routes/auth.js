const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRES = '1h';

const signAccessToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES }
);

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Semua field wajib diisi' });

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email sudah terdaftar' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, 'pembeli']
    );

    res.status(201).json({ message: 'Registrasi berhasil', user_id: result.insertId });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Email atau password salah' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await db.query('INSERT INTO login_logs (user_id, status) VALUES (?, ?)', [user.id, 'failed']);
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const token = signAccessToken(user);
    const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, refreshToken, expiresAt]);
    await db.query('INSERT INTO login_logs (user_id, status) VALUES (?, ?)', [user.id, 'success']);

    res.json({ message: 'Login berhasil', token, refresh_token: refreshToken, role: user.role });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /auth/profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User tidak ditemukan' });

    let profile = rows[0];
    if (profile.role === 'penjual') {
      const [pRows] = await db.query('SELECT * FROM penjual_profiles WHERE user_id = ?', [req.user.id]);
      profile.penjual_profile = pRows[0] || null;
    }
    res.json(profile);
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// PUT /auth/profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, nama_toko, deskripsi, alamat, telepon } = req.body;
    if (!name) return res.status(400).json({ message: 'Nama wajib diisi' });

    await db.query('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);

    let token;
    let role = req.user.role;

    if (nama_toko) {
      const [profiles] = await db.query('SELECT id FROM penjual_profiles WHERE user_id = ?', [req.user.id]);
      if (profiles.length) {
        await db.query(
          'UPDATE penjual_profiles SET nama_toko = ?, deskripsi = ?, alamat = ?, telepon = ? WHERE user_id = ?',
          [nama_toko, deskripsi, alamat, telepon, req.user.id]
        );
      } else {
        await db.query(
          'INSERT INTO penjual_profiles (user_id, nama_toko, deskripsi, alamat, telepon) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, nama_toko, deskripsi, alamat, telepon]
        );
      }

      if (req.user.role === 'pembeli') {
        await db.query('UPDATE users SET role = ? WHERE id = ?', ['penjual', req.user.id]);
        role = 'penjual';
        token = signAccessToken({ id: req.user.id, email: req.user.email, role });
      }
    }

    res.json({
      message: nama_toko ? 'Profil toko berhasil diupdate' : 'Profil berhasil diupdate',
      role,
      ...(token ? { token } : {})
    });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const [rows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [refresh_token]
    );
    if (!rows.length) return res.status(403).json({ message: 'Refresh token tidak valid' });

    const decoded = jwt.verify(refresh_token, JWT_SECRET);
    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    const user = userRows[0];

    const newToken = signAccessToken(user);
    res.json({ token: newToken });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// POST /auth/logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);
    }
    res.json({ message: 'Logout berhasil' });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /auth/users — admin only
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// PUT /auth/users/:id/status — admin toggle active
router.put('/users/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active, req.params.id]);
    res.json({ message: 'Status user diupdate' });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

module.exports = router;
