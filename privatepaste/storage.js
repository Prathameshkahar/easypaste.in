(function () {
  const firebaseConfig = {
    apiKey: 'REPLACE_WITH_API_KEY',
    authDomain: 'REPLACE_WITH_AUTH_DOMAIN',
    projectId: 'REPLACE_WITH_PROJECT_ID',
    storageBucket: 'REPLACE_WITH_STORAGE_BUCKET',
    messagingSenderId: 'REPLACE_WITH_MESSAGING_SENDER_ID',
    appId: 'REPLACE_WITH_APP_ID',
  };

  const hasRealConfig = Object.values(firebaseConfig).every((value) => !value.startsWith('REPLACE_WITH_'));

  let db = null;
  if (hasRealConfig) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  }

  function ensureDb() {
    if (!db) {
      throw new Error('Firebase config missing. Update storage.js with your Firestore credentials.');
    }
  }

  async function savePaste(id, payload) {
    ensureDb();
    await db.collection('pastes').doc(id).set(payload);
  }

  async function getPaste(id) {
    ensureDb();
    const doc = await db.collection('pastes').doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async function deletePaste(id) {
    ensureDb();
    await db.collection('pastes').doc(id).delete();
  }

  window.PrivatePasteStorage = {
    savePaste,
    getPaste,
    deletePaste,
  };
})();
