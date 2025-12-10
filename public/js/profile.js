// public/js/profile.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
const emailEl = document.getElementById('user-email');
const idEl = document.getElementById('user-id');
const msgEl = document.getElementById('profile-message');
const pageTitleEl = document.getElementById('profile-page-title');
const pageSubtitleEl = document.getElementById('profile-page-subtitle');
const LAST_PROFILE_NAME_KEY = 'musimatch-last-profile-name';

const titleEl = document.getElementById('profile-title');
const mainInstrText = document.getElementById('profile-mainInstrument');
const instrumentsText = document.getElementById('profile-instruments');
const profileLabelMainInstrument = document.getElementById('profile-label-mainInstrument');
const profileLabelInstruments = document.getElementById('profile-label-instruments');
const levelText = document.getElementById('profile-level');
const locationText = document.getElementById('profile-location');
const maxTravelText = document.getElementById('profile-maxTravel');
const genderText = document.getElementById('profile-gender');
const genderField = document.getElementById('profile-gender-field');
const nationalityText = document.getElementById('profile-nationality');
const nationalityField = document.getElementById('profile-nationality-field');
const bioText = document.getElementById('profile-bio');
const cvText = document.getElementById('profile-cv');
const willingText = document.getElementById('profile-willing');
const ratesListEl = document.getElementById('rates-list');
const urlUserId = new URLSearchParams(window.location.search).get('id');
let dataCache = {};

const avatarContainer = document.getElementById('profile-avatar');
const avatarModal = document.getElementById('avatar-modal');
const avatarModalImg = document.getElementById('avatar-modal-img');
const avatarModalClose = document.getElementById('avatar-modal-close');

if (titleEl) {
  titleEl.style.display = 'none';
  titleEl.textContent = '';
}

function clearLastProfileName() {
  try {
    sessionStorage.removeItem(LAST_PROFILE_NAME_KEY);
  } catch (e) {
    // ignore
  }
}

// Bust cache degli avatar locali automaticamente (una volta al giorno)
const AVATAR_VERSION = (() => {
  const key = 'musimatch-avatar-version';
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    sessionStorage.setItem(key, today);
    return today;
  } catch (e) {
    return today;
  }
})();

