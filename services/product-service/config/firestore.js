const admin = require('firebase-admin');

let db;

try {
  if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GCP_PROJECT_ID,
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
        projectId: process.env.GCP_PROJECT_ID,
      });
    } else {
      console.warn('Firestore disabled: FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS is required');
    }
  }

  db = admin.apps.length ? admin.firestore() : null;
} catch (e) {
  console.warn(`Firestore disabled: ${e.message}`);
  db = null;
}

module.exports = db;
