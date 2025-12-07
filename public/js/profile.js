// public/js/profile.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const emailEl = document.getElementById('user-email');
const idEl = document.getElementById('user-id');
const form = document.getElementById('profile-form');
const msgEl = document.getElementById('profile-message');
const btnSave = document.getElementById('btn-save-profile');
const btnLogout = document.getElementById('btn-logout');

const displayNameEl = document.getElementById('profile-displayName');
const mainInstrEl = document.getElementById('profile-mainInstrument');
const bioEl = document.getElementById('profile-bio');
const photoUrlEl = document.getElementById('profile-photoUrl');

function setMessage(text, isError = false) {
  if (!msgEl) return;
  msgEl.textContent = text || '';
  msgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function setLoading(state) {
  if (btnSave) btnSave.disabled = state;
}

async function loadMusicianDoc(uid) {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('userType', '==', 'musician'), where('authUid', '==', uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

async function saveProfile(uid) {
  if (!form) return;
  const displayName = displayNameEl?.value.trim() || null;
  const mainInstrument = mainInstrEl?.value.trim() || null;
  const bio = bioEl?.value.trim() || null;
  const photoUrl = photoUrlEl?.value.trim() || null;

  setLoading(true);
  setMessage('Salvataggio in corso...');

  try {
    let existing = await loadMusicianDoc(uid);
    const payload = {
      userType: 'musician',
      authUid: uid,
      displayName,
      mainInstrument,
      bio,
      photoUrl,
      updatedAt: serverTimestamp()
    };

    if (existing) {
      await updateDoc(doc(db, 'users', existing.id), payload);
      setMessage('Profilo aggiornato.');
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, 'users'), payload);
      setMessage('Profilo creato.');
    }
  } catch (err) {
    console.error('[MusiMatch] Errore salvataggio profilo:', err);
    setMessage(err.message || 'Errore nel salvataggio.', true);
  } finally {
    setLoading(false);
  }
}

function populateForm(data) {
  if (!data) return;
  if (displayNameEl) displayNameEl.value = data.displayName || '';
  if (mainInstrEl) mainInstrEl.value = data.mainInstrument || '';
  if (bioEl) bioEl.value = data.bio || '';
  if (photoUrlEl) photoUrlEl.value = data.photoUrl || '';
}

function guard(user) {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  if (emailEl) emailEl.textContent = user.email || '';
  if (idEl) idEl.textContent = `UID: ${user.uid}`;
  loadMusicianDoc(user.uid).then((docData) => populateForm(docData?.data));
}

onAuthStateChanged(auth, guard);

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    saveProfile(auth.currentUser.uid);
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'home.html';
  });
}
