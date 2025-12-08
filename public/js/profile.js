// public/js/profile.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
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

const displayNameEl = document.getElementById('profile-displayName');
const mainInstrEl = document.getElementById('profile-mainInstrument');
const bioEl = document.getElementById('profile-bio');
const photoUrlEl = document.getElementById('profile-photoUrl');
const ratesListEl = document.getElementById('rates-list');

const avatarContainer = document.getElementById('profile-avatar');
const avatarMenuToggle = document.getElementById('avatar-menu-toggle');
const avatarMenu = document.getElementById('avatar-menu');
const avatarChangeBtn = document.getElementById('avatar-change');
const avatarViewBtn = document.getElementById('avatar-view');
const avatarFileInput = document.getElementById('avatar-file');
const avatarModal = document.getElementById('avatar-modal');
const avatarModalImg = document.getElementById('avatar-modal-img');
const avatarModalClose = document.getElementById('avatar-modal-close');


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

async function saveProfile(uid, options = {}) {
  if (!form) return;
  const displayName = displayNameEl?.value.trim() || null;
  const mainInstrument = mainInstrEl?.value.trim() || null;
  const bio = bioEl?.value.trim() || null;
  const photoUrl = options.overridePhotoUrl ?? photoUrlEl?.value.trim() ?? null;

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
  renderRates(data.rates || {});
}

function renderRates(rates) {
  if (!ratesListEl) return;
  ratesListEl.innerHTML = '';
  const labels = {
    rehearsal: 'Prova',
    concert_or_mass: 'Concerto / messa',
    service_civil_religious: 'Servizio civile/religioso',
    service_civil_trumpet_full: 'Servizio civile (squilli+silenzio)',
    solo_performance: 'Esibizione da solista'
  };
  const entries = Object.keys(rates || {}).map((key) => ({
    label: labels[key] || key,
    value: rates[key]
  }));
  if (entries.length === 0) {
    ratesListEl.innerHTML = '<li class="muted">Tariffe non impostate.</li>';
    return;
  }
  entries.forEach((r) => {
    const li = document.createElement('li');
    li.textContent = `${r.label}: ${r.value}€`;
    ratesListEl.appendChild(li);
  });
}

function setAvatarImage(url) {
  if (!avatarContainer) return;
  let img = avatarContainer.querySelector('img');
  const fallback = avatarContainer.querySelector('.avatar-fallback');
  if (url) {
    if (!img) {
      img = document.createElement('img');
      avatarContainer.prepend(img);
    }
    img.src = url;
    if (fallback) fallback.style.display = 'none';
  } else {
    if (img) img.remove();
    if (fallback) fallback.style.display = 'flex';
  }
}

function showAvatarMenu(show) {
  if (!avatarMenu) return;
  avatarMenu.style.display = show ? 'flex' : 'none';
}

function openAvatarModal(url) {
  if (!avatarModal || !avatarModalImg) return;
  avatarModalImg.src = url;
  avatarModal.classList.add('active');
}

function closeAvatarModal() {
  if (!avatarModal) return;
  avatarModal.classList.remove('active');
}

function guard(user) {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  if (emailEl) emailEl.textContent = user.email || '';
  if (idEl) idEl.textContent = `UID: ${user.uid}`;
  loadMusicianDoc(user.uid).then((docData) => {
    populateForm(docData?.data);
    if (docData?.data?.photoUrl) setAvatarImage(docData.data.photoUrl);
    if (avatarMenuToggle && docData?.data?.authUid === user.uid) {
      avatarMenuToggle.style.display = 'flex';
    }
  });
}

onAuthStateChanged(auth, guard);

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    saveProfile(auth.currentUser.uid);
  });
}

// Avatar interactions
if (avatarMenuToggle) {
  avatarMenuToggle.addEventListener('click', () => {
    const isOpen = avatarMenu?.style.display === 'flex';
    showAvatarMenu(!isOpen);
  });
}

if (avatarChangeBtn && avatarFileInput) {
  avatarChangeBtn.addEventListener('click', () => {
    avatarFileInput.click();
    showAvatarMenu(false);
  });

  avatarFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result;
      if (!dataUrl) return;
      setAvatarImage(dataUrl);
      await saveProfile(auth.currentUser.uid, { overridePhotoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  });
}

if (avatarViewBtn) {
  avatarViewBtn.addEventListener('click', () => {
    const currentImg = avatarContainer?.querySelector('img');
    const src = currentImg?.src;
    if (src) openAvatarModal(src);
    showAvatarMenu(false);
  });
}

if (avatarContainer) {
  avatarContainer.addEventListener('click', (e) => {
    if (e.target === avatarMenuToggle || avatarMenu?.contains(e.target)) return;
    const img = avatarContainer.querySelector('img');
    if (img?.src) openAvatarModal(img.src);
  });
}

if (avatarModalClose) {
  avatarModalClose.addEventListener('click', closeAvatarModal);
}
if (avatarModal) {
  avatarModal.addEventListener('click', (e) => {
    if (e.target === avatarModal) closeAvatarModal();
  });
}
