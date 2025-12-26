// public/js/favorites.js
import { auth, db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { addDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const listEl = document.getElementById('favorites-list');
const emptyEl = document.getElementById('favorites-empty');
const countEl = document.getElementById('favorites-count');
const msgModal = document.getElementById('fav-message-modal');
const msgTitleEl = document.getElementById('fav-message-title');
const msgSubEl = document.getElementById('fav-message-sub');
const msgTextEl = document.getElementById('fav-message-text');
const msgSendBtn = document.getElementById('fav-message-send');
const msgCloseBtn = document.getElementById('fav-message-close');
const msgFeedbackEl = document.getElementById('fav-message-feedback');

const TYPE_ORDER = ['musician', 'singer', 'band', 'choir', 'orchestra', 'ensemble', 'other'];
const avatarFallback = 'assets/img/guest/guest-profile.svg';
const AVATAR_VERSION = Date.now().toString();
const AVATAR_ROOT = '/assets/img/avatars';
let currentUserDocId = null;
let currentUserAuthId = null;
let currentMessageTarget = null;
const params = new URLSearchParams(window.location.search);
const referrerProfile =
  document.referrer && document.referrer.includes('profile.html') ? document.referrer : null;

function getProfileTypeTag(data = {}) {
  const userType = (data.userType || '').toLowerCase();
  const ensembleType = (data.ensembleType || data.role || '').toLowerCase();
  const voiceType = (data.voiceType || '').trim();
  if (userType === 'ensemble') {
    if (ensembleType.includes('banda')) return 'band';
    if (ensembleType.includes('coro') || ensembleType.includes('choir')) return 'choir';
    if (ensembleType.includes('orchestra')) return 'orchestra';
    return 'ensemble';
  }
  if (voiceType) return 'singer';
  return 'musician';
}

function mapLevel(level) {
  const l = (level || '').toString().toLowerCase();
  if (l.includes('pro')) return 'Professionista';
  if (l.includes('amat')) return 'Amatore';
  if (l.includes('stud')) return 'Studente';
  return level || '';
}

function mapEnsembleType(role = '') {
  const r = role.toString().toLowerCase();
  if (r.includes('band')) return 'Banda';
  if (r.includes('choir') || r.includes('coro')) return 'Coro';
  if (r.includes('orchestra')) return 'Orchestra';
  return role;
}

function normalizeAvatarUrl(raw) {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  const pngMatch = url.match(/^(https?:\/\/[^/]+)?\/?(assets\/img\/avatars\/[^?]+)\.png(\?.*)?$/i);
  if (pngMatch) {
    const origin = pngMatch[1] || '';
    const path = pngMatch[2] || '';
    const qs = pngMatch[3] || '';
    return `${origin}/${path}.webp${qs}`;
  }
  return url;
}

function setupBackFallback() {
  const returnUrl = referrerProfile;
  if (!returnUrl) return;
  let handled = false;
  try {
    const stateData = { refProfile: returnUrl, guard: true };
    history.replaceState(stateData, '');
    history.pushState(stateData, '');
    window.addEventListener('popstate', (e) => {
      if (handled) return;
      handled = true;
      const ref = (e.state && e.state.refProfile) || returnUrl;
      if (ref) window.location.replace(ref);
      else history.back();
    });
  } catch (err) {
    console.error('[favorites] Errore gestione back al profilo:', err);
  }
}

function normalizeGenderSlug(raw) {
  const g = (raw || '').toString().toLowerCase();
  if (g === 'male' || g === 'female' || g === 'non_binary') return g;
  return 'unknown';
}

function slugifyInstrument(raw) {
  if (!raw) return null;
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
  return clean || null;
}

function buildAvatarPath({ folder = '', nameParts = [] }) {
  const segments = [AVATAR_ROOT];
  if (folder) segments.push(folder);
  const name = ['avatar', ...nameParts.filter(Boolean)].join('-');
  return `${segments.join('/')}/${name}.webp?v=${AVATAR_VERSION}`;
}

function resolveAvatarUrls(data) {
  if (!data) return [];
  const genderSlug = normalizeGenderSlug(data?.gender);
  const instrumentSlug =
    data?.mainInstrumentSlug ||
    slugifyInstrument(data?.mainInstrument || '') ||
    (Array.isArray(data?.instruments) && data.instruments.length ? slugifyInstrument(data.instruments[0]) : '');
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
    flicorno: 'tromba',
    voce: 'cantante',
    vocalist: 'cantante'
  };
  const instrumentVariants = [];
  if (data?.role === 'singer' || data?.voiceType) {
    instrumentVariants.push('cantante');
  } else {
    if (instrumentSlug) instrumentVariants.push(instrumentSlug);
    if (instrumentSlug && slugAliases[instrumentSlug] && slugAliases[instrumentSlug] !== instrumentSlug) {
      instrumentVariants.push(slugAliases[instrumentSlug]);
    }
  }
  const urls = [];
  const photoUrl = normalizeAvatarUrl(data?.photoUrl);
  const photoURL = normalizeAvatarUrl(data?.photoURL);
  const avatarUrl = normalizeAvatarUrl(data?.avatarUrl || data?.avatar || data?.avatarURL);
  if (photoUrl) urls.push(photoUrl);
  if (photoURL) urls.push(photoURL);
  if (avatarUrl) urls.push(avatarUrl);

  if (data?.userType === 'ensemble') {
    const ensembleSlug = (data.ensembleType || '').toString().toLowerCase();
    if (ensembleSlug) urls.push(buildAvatarPath({ folder: 'avatar-ensemble', nameParts: [ensembleSlug] }));
    urls.push(buildAvatarPath({ folder: 'avatar-ensemble', nameParts: ['ensemble'] }));
  } else {
    instrumentVariants.forEach((variant) => {
      urls.push(buildAvatarPath({ nameParts: [variant, genderSlug] }));
    });
  }

  urls.push(buildAvatarPath({ nameParts: ['cantante', genderSlug] }));
  urls.push(buildAvatarPath({ folder: 'avatar-default', nameParts: ['default', genderSlug] }));
  urls.push(buildAvatarPath({ folder: 'avatar-default', nameParts: ['default'] }));
  return urls.map((u) => normalizeAvatarUrl(u)).filter(Boolean);
}

function pickPreferredAvatarUrl(data) {
  const urls = resolveAvatarUrls(data || {});
  return urls.length ? urls[0] : avatarFallback;
}

function getAvatarUrl(data = {}) {
  const url =
    data.photoUrl ||
    data.photoURL ||
    data.avatarUrl ||
    data.avatar ||
    data.avatarURL ||
    null;
  if (/^data:image\//i.test(url || '')) return url;
  return pickPreferredAvatarUrl(data);
}

function getNameParts(data = {}) {
  const first = data.firstName || (data.displayName || '').split(' ')[0] || '';
  const last = data.lastName || (data.displayName || '').split(' ').slice(1).join(' ');
  return { first: first.trim(), last: last.trim() };
}

function buildThreadId(uidA, uidB) {
  return [uidA, uidB].filter(Boolean).sort().join('__');
}

function buildRow(profile, fav) {
  const row = document.createElement('div');
  row.className = 'favorite-row';

  const left = document.createElement('div');
  left.className = 'favorite-left';
  const avatarLink = document.createElement('a');
  avatarLink.href = `profile.html?id=${fav.targetId}`;
  avatarLink.className = 'favorite-avatar-link';
  avatarLink.title = 'Visita profilo';
  const avatar = document.createElement('div');
  avatar.className = 'favorite-avatar';
  const img = document.createElement('img');
  img.alt = 'Avatar';
  img.src = getAvatarUrl(profile);
  avatar.appendChild(img);
  avatarLink.appendChild(avatar);
  left.appendChild(avatarLink);

  const info = document.createElement('div');
  info.className = 'favorite-info';
  const { first, last } = getNameParts(profile);
  const nameEl = document.createElement('a');
  nameEl.className = 'favorite-name';
  nameEl.textContent = [first, last].filter(Boolean).join(' ') || (profile.displayName || 'Profilo');
  nameEl.href = `profile.html?id=${fav.targetId}`;
  nameEl.title = 'Visita profilo';
  const cityEl = document.createElement('p');
  cityEl.className = 'favorite-meta';
  const city = profile.city || profile.location?.city || '';
  const mainInstrument = profile.mainInstrument || profile.mainInstrumentSlug || '';
  const voice = profile.voiceType || '';
  const role = mapEnsembleType(profile.ensembleType || profile.role || '');
  const level = profile.activityLevel || profile.level || '';
  const levelLabel = mapLevel(level);
  const details = [city, voice || mainInstrument || role, levelLabel].filter(Boolean).join(' · ');
  cityEl.textContent = details || city;
  info.appendChild(nameEl);
  info.appendChild(cityEl);
  left.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'favorite-actions';
  const menuWrap = document.createElement('div');
  menuWrap.className = 'fav-menu-wrapper';
  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'fav-menu-btn';
  menuBtn.textContent = '⋮';
  const menu = document.createElement('div');
  menu.className = 'fav-menu';
  const btnMsg = document.createElement('button');
  btnMsg.type = 'button';
  btnMsg.textContent = 'Invia messaggio';
  btnMsg.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await openMessageModal(profile, fav);
    } catch (err) {
      console.error('[MusiMatch] Errore apertura modal messaggio:', err);
      setMsgFeedback('Errore nell’aprire il messaggio.', true);
    } finally {
      menu.classList.remove('open');
    }
  });
  const btnDel = document.createElement('button');
  btnDel.type = 'button';
  btnDel.textContent = 'Elimina';
  btnDel.addEventListener('click', async (e) => {
    e.stopPropagation();
    await removeFavorite(fav.targetId);
  });
  menu.appendChild(btnMsg);
  menu.appendChild(btnDel);
  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(menu);
  actions.appendChild(menuWrap);

  row.appendChild(left);
  row.appendChild(actions);

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });
  return row;
}

