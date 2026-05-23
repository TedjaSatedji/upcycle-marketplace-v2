# Upcycle Marketplace - Mobile API Documentation

Dokumentasi ini untuk integrasi mobile app dengan backend Upcycle Marketplace.

## Base URLs

- Auth API: `https://auth-service-420166052416.asia-southeast2.run.app`
- Product API: `https://product-service-420166052416.asia-southeast2.run.app`

## Headers

Endpoint JSON:

```http
Content-Type: application/json
```

Endpoint yang butuh login:

```http
Authorization: Bearer <access_token>
```

Token dari login berlaku sekitar 1 jam. Simpan `token` dan `refresh_token` di secure storage mobile.

## Common Errors

```json
{ "message": "Token tidak ditemukan" }
```

```json
{ "message": "Token tidak valid" }
```

```json
{ "message": "Akses ditolak" }
```

```json
{ "message": "Server error", "error": "..." }
```

---

## 1. Auth Service

Gunakan Base URL Auth API.

### 1.1 Register

`POST /auth/register`

Auth required: No

Body:

```json
{
  "name": "Budi Santoso",
  "email": "budi@gmail.com",
  "password": "password123"
}
```

Success `201`:

```json
{
  "message": "Registrasi berhasil",
  "user_id": 1
}
```

Default role user baru adalah `pembeli`.

### 1.2 Login

`POST /auth/login`

Auth required: No

Body:

```json
{
  "email": "budi@gmail.com",
  "password": "password123"
}
```

Success `200`:

```json
{
  "message": "Login berhasil",
  "token": "eyJ...",
  "refresh_token": "eyJ...",
  "role": "pembeli"
}
```

### 1.3 Get Profile

`GET /auth/profile`

Auth required: Yes

Success `200`:

```json
{
  "id": 1,
  "name": "Budi Santoso",
  "email": "budi@gmail.com",
  "role": "penjual",
  "is_active": 1,
  "created_at": "2026-05-23T00:00:00.000Z",
  "penjual_profile": {
    "id": 1,
    "user_id": 1,
    "nama_toko": "Toko Budi Upcycle",
    "deskripsi": "Menjual barang daur ulang terbaik",
    "alamat": "Jl. Kemerdekaan No 1",
    "telepon": "081234567890",
    "status_verifikasi": "pending"
  }
}
```

`penjual_profile` hanya muncul jika role user adalah `penjual`.

### 1.4 Update Profile

`PUT /auth/profile`

Auth required: Yes

Update nama biasa:

```json
{
  "name": "Budi Santoso Baru"
}
```

Buka atau update toko:

```json
{
  "name": "Budi Santoso",
  "nama_toko": "Toko Budi Upcycle",
  "deskripsi": "Menjual barang daur ulang terbaik",
  "alamat": "Jl. Kemerdekaan No 1",
  "telepon": "081234567890"
}
```

Jika user masih `pembeli` dan mengirim `nama_toko`, backend akan mengubah role menjadi `penjual` dan mengembalikan token baru.

Success `200`:

```json
{
  "message": "Profil toko berhasil diupdate",
  "role": "penjual",
  "token": "eyJ..."
}
```

Mobile harus mengganti token lama dengan token baru jika field `token` ada di response.

### 1.5 Refresh Token

`POST /auth/refresh`

Auth required: No

Body:

```json
{
  "refresh_token": "<refresh_token>"
}
```

Success `200`:

```json
{
  "token": "eyJ..."
}
```

### 1.6 Logout

`POST /auth/logout`

Auth required: Yes

Body:

```json
{
  "refresh_token": "<refresh_token>"
}
```

Success `200`:

```json
{
  "message": "Logout berhasil"
}
```

---

## 2. Product Service

Gunakan Base URL Product API.

### 2.1 Get Categories

`GET /kategori`

Auth required: No

Success `200`:

```json
[
  {
    "id": 1,
    "nama": "Fesyen",
    "slug": "fesyen",
    "deskripsi": "Pakaian dan aksesori hasil daur ulang"
  }
]
```

### 2.2 Get Product Catalog

`GET /products`

Auth required: No

Query params:

- `page`, default `1`
- `limit`, default `12`
- `search`, optional
- `kategori`, optional category slug

Example:

```http
GET /products?page=1&limit=12&kategori=fesyen&search=tas
```

Success `200`:

