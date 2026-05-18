const router = require('express').Router();
const db = require('../config/db');
const { verifyAdmin } = require('../middleware/auth');

// GET /kategori
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM kategori ORDER BY nama ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// POST /kategori — admin only
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { nama, slug, deskripsi } = req.body;
    const [result] = await db.query('INSERT INTO kategori (nama, slug, deskripsi) VALUES (?, ?, ?)', [nama, slug, deskripsi]);
    res.status(201).json({ message: 'Kategori ditambahkan', id: result.insertId });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// PUT /kategori/:id — admin only
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { nama, slug, deskripsi } = req.body;
    await db.query('UPDATE kategori SET nama=?, slug=?, deskripsi=? WHERE id=?', [nama, slug, deskripsi, req.params.id]);
    res.json({ message: 'Kategori diupdate' });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// DELETE /kategori/:id — admin only
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM kategori WHERE id=?', [req.params.id]);
    res.json({ message: 'Kategori dihapus' });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

module.exports = router;