function renderFavorites(groups) {
  if (!listEl) return;
  listEl.innerHTML = '';
  const total = groups.reduce((acc, g) => acc + g.items.length, 0);
  if (countEl) countEl.textContent = total ? `${total} profili` : '';
  const hasItems = total > 0;
  if (emptyEl) emptyEl.style.display = hasItems ? 'none' : '';
  groups.forEach((group) => {
    if (!group.items.length) return;
    const section = document.createElement('div');
    section.className = 'favorite-section';
    const title = document.createElement('h4');
    title.className = 'favorite-section-title';
    title.textContent = group.label;
    section.appendChild(title);
    const table = document.createElement('div');
    table.className = 'favorite-table';
    group.items.forEach((item) => {
      table.appendChild(buildRow(item.data, item.fav));
    });
    section.appendChild(table);
    listEl.appendChild(section);
  });
}

async function loadFavorites(userDocId) {
  const favCol = collection(db, 'users', userDocId, 'favorites');
  const snap = await getDocs(query(favCol, orderBy('createdAt', 'desc')));
  if (snap.empty) return [];
  const favs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const profiles = await Promise.all(
    favs.map(async (f) => {
      const u = await getDoc(doc(db, 'users', f.targetId));
      if (!u.exists()) return null;
      const data = u.data();
      return { data: { ...data, authUid: data.authUid }, id: u.id, fav: f };
    })
  );
  return profiles.filter(Boolean);
}

