# Upcycle Marketplace - Mobile API Documentation

Dokumentasi ini ditujukan untuk Mobile Developer (Flutter/React Native/Android/iOS) untuk mengintegrasikan aplikasi mobile dengan backend Upcycle Marketplace.

## Base URLs
Aplikasi backend dipisah menjadi dua microservice. Gunakan Base URL berikut sesuai dengan endpoint yang akan dipanggil:

- **Auth API**: `https://auth-service-420166052416.asia-southeast2.run.app`
- **Product API**: `https://product-service-420166052416.asia-southeast2.run.app`

## Authentication
Sebagian besar endpoint mewajibkan user untuk login. Sistem menggunakan JWT (JSON Web Token).
Tambahkan header berikut pada endpoint yang membutuhkan autentikasi:
`Authorization: Bearer <access_token_disini>`

---

## 1. Auth Service (Akun & Profil)
Gunakan Base URL **Auth API**.

### 1.1. Registrasi
- **Endpoint**: `POST /auth/register`
- **Auth Required**: No
- **Body (JSON)**:
  ```json
  {
    "name": "Budi Santoso",
    "email": "budi@gmail.com",
    "password": "password123"
  }
  ```

### 1.2. Login
- **Endpoint**: `POST /auth/login`
- **Auth Required**: No
- **Body (JSON)**:
  ```json
  {
    "email": "budi@gmail.com",
    "password": "password123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Login berhasil",
    "token": "eyJhbG...",
    "refresh_token": "eyJhbG...",
    "role": "pembeli"
  }
  ```
  *(Catatan: Simpan `token` dan `refresh_token` di Secure Storage / SharedPreferences HP).*

### 1.3. Get User Profile
- **Endpoint**: `GET /auth/profile`
- **Auth Required**: Yes (`Bearer Token`)
- **Response**: Mengembalikan data user, termasuk data toko (`penjual_profile`) jika role adalah `penjual`.

### 1.4. Update Profile / Buka Toko
- **Endpoint**: `PUT /auth/profile`
- **Auth Required**: Yes (`Bearer Token`)
- **Body (JSON)**:
  ```json
  {
    "name": "Budi Santoso Baru",
    "nama_toko": "Toko Budi Upcycle",
    "deskripsi": "Menjual barang daur ulang terbaik",
    "alamat": "Jl. Kemerdekaan No 1",
    "telepon": "081234567890"
  }
  ```

### 1.5. Refresh Token
- **Endpoint**: `POST /auth/refresh`
- **Auth Required**: No
- **Body (JSON)**:
  ```json
  {
    "refresh_token": "<refresh_token_lama>"
  }
  ```
- **Fungsi**: Gunakan ini saat `access_token` expired agar user tidak perlu login ulang.

---

## 2. Product Service (Katalog & Transaksi)
Gunakan Base URL **Product API**.

### 2.1. Get Semua Produk (Katalog)
- **Endpoint**: `GET /products`
- **Auth Required**: No
- **Query Params**: 
  - `page` (default: 1)
  - `limit` (default: 12)
  - `search` (opsional, pencarian nama barang)
  - `kategori` (opsional, slug kategori)
- **Response**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "nama": "Tas Daur Ulang",
        "harga": 50000,
        "stok": 10,
        "status": "active",
        "kategori_nama": "Fashion",
        "fotos": ["url_foto_1", "url_foto_2"]
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 12
  }
  ```

### 2.2. Get Detail Produk
- **Endpoint**: `GET /products/:id`
- **Auth Required**: No
- **Response**: Mengembalikan data produk secara lengkap, termasuk array `fotos` dan `reviews`.

### 2.3. Tambah Produk Baru (Untuk Penjual)
- **Endpoint**: `POST /products`
- **Auth Required**: Yes (`Bearer Token`)
- **Body (JSON)**:
  ```json
  {
    "nama": "Lampu Hias Botol",
    "deskripsi": "Lampu hias dari botol bekas",
    "harga": 75000,
    "stok": 5,
    "kategori_id": 2,
    "bahan_asal": "Botol Kaca",
    "fotos": ["url_foto_firebase_1", "url_foto_firebase_2"]
  }
  ```
  *(Catatan: Upload foto ke Firebase Storage dari aplikasi mobile terlebih dahulu, lalu kirimkan URL gambarnya ke API ini di dalam array `fotos`).*

### 2.4. Get Produk Milik Sendiri (Toko Saya)
- **Endpoint**: `GET /products/penjual/me`
- **Auth Required**: Yes (`Bearer Token`)
- **Response**: Mengembalikan list produk khusus milik penjual yang sedang login.

### 2.5. Hapus Produk
- **Endpoint**: `DELETE /products/:id`
- **Auth Required**: Yes (`Bearer Token`)
- **Catatan**: Hanya penjual pemilik barang (atau Admin) yang bisa menghapus.