function setMessage(text, isError = false) {
  if (!msgEl) return;
  msgEl.textContent = text || '';
  msgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function slugifyInstrument(raw) {
  if (!raw) return null;
  const clean = raw
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || null;
}

function normalizeInstrumentName(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizeGenderSlug(raw) {
  const g = (raw || '').toString().toLowerCase();
  if (g === 'male' || g === 'female' || g === 'non_binary') return g;
  return 'unknown';
}

function hasTrumpetSelected({ mainInstrument, instruments = [] }) {
  const target = 'Tromba';
  return mainInstrument === target || instruments.includes(target);
}

const AVATAR_ROOT = 'assets/img/avatars';

function buildAvatarPath({ folder = '', nameParts = [] }) {
  const segments = [AVATAR_ROOT];
  if (folder) segments.push(folder);
  const name = ['avatar', ...nameParts.filter(Boolean)].join('-');
  return `${segments.join('/')}/${name}.png?v=${AVATAR_VERSION}`;
}

function resolveAvatarUrls(data) {
  const genderSlug = normalizeGenderSlug(data?.gender);
  const instrumentSlug = data?.mainInstrumentSlug || slugifyInstrument(data?.mainInstrument || '');
  const slugAliases = {
    flauto: 'flute',
    corno: 'corno-francese',
    'corno-francese': 'corno-francese',
    'sax-contralto': 'sax-contralto',
    eufonio: 'euphonium',
    eufonium: 'euphonium',
    tastiere: 'tastiera',
    'clarinetto-basso': 'clarinetto',
    chitarra: 'chitarra-classica',
    cornetta: 'tromba',
    flicorno: 'tromba'
  };
  const instrumentVariants = [];
  if (data?.role === 'singer') {
    instrumentVariants.push('cantante');
  } else {
    if (instrumentSlug) instrumentVariants.push(instrumentSlug);
    if (instrumentSlug && slugAliases[instrumentSlug] && slugAliases[instrumentSlug] !== instrumentSlug) {
      instrumentVariants.push(slugAliases[instrumentSlug]);
    }
  }
  const urls = [];
  if (data?.photoUrl) urls.push(data.photoUrl);

  if (data?.userType === 'ensemble') {
    const ensembleSlug = (data.ensembleType || '').toString().toLowerCase();
    if (ensembleSlug) urls.push(buildAvatarPath({ folder: 'avatar-ensemble', nameParts: [ensembleSlug] }));
    urls.push(buildAvatarPath({ folder: 'avatar-ensemble', nameParts: ['ensemble'] }));
  } else {
    instrumentVariants.forEach((variant) => {
      urls.push(buildAvatarPath({ nameParts: [variant, genderSlug] }));
    });
  }

  urls.push(buildAvatarPath({ folder: 'avatar-default', nameParts: ['default', genderSlug] }));
  urls.push(buildAvatarPath({ folder: 'avatar-default', nameParts: ['default'] }));
  return urls.filter(Boolean);
}

function updatePageHeading(data, isOwnProfile) {
  if (!pageTitleEl || !pageSubtitleEl) return;
  if (isOwnProfile) {
    pageTitleEl.textContent = 'Il tuo profilo';
    pageSubtitleEl.textContent = 'Visualizza il profilo come lo vedono gli altri musicisti.';
  } else {
    const displayName = data?.displayName || 'Profilo musicista';
    pageTitleEl.textContent = displayName;
    pageSubtitleEl.textContent = 'Visualizzazione pubblica di questo profilo.';
  }
}

// Imposta un titolo neutro subito quando si entra con id query, evitando il flash di "Il tuo profilo"
if (pageTitleEl && pageSubtitleEl) {
  if (urlUserId) {
    let cachedName = '';
    try {
      cachedName = sessionStorage.getItem(LAST_PROFILE_NAME_KEY) || '';
    } catch (e) {
      cachedName = '';
    }
    pageTitleEl.textContent = cachedName || 'Profilo musicista';
    pageSubtitleEl.textContent = 'Visualizzazione pubblica di questo profilo.';
  } else {
    clearLastProfileName();
    pageTitleEl.textContent = 'Il tuo profilo';
    pageSubtitleEl.textContent = 'Visualizza il profilo come lo vedono gli altri musicisti.';
  }
}

async function loadUserDoc(uid) {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('authUid', '==', uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

async function loadUserDocById(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return { id: snap.id, data: snap.data() };
}

function populateForm(data) {
  if (!data) return;
  dataCache = data;
  const isEnsemble = data.userType === 'ensemble';
  if (titleEl) titleEl.textContent = data.displayName || 'Profilo musicista';
  if (mainInstrText) mainInstrText.textContent = data.mainInstrument || 'Non indicato';
  if (instrumentsText) {
    if (Array.isArray(data.instruments) && data.instruments.length > 0) {
      instrumentsText.textContent = data.instruments.join(', ');
    } else {
      instrumentsText.textContent = 'Non indicati';
    }
  }
  if (levelText) {
    const map = {
      professional: 'Professionista',
      amateur: 'Amatore'
    };
    levelText.textContent = map[data.activityLevel] || '—';
  }
  if (locationText) {
    const loc = data.location || {};
    const city = loc.city || '—';
    const province = loc.province ? ` (${loc.province})` : '';
    const addressLine = [loc.street, loc.streetNumber].filter(Boolean).join(' ');
    const locationString = isEnsemble && addressLine
      ? `${addressLine}, ${city}${province}`
      : `${city}${province}`;
    locationText.textContent = locationString;
  }
  if (maxTravelText) {
    const val = Number.isFinite(data.maxTravelKm) ? `${data.maxTravelKm} km` : '—';
    maxTravelText.textContent = val;
  }
  if (profileLabelMainInstrument) {
    profileLabelMainInstrument.textContent = data.role === 'singer' ? 'Estensione vocale principale' : 'Strumento principale';
  }
  if (profileLabelInstruments) {
    profileLabelInstruments.textContent = data.role === 'singer' ? 'Capacità vocale' : 'Altri strumenti suonati';
  }
  if (bioText) bioText.textContent = data.bio || 'Nessuna bio';
  if (cvText) cvText.textContent = data.curriculum || 'Nessun curriculum';
  const showGender = data.genderVisible && data.gender;
  if (genderField) genderField.style.display = showGender ? '' : 'none';
  if (genderText && showGender) {
    const map = {
      male: 'Uomo',
      female: 'Donna',
      non_binary: 'Non binario'
    };
    genderText.textContent = map[data.gender] || data.gender;
  }
  const showNationality = data.nationalityVisible && data.nationality;
  if (nationalityField) nationalityField.style.display = showNationality ? '' : 'none';
  if (nationalityText && showNationality) {
    nationalityText.textContent = data.nationality;
  }
  if (willingText) willingText.textContent = data.willingToJoinForFree ? 'Sì' : 'No';
  renderRates(data.rates || {});
}

function renderRates(rates) {
  if (!ratesListEl) return;
  ratesListEl.innerHTML = '';
  const hasTrumpet = hasTrumpetSelected({
    mainInstrument: normalizeInstrumentName(dataCache?.mainInstrument || ''),
    instruments: Array.isArray(dataCache?.instruments) ? dataCache.instruments : []
  });
  const labels = {
    rehearsal: 'Prova',
    concert_or_mass: 'Concerto / messa',
    service_civil_religious: 'Servizio civile/religioso',
    service_civil_trumpet_full: hasTrumpet ? 'Servizio civile (squilli+silenzio)' : null,
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

function setAvatarImage(urls = []) {
  if (!avatarContainer) return;
  let img = avatarContainer.querySelector('img');
  const fallback = avatarContainer.querySelector('.avatar-fallback');
  const queue = Array.isArray(urls) ? urls.slice() : [urls].filter(Boolean);

  const applyNext = () => {
    const nextUrl = queue.shift();
    if (!nextUrl) {
      if (img) img.remove();
      if (fallback) fallback.style.display = 'flex';
      return;
    }
    if (!img) {
      img = document.createElement('img');
      avatarContainer.prepend(img);
    }
    img.onerror = applyNext;
    img.onload = () => {
      if (fallback) fallback.style.display = 'none';
    };
    img.src = nextUrl;
  };

  applyNext();
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
  const renderTargetProfile = async () => {
    try {
      const targetDoc = urlUserId
        ? await loadUserDocById(urlUserId)
        : await loadUserDoc(user?.uid || '');
      if (!targetDoc) {
        setMessage('Profilo non trovato.', true);
        return;
      }
      const isOwnProfile = !!(targetDoc.data?.authUid && targetDoc.data.authUid === user?.uid) || !urlUserId;
      updatePageHeading(targetDoc.data, isOwnProfile);
      if (titleEl) {
        if (isOwnProfile) {
          titleEl.style.display = '';
          titleEl.textContent = targetDoc.data?.displayName || 'Profilo musicista';
          clearLastProfileName();
        } else {
          titleEl.style.display = 'none';
          titleEl.textContent = '';
        }
      }
      populateForm(targetDoc.data);
      const avatarUrls = resolveAvatarUrls(targetDoc.data);
      setAvatarImage(avatarUrls);
    } catch (err) {
      console.error('[MusiMatch] Errore caricamento profilo:', err);
      setMessage('Errore nel caricamento del profilo.', true);
    }
  };

  if (urlUserId) {
    if (emailEl && user?.email) emailEl.textContent = user.email;
    if (idEl && user?.uid) idEl.textContent = `UID: ${user.uid}`;
    renderTargetProfile();
    return;
  }

  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  if (emailEl) emailEl.textContent = user.email || '';
  if (idEl) idEl.textContent = `UID: ${user.uid}`;
  renderTargetProfile();
}

onAuthStateChanged(auth, guard);

if (avatarContainer) {
  avatarContainer.addEventListener('click', (e) => {
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
