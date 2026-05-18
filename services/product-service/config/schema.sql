CREATE DATABASE IF NOT EXISTS upcycle_products;
USE upcycle_products;

CREATE TABLE IF NOT EXISTS kategori (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  deskripsi TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produk (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penjual_id INT NOT NULL,
  kategori_id INT,
  nama VARCHAR(200) NOT NULL,
  deskripsi TEXT,
  harga DECIMAL(12,2) NOT NULL,
  stok INT DEFAULT 0,
  bahan_asal VARCHAR(100),
  status ENUM('draft', 'pending', 'active', 'rejected', 'sold_out') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transaksi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pembeli_id INT NOT NULL,
  total_harga DECIMAL(12,2) NOT NULL,
  status ENUM('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  alamat_pengiriman TEXT,
  metode_pembayaran VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaksi_item (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaksi_id INT NOT NULL,
  produk_id INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  harga_satuan DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (transaksi_id) REFERENCES transaksi(id) ON DELETE CASCADE,
  FOREIGN KEY (produk_id) REFERENCES produk(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verifikasi_produk (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produk_id INT NOT NULL,
  admin_id INT NOT NULL,
  status ENUM('approved', 'rejected') NOT NULL,
  catatan TEXT,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produk_id) REFERENCES produk(id) ON DELETE CASCADE
);

-- Seed kategori
INSERT INTO kategori (nama, slug, deskripsi) VALUES
('Fesyen', 'fesyen', 'Pakaian dan aksesori hasil daur ulang'),
('Furnitur', 'furnitur', 'Perabot rumah tangga upcycled'),
('Aksesori', 'aksesori', 'Perhiasan dan aksesori dari bahan bekas'),
('Dekorasi', 'dekorasi', 'Dekorasi rumah hasil kreasi ulang'),
('Elektronik', 'elektronik', 'Barang elektronik yang direfurbish');
