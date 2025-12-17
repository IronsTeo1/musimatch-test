// public/js/firebase-config.js

// Import dei moduli Firebase dal CDN (versione modulare moderna)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { getStorage, connectStorageEmulator } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js';

// ⚠️ CONFIGURAZIONE DEL PROGETTO TEST (musimatch-test)
// Sostituisci con la tua config reale dalla console Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBRkVLAApIsOHB51JR8fNSgi7EFbcsLpZk",
  authDomain: "musimatch-test.firebaseapp.com",
  projectId: "musimatch-test",
  storageBucket: "musimatch-test.firebasestorage.app",
  messagingSenderId: "129041979034",
  appId: "1:129041979034:web:9e837c86eb054e0e82f123"
};

// Inizializza l'app Firebase
const app = initializeApp(firebaseConfig);

// Servizi
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Rileva se siamo in locale
const isLocalhost =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1';

if (isLocalhost) {
  const FS_PORT = 8084; // allineato a firebase.json
  console.log(`[MusiMatch] Connessione agli EMULATORI (Auth 9099, Firestore ${FS_PORT}, Storage 9199)...`);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', FS_PORT);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
} else {
  console.log('[MusiMatch] Connessione al progetto remoto:', firebaseConfig.projectId);
}

export { app, auth, db, storage };
