const admin = require('firebase-admin');

let db;

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
        projectId: process.env.GCP_PROJECT_ID,
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GCP_PROJECT_ID,
      });
    }
  }

  db = admin.apps.length ? admin.firestore() : null;
} catch (e) {
  console.warn(`Firestore disabled: ${e.message}`);
  db = null;
}

module.exports = db;
