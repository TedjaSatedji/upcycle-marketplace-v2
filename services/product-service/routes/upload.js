const router = require('express').Router();
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const { verifyToken, verifyPenjual } = require('../middleware/auth');

// Use memory storage so we can stream to GCS directly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Hanya file gambar yang diizinkan'), false);
    }
    cb(null, true);
  }
});

// Initialize GCS
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
});

// Firebase Storage default bucket is projectid.firebasestorage.app OR projectid.appspot.com
// Check STORAGE_BUCKET env, fallback to firebasestorage.app format
const BUCKET_NAME = process.env.STORAGE_BUCKET || `${process.env.GCP_PROJECT_ID}.firebasestorage.app`;
const bucket = storage.bucket(BUCKET_NAME);

/**
 * POST /upload
 * Upload 1 or more photos to Google Cloud Storage
 * Returns array of public URLs
 * 
 * Form-data fields:
 *   - photos: File[] (up to 5 images)
 */
router.post('/', verifyPenjual, upload.array('photos', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Tidak ada file yang diupload' });
    }

    const makePublic = process.env.UPLOAD_PUBLIC !== 'false';

    const uploadPromises = req.files.map(file => {
      return new Promise((resolve, reject) => {
        const ext = file.originalname.split('.').pop();
        const fileName = `produk/${req.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const blob = bucket.file(fileName);

        const blobStream = blob.createWriteStream({
          resumable: false,
          metadata: {
            contentType: file.mimetype,
            cacheControl: 'public, max-age=31536000',
          },
          predefinedAcl: makePublic ? 'publicRead' : undefined
        });

        blobStream.on('error', reject);
        blobStream.on('finish', () => {
          const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;
          resolve(publicUrl);
        });

        blobStream.end(file.buffer);
      });
    });

    const urls = await Promise.all(uploadPromises);
    res.json({ 
      message: `${urls.length} foto berhasil diupload`, 
      urls 
    });

  } catch (e) {
    if (e.message && e.message.includes('gambar')) {
      return res.status(400).json({ message: e.message });
    }
    res.status(500).json({ message: 'Gagal upload foto', error: e.message });
  }
});

module.exports = router;