function groupAndSort(items) {
  const labelMap = {
    musician: 'Musicisti',
    singer: 'Cantanti',
    band: 'Banda',
    choir: 'Coro',
    orchestra: 'Orchestra',
    ensemble: 'Ensemble',
    other: 'Altro'
  };
  const grouped = TYPE_ORDER.map((t) => ({ type: t, label: labelMap[t] || t, items: [] }));
  items.forEach((item) => {
    const tag = getProfileTypeTag(item.data) || 'other';
    const bucket = grouped.find((g) => g.type === tag) || grouped[grouped.length - 1];
    bucket.items.push(item);
  });
  return grouped;
}

async function loadUserDocByAuth(uid) {
  const usersCol = collection(db, 'users');
  const snap = await getDocs(query(usersCol, where('authUid', '==', uid)));
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    try {
      const userDoc = await loadUserDocByAuth(user.uid);
      if (!userDoc) {
        if (emptyEl) emptyEl.textContent = 'Impossibile caricare i preferiti (profilo non trovato).';
        if (emptyEl) emptyEl.style.display = '';
        return;
      }
      currentUserDocId = userDoc.id;
      currentUserAuthId = user.uid;
      const items = await loadFavorites(userDoc.id);
      const groups = groupAndSort(items);
      renderFavorites(groups);
      setupBackFallback();
    } catch (err) {
      console.error('[MusiMatch] Errore caricamento preferiti:', err);
      if (emptyEl) {
        emptyEl.textContent = 'Errore nel caricare i preferiti.';
        emptyEl.style.display = '';
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

document.addEventListener('click', () => {
  document.querySelectorAll('.fav-menu.open').forEach((m) => m.classList.remove('open'));
});
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.fav-menu-wrapper')) return;
  document.querySelectorAll('.fav-menu.open').forEach((m) => m.classList.remove('open'));
}, { capture: true });

async function removeFavorite(targetId) {
  if (!currentUserDocId || !targetId) return;
  const ok = window.confirm('Vuoi rimuovere questo profilo dai preferiti?');
  if (!ok) return;
  await deleteDoc(doc(db, 'users', currentUserDocId, 'favorites', targetId));
  const items = await loadFavorites(currentUserDocId);
  const groups = groupAndSort(items);
  renderFavorites(groups);
}

function setMsgFeedback(text, isError = false) {
  if (!msgFeedbackEl) return;
  msgFeedbackEl.textContent = text || '';
  msgFeedbackEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

async function openMessageModal(profile, fav) {
  if (!msgModal || !profile || !fav) return;
  setMsgFeedback('');
  msgModal.classList.remove('active');
  let authUid = profile.authUid;
  if (!authUid) {
    try {
      const snap = await getDoc(doc(db, 'users', fav.targetId));
      if (snap.exists()) {
        authUid = snap.data().authUid;
      }
    } catch (err) {
      console.error('[MusiMatch] Errore lettura profilo preferito:', err);
    }
  }
  if (!authUid) {
    setMsgFeedback('Profilo non valido per i messaggi.', true);
    return;
  }
  currentMessageTarget = {
    profileId: fav.targetId,
    authUid,
    name: profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Profilo'
  };
  if (msgTitleEl) msgTitleEl.textContent = 'Invia un messaggio';
  if (msgSubEl) {
    msgSubEl.textContent = `A ${currentMessageTarget.name}`;
    msgSubEl.classList.add('fav-msg-to');
  }
  if (msgTextEl) msgTextEl.value = '';
  msgModal.style.display = 'grid';
  msgModal.style.visibility = 'visible';
  msgModal.style.pointerEvents = 'auto';
  msgModal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    msgModal.classList.add('active');
  });
  msgModal.addEventListener('click', (e) => {
    if (e.target === msgModal) {
      closeMessageModal();
    }
  }, { once: true });
  setTimeout(() => msgTextEl?.focus({ preventScroll: true }), 30);
}

