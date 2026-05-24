const router = require('express').Router();
const db = require('../config/db');
const firestore = require('../config/firestore');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// POST /transaksi — pembeli buat order
router.post('/', verifyToken, async (req, res) => {
  try {
    const { items, alamat_pengiriman, metode_pembayaran } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Items tidak boleh kosong' });

    for (const item of items) {
      if (!item.produk_id || !Number.isInteger(Number(item.qty)) || Number(item.qty) <= 0) {
        return res.status(400).json({ message: 'Setiap item wajib punya produk_id dan qty positif' });
      }
    }

    const productIds = items.map(item => Number(item.produk_id));
    if (new Set(productIds).size !== productIds.length) {
      return res.status(400).json({ message: 'Produk duplikat dalam satu transaksi tidak diizinkan' });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();
    let trxId;
    let total = 0;
    try {
      // Validasi stok di dalam transaksi supaya stok tidak race saat checkout bersamaan.
      const itemsDetail = [];
      for (const item of items) {
        const qty = Number(item.qty);
        const [rows] = await conn.query('SELECT * FROM produk WHERE id = ? AND status = "active" FOR UPDATE', [item.produk_id]);
        if (!rows.length) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ message: `Produk ${item.produk_id} tidak tersedia` });
        }
        if (rows[0].stok < qty) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ message: `Stok ${rows[0].nama} tidak cukup` });
        }
        const subtotal = Number(rows[0].harga) * qty;
        total += subtotal;
        itemsDetail.push({ ...rows[0], qty, subtotal });
      }

      const [trx] = await conn.query(
        'INSERT INTO transaksi (pembeli_id, total_harga, alamat_pengiriman, metode_pembayaran, status) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, total, alamat_pengiriman, metode_pembayaran, 'paid']
      );

      for (const item of itemsDetail) {
        await conn.query(
          'INSERT INTO transaksi_item (transaksi_id, produk_id, qty, harga_satuan, subtotal) VALUES (?, ?, ?, ?, ?)',
          [trx.insertId, item.id, item.qty, item.harga, item.subtotal]
        );
        await conn.query('UPDATE produk SET stok = stok - ? WHERE id = ?', [item.qty, item.id]);
      }

      await conn.commit();
      trxId = trx.insertId;
      conn.release();
    } catch (e) {
      await conn.rollback();
      conn.release();
      throw e;
    }

    // Notifikasi tidak boleh membatalkan transaksi yang sudah berhasil commit.
    if (firestore) await firestore.collection('notifikasi').add({
      user_id: String(req.user.id),
      type: 'order_created',
      message: `Pesanan #${trxId} berhasil dibuat`,
      transaksi_id: String(trxId),
      read: false,
      created_at: new Date().toISOString()
    }).catch(() => {});

    res.status(201).json({ message: 'Transaksi berhasil', transaksi_id: trxId, total });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /transaksi/me — riwayat transaksi pembeli
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const [rows] = await db.query(
      `SELECT t.*, 
        JSON_ARRAYAGG(JSON_OBJECT('produk_id', ti.produk_id, 'qty', ti.qty, 'subtotal', ti.subtotal, 'nama', p.nama, 'harga', p.harga)) as items
       FROM transaksi t
       LEFT JOIN transaksi_item ti ON t.id = ti.transaksi_id
       LEFT JOIN produk p ON ti.produk_id = p.id
       WHERE t.pembeli_id = ? GROUP BY t.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM transaksi WHERE pembeli_id = ?',
      [req.user.id]
    );
    res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /transaksi/seller — riwayat pesanan untuk penjual
router.get('/seller', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const [rows] = await db.query(
      `SELECT t.*, 
        JSON_ARRAYAGG(JSON_OBJECT('produk_id', ti.produk_id, 'qty', ti.qty, 'subtotal', ti.subtotal, 'nama', p.nama, 'harga', p.harga)) as items
       FROM transaksi t
       JOIN transaksi_item ti ON t.id = ti.transaksi_id
       JOIN produk p ON ti.produk_id = p.id
       WHERE p.penjual_id = ?
       GROUP BY t.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT t.id) as total FROM transaksi t
       JOIN transaksi_item ti ON t.id = ti.transaksi_id
       JOIN produk p ON ti.produk_id = p.id
       WHERE p.penjual_id = ?`,
      [req.user.id]
    );
    res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /transaksi/:id — detail transaksi
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM transaksi WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

    if (req.user.role !== 'admin' && rows[0].pembeli_id !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const [items] = await db.query(
      `SELECT ti.*, p.nama, p.harga FROM transaksi_item ti 
       JOIN produk p ON ti.produk_id = p.id WHERE ti.transaksi_id = ?`,
      [req.params.id]
    );

    res.json({ ...rows[0], items });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// PUT /transaksi/:id/status — update status (admin)
router.put('/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatus = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatus.includes(status)) return res.status(400).json({ message: 'Status tidak valid' });

    await db.query('UPDATE transaksi SET status = ? WHERE id = ?', [status, req.params.id]);

    const [rows] = await db.query('SELECT pembeli_id FROM transaksi WHERE id = ?', [req.params.id]);
    if (rows.length && firestore) {
      await firestore.collection('notifikasi').add({
        user_id: String(rows[0].pembeli_id),
        type: 'order_status_update',
        message: `Pesanan #${req.params.id} status berubah menjadi ${status}`,
        transaksi_id: req.params.id,
        read: false,
        created_at: new Date().toISOString()
      }).catch(() => {});
    }

    res.json({ message: 'Status transaksi diupdate' });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// GET /transaksi — semua transaksi (admin)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const [rows] = await db.query(
      `SELECT t.*, 
        JSON_ARRAYAGG(JSON_OBJECT('produk_id', ti.produk_id, 'qty', ti.qty, 'subtotal', ti.subtotal, 'nama', p.nama, 'harga', p.harga)) as items
       FROM transaksi t
       LEFT JOIN transaksi_item ti ON t.id = ti.transaksi_id
       LEFT JOIN produk p ON ti.produk_id = p.id
       GROUP BY t.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM transaksi');
    res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

module.exports = router;
