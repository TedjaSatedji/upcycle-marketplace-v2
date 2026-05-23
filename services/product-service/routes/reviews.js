const router = require('express').Router();
const db = require('../config/db');
const firestore = require('../config/firestore');
const { verifyToken } = require('../middleware/auth');

// GET /reviews/:produk_id - list review produk
router.get('/:produk_id', async (req, res) => {
  try {
    if (!firestore) return res.json([]);

    const snap = await firestore.collection('reviews')
      .where('produk_id', '==', String(req.params.produk_id))
      .orderBy('created_at', 'desc')
      .limit(20)
      .get();

    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// POST /reviews/:produk_id - pembeli kasih review
router.post('/:produk_id', verifyToken, async (req, res) => {
  try {
    const { rating, komentar } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating harus 1-5' });
    if (!firestore) return res.status(503).json({ message: 'Review belum dikonfigurasi' });

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

module.exports = router;
