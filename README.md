# ♻ Upcycle Marketplace — TCC Project

Platform marketplace produk upcycling berbasis microservice, di-deploy ke **Google Cloud Run**.

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

## Endpoint API (Total: 24 endpoint ✅)

### Auth Service (`/auth`)
| # | Method | Endpoint | Deskripsi |
|---|--------|----------|-----------|
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
| 9 | GET | /products | List produk aktif |
| 10 | GET | /products/:id | Detail produk |
| 11 | POST | /products | Tambah produk |
| 12 | PUT | /products/:id | Update produk |
| 13 | DELETE | /products/:id | Hapus produk |
| 14 | GET | /products/penjual/me | Produk milik penjual |
| 15 | GET | /kategori | List kategori |
| 16 | POST | /kategori | Tambah kategori (admin) |
| 17 | PUT | /kategori/:id | Update kategori (admin) |
| 18 | DELETE | /kategori/:id | Hapus kategori (admin) |
| 19 | POST | /transaksi | Buat transaksi |
| 20 | GET | /transaksi/me | Riwayat transaksi |
| 21 | GET | /transaksi/:id | Detail transaksi |
| 22 | PUT | /transaksi/:id/status | Update status (admin) |
| 23 | GET | /transaksi | Semua transaksi (admin) |
| 24 | GET | /verifikasi | List produk pending (admin) |
| 25 | POST | /verifikasi/:id | Approve/reject produk (admin) |
| 26 | POST | /verifikasi/review/:id | Tambah review (pembeli) |
| 27 | GET | /verifikasi/notifikasi/me | Notifikasi user |

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