function closeMessageModal() {
  if (!msgModal) return;
  msgModal.setAttribute('aria-hidden', 'true');
  msgModal.classList.remove('active');
  msgModal.style.pointerEvents = 'none';
  setTimeout(() => {
    msgModal.style.visibility = 'hidden';
    msgModal.style.display = 'none';
  }, 240);
}

async function sendFavoriteMessage() {
  setMsgFeedback('');
  if (!currentMessageTarget || !currentMessageTarget.authUid || !currentUserAuthId) {
    setMsgFeedback('Destinatario non valido.', true);
    return;
  }
  const text = (msgTextEl?.value || '').trim();
  if (!text) {
    setMsgFeedback('Scrivi un messaggio.', true);
    return;
  }
  if (!auth.currentUser) {
    setMsgFeedback('Devi essere loggato.', true);
    return;
  }
  const threadId = buildThreadId(currentUserAuthId, currentMessageTarget.authUid);
  const threadRef = doc(db, 'threads', threadId);
  try {
    msgSendBtn.disabled = true;
    await setDoc(threadRef, {
      participants: [currentUserAuthId, currentMessageTarget.authUid],
      participantNames: {
        [currentUserAuthId]: auth.currentUser.displayName || auth.currentUser.email || 'Tu',
        [currentMessageTarget.authUid]: currentMessageTarget.name
      },
      lastMessage: text,
      lastSenderUid: currentUserAuthId,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
    await addDoc(collection(threadRef, 'messages'), {
      text,
      fromUid: currentUserAuthId,
      createdAt: serverTimestamp()
    });
    setMsgFeedback('Messaggio inviato.');
    closeMessageModal();
  } catch (err) {
    console.error('[MusiMatch] Errore invio messaggio preferiti:', err);
    setMsgFeedback('Errore nell’invio.', true);
  } finally {
    msgSendBtn.disabled = false;
  }
}

if (msgSendBtn) msgSendBtn.addEventListener('click', sendFavoriteMessage);
if (msgCloseBtn) msgCloseBtn.addEventListener('click', closeMessageModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMessageModal();
});

// Silenzia eventuali promise rejection derivanti da estensioni/popup chiusi
window.addEventListener('unhandledrejection', (e) => {
  e.preventDefault();
  console.warn('[MusiMatch] Reiezione non gestita bloccata in preferiti:', e.reason);
});
