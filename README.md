# ♻ Upcycle Marketplace — TCC Project

Platform marketplace produk upcycling berbasis microservice, di-deploy ke **Google Cloud Run**.

## Dokumen & Tools

- API lengkap untuk mobile: API_DOCUMENTATION.md
- Postman collection: upcycle-marketplace.postman_collection.json
- Ringkasan endpoint: upcycle-marketplace-endpoints.txt

## Arsitektur

```
┌─────────────────────────────────────────────┐
│              Client Layer                    │
│   Web Admin (admin.html) │ Katalog Pembeli   │
└──────────────┬──────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────┐
│        Cloud Run Services                    │
│  frontend-service  :80                       │
│  auth-service      :3001                     │
│  product-service   :3002                     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│          Database Layer                      │
│  Cloud SQL (MySQL) │ Firestore (NoSQL)        │
└─────────────────────────────────────────────┘
```

## Services

| Service | Port | Deskripsi |
|---------|------|-----------|
| frontend | 80 | Nginx serve Vanilla JS |
| auth-service | 3001 | Auth, user management |
| product-service | 3002 | Produk, transaksi, verifikasi |

## Endpoint API

### Auth Service (`/auth`)
Catatan: semua endpoint auth juga tersedia tanpa prefix `/auth` karena service ini me-mount route di `/` dan `/auth`.

| # | Method | Endpoint | Deskripsi |
|---|--------|----------|-----------|
| 0 | GET | /health | Health check |
| 1 | POST | /auth/register | Registrasi user baru |
| 2 | POST | /auth/login | Login |
| 3 | GET | /auth/profile | Get profil sendiri |
| 4 | PUT | /auth/profile | Update profil |
| 5 | POST | /auth/refresh | Refresh token |
| 6 | POST | /auth/logout | Logout |
| 7 | GET | /auth/users | List semua user (admin) |
| 8 | PUT | /auth/users/:id/status | Toggle aktif user (admin) |

### Product Service
| # | Method | Endpoint | Deskripsi |
|---|--------|----------|-----------|
| 1 | GET | /health | Health check |
| 2 | GET | /products | List produk aktif |
| 3 | GET | /products/:id | Detail produk |
| 4 | POST | /products | Tambah produk |
| 5 | PUT | /products/:id | Update produk |
| 6 | DELETE | /products/:id | Hapus produk |
| 7 | GET | /products/penjual/me | Produk milik penjual |
| 8 | GET | /kategori | List kategori |
| 9 | POST | /kategori | Tambah kategori (admin) |
| 10 | PUT | /kategori/:id | Update kategori (admin) |
| 11 | DELETE | /kategori/:id | Hapus kategori (admin) |
| 12 | POST | /transaksi | Buat transaksi |
| 13 | GET | /transaksi/me | Riwayat transaksi pembeli |
| 14 | GET | /transaksi/seller | Riwayat transaksi penjual |
| 15 | GET | /transaksi/:id | Detail transaksi |
| 16 | PUT | /transaksi/:id/status | Update status (admin) |
| 17 | GET | /transaksi | Semua transaksi (admin) |
| 18 | GET | /verifikasi | List produk pending (admin) |
| 19 | POST | /verifikasi/:produk_id | Approve/reject produk (admin) |
| 20 | POST | /verifikasi/review/:produk_id | Tambah review (pembeli) |
| 21 | GET | /verifikasi/notifikasi/me | Notifikasi user |
| 22 | GET | /reviews/:produk_id | List review produk |
| 23 | POST | /reviews/:produk_id | Tambah review (pembeli) |
| 24 | POST | /upload | Upload foto produk |

Alias endpoint:
- `/categories` sama dengan `/kategori`
- `/orders` sama dengan `/transaksi`

## Database

### SQL — Cloud SQL (MySQL)
**upcycle_auth:**
- `users` — data akun user semua role
- `penjual_profiles` — profil toko penjual
- `refresh_tokens` — token refresh JWT
- `password_resets` — token reset password
- `login_logs` — log aktivitas login

**upcycle_products:**
- `kategori` — kategori produk
- `produk` — data produk upcycling
- `transaksi` — order/pembelian
- `transaksi_item` — item per order
- `verifikasi_produk` — log verifikasi admin

