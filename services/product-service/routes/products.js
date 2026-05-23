const router = require('express').Router();
const db = require('../config/db');
const firestore = require('../config/firestore');
const { verifyToken, verifyAdmin, verifyPenjual } = require('../middleware/auth');

// GET /products — list semua produk aktif (public)
router.get('/', async (req, res) => {
  try {
    const { kategori, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;
    const where = [`p.status = 'active'`];
    const params = [];

    if (kategori) { where.push('k.slug = ?'); params.push(kategori); }
    if (search) { where.push('p.nama LIKE ?'); params.push(`%${search}%`); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const listQuery = `SELECT p.*, k.nama as kategori_nama FROM produk p 
                       LEFT JOIN kategori k ON p.kategori_id = k.id 
                       ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;

    const [rows] = await db.query(listQuery, [...params, Number(limit), Number(offset)]);

    // Ambil foto dari Firestore
    const produkWithFotos = await Promise.all(rows.map(async (p) => {
      try {
        if (!firestore) {
          p.fotos = [];
          return p;
        }
        const doc = await firestore.collection('produk_media').doc(String(p.id)).get();
        p.fotos = doc.exists ? doc.data().fotos : [];
      } catch { p.fotos = []; }
      return p;
    }));

    const countQuery = `SELECT COUNT(*) as total FROM produk p 
                        LEFT JOIN kategori k ON p.kategori_id = k.id 
                        ${whereSql}`;
    const [[{ total }]] = await db.query(countQuery, params);
    res.json({ data: produkWithFotos, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// POST /products — any logged-in user can add a product
router.post('/', verifyPenjual, async (req, res) => {
  try {
    const { nama, deskripsi, harga, stok, kategori_id, bahan_asal, fotos = [] } = req.body;
    if (!nama || !harga) return res.status(400).json({ message: 'Nama dan harga wajib diisi' });
    if (Number(harga) <= 0) return res.status(400).json({ message: 'Harga harus lebih dari 0' });
    if (stok !== undefined && (!Number.isInteger(Number(stok)) || Number(stok) < 0)) {
      return res.status(400).json({ message: 'Stok harus angka 0 atau lebih' });
    }
    if (!Array.isArray(fotos)) return res.status(400).json({ message: 'Fotos harus berupa array URL' });
    if (fotos.length && !firestore) return res.status(503).json({ message: 'Penyimpanan foto belum dikonfigurasi' });

    const [result] = await db.query(
      'INSERT INTO produk (penjual_id, kategori_id, nama, deskripsi, harga, stok, bahan_asal) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, kategori_id, nama, deskripsi, harga, stok || 0, bahan_asal]
    );

    // Simpan foto ke Firestore
    if (fotos.length) {
      await firestore.collection('produk_media').doc(String(result.insertId)).set({
        produk_id: String(result.insertId),
        penjual_id: String(req.user.id),
        fotos,
        updated_at: new Date().toISOString()
      });
    }

    res.status(201).json({ message: 'Produk berhasil ditambahkan', produk_id: result.insertId });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// PUT /products/:id — update produk (penjual own atau admin)
router.put('/:id', verifyPenjual, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM produk WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    const produk = rows[0];
    if (req.user.role !== 'admin' && produk.penjual_id !== req.user.id) {
      return res.status(403).json({ message: 'Bukan produk kamu' });
    }

    const { nama, deskripsi, harga, stok, kategori_id, bahan_asal, fotos } = req.body;
    if (!nama || !harga) return res.status(400).json({ message: 'Nama dan harga wajib diisi' });
    if (Number(harga) <= 0) return res.status(400).json({ message: 'Harga harus lebih dari 0' });
    if (stok !== undefined && (!Number.isInteger(Number(stok)) || Number(stok) < 0)) {
      return res.status(400).json({ message: 'Stok harus angka 0 atau lebih' });
    }
    if (fotos !== undefined && !Array.isArray(fotos)) return res.status(400).json({ message: 'Fotos harus berupa array URL' });

    await db.query(
      'UPDATE produk SET nama=?, deskripsi=?, harga=?, stok=?, kategori_id=?, bahan_asal=? WHERE id=?',
      [nama, deskripsi, harga, stok, kategori_id, bahan_asal, req.params.id]
    );

    if (fotos) {
      if (!firestore) return res.status(503).json({ message: 'Penyimpanan foto belum dikonfigurasi' });
      await firestore.collection('produk_media').doc(req.params.id).set({
        produk_id: req.params.id,
        penjual_id: String(req.user.id),
        fotos,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    res.json({ message: 'Produk berhasil diupdate' });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// DELETE /products/:id
router.delete('/:id', verifyPenjual, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM produk WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    if (req.user.role !== 'admin' && rows[0].penjual_id !== req.user.id) {
      return res.status(403).json({ message: 'Bukan produk kamu' });
    }

    await db.query('DELETE FROM produk WHERE id = ?', [req.params.id]);
    if (firestore) await firestore.collection('produk_media').doc(req.params.id).delete().catch(() => {});

    res.json({ message: 'Produk berhasil dihapus' });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /products/penjual/me — produk milik penjual sendiri
router.get('/penjual/me', verifyPenjual, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, k.nama as kategori_nama FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       WHERE p.penjual_id = ? ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /products/:id — detail produk
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, k.nama as kategori_nama FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    const produk = rows[0];

    // Foto + review dari Firestore
    if (firestore) {
      const [mediaDoc, reviewsSnap] = await Promise.all([
        firestore.collection('produk_media').doc(String(produk.id)).get(),
        firestore.collection('reviews').where('produk_id', '==', String(produk.id)).limit(10).get()
      ]);

      produk.fotos = mediaDoc.exists ? mediaDoc.data().fotos : [];
      produk.reviews = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      produk.fotos = [];
      produk.reviews = [];
    }

    res.json(produk);
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

module.exports = router;
