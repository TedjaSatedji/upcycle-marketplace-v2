const admin = require('firebase-admin');

let db;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? admin.credential.applicationDefault()
      : admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')),
    projectId: process.env.GCP_PROJECT_ID,
  });
}

db = admin.firestore();

module.exports = db;
