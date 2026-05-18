#!/bin/bash
# setup-mysql.sh (Revisi untuk Cloud Run)
# Jalankan script ini di GCE VM setelah SSH masuk

set -e

echo "=== Installing MySQL ==="
apt-get update -y
apt-get install -y mysql-server git

echo "=== Configuring MySQL for External Access (Cloud Run) ==="
# Mengizinkan MySQL menerima koneksi dari luar (bukan cuma localhost)
sed -i "s/bind-address.*/bind-address = 0.0.0.0/" /etc/mysql/mysql.conf.d/mysqld.cnf

echo "=== Starting MySQL ==="
systemctl restart mysql
systemctl enable mysql

echo "=== Creating databases & user ==="
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS upcycle_auth;
CREATE DATABASE IF NOT EXISTS upcycle_products;

-- Menggunakan '%' agar Cloud Run bisa mengakses database ini
CREATE USER IF NOT EXISTS 'upcycle_user'@'%' IDENTIFIED BY 'upcycle_pass';
GRANT ALL PRIVILEGES ON upcycle_auth.* TO 'upcycle_user'@'%';
GRANT ALL PRIVILEGES ON upcycle_products.* TO 'upcycle_user'@'%';
FLUSH PRIVILEGES;
EOF

echo "=== Importing schemas ==="
# Pastikan kamu sudah copy/clone project ini ke VM sebelum menjalankan script ini.
# Asumsinya script ini dijalankan di dalam folder project 'upcycle-marketplace-v2'
if [ -f "./services/auth-service/config/schema.sql" ]; then
    mysql -u root upcycle_auth < ./services/auth-service/config/schema.sql
    mysql -u root upcycle_products < ./services/product-service/config/schema.sql
    echo "✅ Schema berhasil di-import!"
else
    echo "⚠️ Peringatan: File schema.sql tidak ditemukan di direktori saat ini."
    echo "Silakan import schema secara manual nanti."
fi

echo ""
echo "✅ Done! MySQL berjalan di GCE dan siap menerima koneksi dari Cloud Run."
echo "   Catat IP External VM GCE ini. Gunakan IP tersebut sebagai DB_HOST"
echo "   saat mendeploy service ke Cloud Run."