```json
{
  "data": [
    {
      "id": 1,
      "nama": "Tas Daur Ulang",
      "harga": "50000.00",
      "stok": 10,
      "status": "active",
      "kategori_nama": "Fesyen",
      "fotos": ["https://storage.googleapis.com/..."]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 12
}
```

Catalog hanya menampilkan produk dengan status `active`.

### 2.3 Get Product Detail

`GET /products/:id`

Auth required: No

Success `200`:

```json
{
  "id": 1,
  "nama": "Tas Daur Ulang",
  "deskripsi": "Tas dari kain bekas",
  "harga": "50000.00",
  "stok": 10,
  "status": "active",
  "kategori_nama": "Fesyen",
  "fotos": ["https://storage.googleapis.com/..."],
  "reviews": []
}
```

### 2.4 Upload Product Photos

`POST /upload`

Auth required: Yes, role `penjual` or `admin`

Content type: `multipart/form-data`

Form-data:

- key: `photos`
- type: File
- max: 5 image files
- max size: 10 MB per file

Success `200`:

```json
{
  "message": "2 foto berhasil diupload",
  "urls": [
    "https://storage.googleapis.com/..."
  ]
}
```

Mobile does not need Firebase service account credentials. The backend owns Firebase/GCS credentials and returns public image URLs.

### 2.5 Create Product

`POST /products`

Auth required: Yes, role `penjual` or `admin`

Body:

```json
{
  "nama": "Lampu Hias Botol",
  "deskripsi": "Lampu hias dari botol bekas",
  "harga": 75000,
  "stok": 5,
  "kategori_id": 2,
  "bahan_asal": "Botol Kaca",
  "fotos": ["https://storage.googleapis.com/..."]
}
```

Success `201`:

```json
{
  "message": "Produk berhasil ditambahkan",
  "produk_id": 10
}
```

Produk baru masuk dengan status `pending`. Admin harus approve dulu sebelum muncul di catalog.

### 2.6 Get My Products

`GET /products/penjual/me`

Auth required: Yes, role `penjual` or `admin`

Success `200`:

```json
[
  {
    "id": 10,
    "nama": "Lampu Hias Botol",
    "status": "pending",
    "kategori_nama": "Dekorasi"
  }
]
```

### 2.7 Update Product

`PUT /products/:id`

Auth required: Yes, owner seller or admin

Body:

```json
{
  "nama": "Lampu Hias Botol Baru",
  "deskripsi": "Lampu hias dari botol bekas",
  "harga": 80000,
  "stok": 4,
  "kategori_id": 2,
  "bahan_asal": "Botol Kaca",
  "fotos": ["https://storage.googleapis.com/..."]
}
```

### 2.8 Delete Product

`DELETE /products/:id`

Auth required: Yes, owner seller or admin

Success `200`:

```json
{
  "message": "Produk berhasil dihapus"
}
```

---

## 3. Transactions

### 3.1 Create Transaction

`POST /transaksi`

Auth required: Yes

Body:

```json
{
  "items": [
    {
      "produk_id": 1,
      "qty": 2
    }
  ],
  "alamat_pengiriman": "Jl. Kemerdekaan No 1",
  "metode_pembayaran": "transfer_bank"
}
```

Success `201`:

```json
{
  "message": "Transaksi berhasil",
  "transaksi_id": 20,
  "total": 100000
}
```

`qty` wajib angka bulat positif. Produk duplikat dalam satu transaksi tidak diizinkan.

### 3.2 Get My Transactions

`GET /transaksi/me`

Auth required: Yes

Query params:

- `page`, default `1`
- `limit`, default `10`

Success `200`:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 10
}
```

### 3.3 Get Transaction Detail

`GET /transaksi/:id`

Auth required: Yes

User can only access their own transaction unless admin.

---

## 4. Reviews And Notifications

### 4.1 Create Product Review

`POST /verifikasi/review/:produk_id`

Auth required: Yes

Body:

```json
{
  "rating": 5,
  "komentar": "Produknya bagus"
}
```

Only users who bought the product can review it.

### 4.2 Get My Notifications

`GET /verifikasi/notifikasi/me`

Auth required: Yes

Success `200`:

```json
[]
```

---

## 5. Admin Only

These endpoints require role `admin`:

- `GET /auth/users`
- `PUT /auth/users/:id/status`
- `POST /kategori`
- `PUT /kategori/:id`
- `DELETE /kategori/:id`
- `GET /verifikasi`
- `POST /verifikasi/:produk_id`
- `GET /transaksi`
- `PUT /transaksi/:id/status`
