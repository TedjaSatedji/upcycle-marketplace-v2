require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'product-service' }));
app.use('/products', require('./routes/products'));
app.use('/kategori', require('./routes/kategori'));
app.use('/transaksi', require('./routes/transaksi'));
app.use('/verifikasi', require('./routes/verifikasi'));
app.use('/upload', require('./routes/upload'));

app.listen(PORT, () => console.log(`Product service running on port ${PORT}`));
