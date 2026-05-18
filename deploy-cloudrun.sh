#!/bin/bash
# deploy-cloudrun.sh
# Deploy ke Cloud Run, DB tetap di GCE VM
# Usage: ./deploy-cloudrun.sh your-project-id your-vm-internal-ip

PROJECT_ID=${1:-"your-project-id"}
DB_HOST=${2:-"10.0.0.2"}         # internal IP GCE VM lo
REGION="asia-southeast2"
JWT_SECRET="ganti_ini_production_secret"
DB_USER="upcycle_user"
DB_PASS="upcycle_pass"

echo "=== Building & pushing images ==="

gcloud auth configure-docker --quiet

# Auth service
docker build -t gcr.io/$PROJECT_ID/auth-service ./services/auth-service
docker push gcr.io/$PROJECT_ID/auth-service

# Product service
docker build -t gcr.io/$PROJECT_ID/product-service ./services/product-service
docker push gcr.io/$PROJECT_ID/product-service

# Frontend
docker build -t gcr.io/$PROJECT_ID/frontend-service ./services/frontend
docker push gcr.io/$PROJECT_ID/frontend-service

echo "=== Deploying to Cloud Run ==="

gcloud run deploy auth-service \
  --image gcr.io/$PROJECT_ID/auth-service \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "DB_HOST=$DB_HOST,DB_USER=$DB_USER,DB_PASS=$DB_PASS,DB_NAME=upcycle_auth,JWT_SECRET=$JWT_SECRET" \
  --vpc-connector your-vpc-connector   # biar bisa akses GCE internal IP

gcloud run deploy product-service \
  --image gcr.io/$PROJECT_ID/product-service \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "DB_HOST=$DB_HOST,DB_USER=$DB_USER,DB_PASS=$DB_PASS,DB_NAME=upcycle_products,JWT_SECRET=$JWT_SECRET,GCP_PROJECT_ID=$PROJECT_ID" \
  --vpc-connector your-vpc-connector

gcloud run deploy frontend-service \
  --image gcr.io/$PROJECT_ID/frontend-service \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo ""
echo "✅ Deploy selesai!"
echo "   Jangan lupa update nginx.conf frontend dengan URL Cloud Run yang baru."