### NoSQL — Firestore
- `produk_media` — URL foto produk
- `reviews` — ulasan pembeli (fleksibel)
- `notifikasi` — notifikasi realtime
- (chat pembeli-penjual bisa ditambah via koleksi `chat_rooms`)

## Cara Jalankan (Local Dev)

### Prasyarat

- Docker & Docker Compose
- MySQL lokal atau MySQL di host (untuk docker-compose)
- Node.js (opsional, jika ingin run service tanpa Docker)

Catatan:
- File setup-mysql.sh khusus untuk VM GCE (Cloud Run) dan tidak diperlukan untuk local dev.
- docker-compose mengasumsikan MySQL berjalan di host dengan user `upcycle_user` dan password `upcycle_pass`.

### Konfigurasi Environment

Auth Service (services/auth-service/.env):

```
PORT=3001
DB_HOST=127.0.0.1
DB_USER=upcycle_user
DB_PASS=upcycle_pass
DB_NAME=upcycle_auth
JWT_SECRET=your_super_secret_key_ganti_ini
```

Product Service (services/product-service/.env):

```
PORT=3002
DB_HOST=127.0.0.1
DB_USER=upcycle_user
DB_PASS=upcycle_pass
DB_NAME=upcycle_products
JWT_SECRET=your_super_secret_key_ganti_ini
GCP_PROJECT_ID=your-gcp-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
STORAGE_BUCKET=your-project.firebasestorage.app
UPLOAD_PUBLIC=true
```

Notes:
- `FIREBASE_SERVICE_ACCOUNT` berisi JSON service account (string). Jika kosong, backend memakai Application Default Credentials.
- `STORAGE_BUCKET` opsional. Default: `${GCP_PROJECT_ID}.firebasestorage.app`.
- `UPLOAD_PUBLIC` default `true`. Set ke `false` untuk private upload.

### Konfigurasi Frontend

Ubah base URL API di services/frontend/public/config.js jika ingin local dev:

```
const CONFIG = {
  AUTH_URL: 'http://localhost:3001/auth',
  PRODUCT_URL: 'http://localhost:3002',
};
```

```bash
# Clone dan masuk direktori
cd upcycle-marketplace

# Copy env files
cp services/auth-service/.env.example services/auth-service/.env
cp services/product-service/.env.example services/product-service/.env

# Jalankan semua service
docker-compose up --build
```

Akses:
- Frontend: http://localhost:8080
- Auth API: http://localhost:3001
- Product API: http://localhost:3002

### Menjalankan tanpa Docker (opsional)

```
# Auth service
cd services/auth-service
npm install
npm run dev

# Product service
cd ../product-service
npm install
npm run dev

# Frontend (static)
cd ../frontend
docker build -t upcycle-frontend .
docker run --rm -p 8080:80 upcycle-frontend
```

## Deploy ke Cloud Run (GCP)

```bash
# 1. Build dan push image ke Container Registry
gcloud auth configure-docker

# Auth service
cd services/auth-service
docker build -t gcr.io/PROJECT_ID/auth-service .
docker push gcr.io/PROJECT_ID/auth-service

# Product service
cd ../product-service
docker build -t gcr.io/PROJECT_ID/product-service .
docker push gcr.io/PROJECT_ID/product-service

# Frontend
cd ../frontend
docker build -t gcr.io/PROJECT_ID/frontend-service .
docker push gcr.io/PROJECT_ID/frontend-service

# 2. Deploy ke Cloud Run
gcloud run deploy auth-service \
  --image gcr.io/PROJECT_ID/auth-service \
  --platform managed --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars DB_HOST=...,JWT_SECRET=...

gcloud run deploy product-service \
  --image gcr.io/PROJECT_ID/product-service \
  --platform managed --region asia-southeast2 \
  --allow-unauthenticated \
  --set-env-vars DB_HOST=...,JWT_SECRET=...

gcloud run deploy frontend-service \
  --image gcr.io/PROJECT_ID/frontend-service \
  --platform managed --region asia-southeast2 \
  --allow-unauthenticated
```

## Stack
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JS + Nginx
- **SQL DB**: MySQL via Cloud SQL
- **NoSQL DB**: Firestore
- **Container**: Docker
- **Cloud**: GCP Cloud Run
