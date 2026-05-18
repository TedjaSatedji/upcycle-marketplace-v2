const router = require('express').Router();
const db = require('../config/db');
const firestore = require('../config/firestore');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// GET /verifikasi — list produk pending (admin)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, k.nama as kategori_nama FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       WHERE p.status = 'pending' ORDER BY p.created_at ASC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// POST /verifikasi/:produk_id — admin approve / reject
router.post('/:produk_id', verifyAdmin, async (req, res) => {
  try {
    const { status, catatan } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Status tidak valid' });

    const newStatus = status === 'approved' ? 'active' : 'rejected';
    await db.query('UPDATE produk SET status = ? WHERE id = ?', [newStatus, req.params.produk_id]);
    await db.query(
      'INSERT INTO verifikasi_produk (produk_id, admin_id, status, catatan) VALUES (?, ?, ?, ?)',
      [req.params.produk_id, req.user.id, status, catatan]
    );

    // Notif ke penjual via Firestore
    const [rows] = await db.query('SELECT penjual_id FROM produk WHERE id = ?', [req.params.produk_id]);
    if (rows.length) {
      await firestore.collection('notifikasi').add({
        user_id: String(rows[0].penjual_id),
        type: 'product_verification',
        message: `Produk #${req.params.produk_id} ${status === 'approved' ? 'disetujui' : 'ditolak'}`,
        produk_id: req.params.produk_id,
        catatan: catatan || '',
        read: false,
        created_at: new Date().toISOString()
      });
    }

    res.json({ message: `Produk berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}` });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// POST /verifikasi/review/:produk_id — pembeli kasih review
router.post('/review/:produk_id', verifyToken, async (req, res) => {
  try {
    const { rating, komentar } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating harus 1-5' });

    const [purchases] = await db.query(
      `SELECT t.id FROM transaksi t 
       JOIN transaksi_item ti ON t.id = ti.transaksi_id 
       WHERE t.pembeli_id = ? AND ti.produk_id = ? AND t.status != 'cancelled' 
       LIMIT 1`,
      [req.user.id, req.params.produk_id]
    );
    if (!purchases.length) {
      return res.status(403).json({ message: 'Hanya pembeli produk yang bisa memberi review' });
    }

    const existingSnap = await firestore.collection('reviews')
      .where('produk_id', '==', String(req.params.produk_id))
      .where('pembeli_id', '==', String(req.user.id))
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      return res.status(409).json({ message: 'Review sudah pernah dibuat' });
    }

    await firestore.collection('reviews').add({
      produk_id: req.params.produk_id,
      pembeli_id: String(req.user.id),
      rating: Number(rating),
      komentar: komentar || '',
      created_at: new Date().toISOString()
    });

    res.status(201).json({ message: 'Review berhasil ditambahkan' });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /verifikasi/notifikasi/me — notif user sendiri
router.get('/notifikasi/me', verifyToken, async (req, res) => {
  try {
    const snap = await firestore.collection('notifikasi')
      .where('user_id', '==', String(req.user.id))
      .orderBy('created_at', 'desc')
      .limit(20)
      .get();
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(notifs);
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

module.exports = router;
