// public/js/home.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {
  loadCityList,
  filterCities,
  findCityByName,
  geocodeCityName
} from './search.js';

const guestBlock = document.getElementById('home-guest');
const userBlock = document.getElementById('home-user');
const usernameEls = Array.from(document.querySelectorAll('[data-home-username]'));
const homeTitleEl = document.getElementById('home-title');
const homeSubtitleEl = document.getElementById('home-subtitle');
const postTextEl = document.getElementById('post-text');
const postInstrumentsEl = document.getElementById('post-instruments');
const postInstrumentsSuggestionsEl = document.getElementById('post-instruments-suggestions');
const postRadiusEl = document.getElementById('post-radius');
const postVoicesEl = document.getElementById('post-voices');
const postVoicesSuggestionsEl = document.getElementById('post-voices-suggestions');
const postVoicesClearBtn = document.getElementById('post-voices-clear');
const postTargetCityEl = document.getElementById('post-target-city');
const postTargetCitySuggestionsEl = document.getElementById('post-target-city-suggestions');
const postOpenModalBtn = document.getElementById('post-open-modal');
const postCloseModalBtn = document.getElementById('post-close-modal');
const postModal = document.getElementById('post-modal');
const postSubmitBtn = document.getElementById('post-submit');
const postMsgEl = document.getElementById('post-message');
const postsFeedEl = document.getElementById('posts-feed');
const postsEmptyEl = document.getElementById('posts-empty');
let postsEmptyDefaultText = postsEmptyEl?.textContent || 'Non ci sono annunci in questo momento. Torna a trovarci più tardi.';

// Assicura che il modal sia nascosto al load se aria-hidden è true
if (postModal && postModal.getAttribute('aria-hidden') !== 'false') {
  postModal.style.display = 'none';
  postModal.style.visibility = 'hidden';
  postModal.style.pointerEvents = 'none';
}
// Evita flash guest: svuota header finché non arriva lo stato auth
if (homeTitleEl) homeTitleEl.textContent = '';
if (homeSubtitleEl) homeSubtitleEl.textContent = '';

let currentUserProfile = null;
let selectedInstruments = [];
let selectedVoices = [];
let cityList = [];
let cityListLoaded = false;
let postModalOpen = false;
let currentEditingPostId = null;
let currentEditingPostData = null;

// Cache-busting versione avatar (forza refresh ad ogni load)
const AVATAR_VERSION = Date.now().toString();
const AVATAR_ROOT = '/assets/img/avatars';

function slugifyInstrument(raw) {
  if (!raw) return null;
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || null;
}

function normalizeGenderSlug(raw) {
  const g = (raw || '').toString().toLowerCase();
  if (g === 'male' || g === 'female' || g === 'non_binary') return g;
  return 'unknown';
}

function buildAvatarPath({ folder = '', nameParts = [] }) {
  const segments = [AVATAR_ROOT];
  if (folder) segments.push(folder);
  const name = ['avatar', ...nameParts.filter(Boolean)].join('-');
  return `${segments.join('/')}/${name}.png?v=${AVATAR_VERSION}`;
}

function resolveAvatarUrls(data) {
  if (!data) return [];
  const genderSlug = normalizeGenderSlug(data.gender);
  const instrumentSlug =
    data.mainInstrumentSlug ||
    slugifyInstrument(data.mainInstrument || '') ||
    (Array.isArray(data.instruments) && data.instruments.length
      ? slugifyInstrument(data.instruments[0])
      : '');
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
  if (data.role === 'singer' || data.voiceType) {
    instrumentVariants.push('cantante');
  } else {
    if (instrumentSlug) instrumentVariants.push(instrumentSlug);
    if (instrumentSlug && slugAliases[instrumentSlug] && slugAliases[instrumentSlug] !== instrumentSlug) {
      instrumentVariants.push(slugAliases[instrumentSlug]);
    }
  }
  const urls = [];
  if (data.photoUrl) urls.push(data.photoUrl);
  if (data.photoURL) urls.push(data.photoURL);
  if (data.avatarUrl) urls.push(data.avatarUrl);

  if (data.userType === 'ensemble') {
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

function pickPreferredAvatarUrl(data) {
  const urls = resolveAvatarUrls(data);
  return urls.length ? urls[0] : null;
}

function expandAvatarCandidates(list) {
  const out = [];
  const seen = new Set();
  (list || []).forEach((item) => {
    if (!item) return;
    const variants = [];
    variants.push(item);
    const clean = item.replace(/^\//, '');
    if (!item.startsWith('/')) variants.push('/' + clean);
    variants.push(window.location.origin + '/' + clean);
    const noQuery = item.split('?')[0];
    if (noQuery && noQuery !== item) variants.push(noQuery);
    if (!noQuery.startsWith('/')) variants.push('/' + noQuery);
    variants.push(window.location.origin + '/' + noQuery.replace(/^\//, ''));
    variants.forEach((v) => {
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    });
  });
  return out;
}

function ensureEmptyElAttached() {
  if (!postsFeedEl || !postsEmptyEl) return;
  if (!postsFeedEl.contains(postsEmptyEl)) {
    postsFeedEl.appendChild(postsEmptyEl);
  }
}

function resetFeedContainer({ loadingText = null } = {}) {
  if (!postsFeedEl) return;
  postsFeedEl.innerHTML = '';
  if (postsEmptyEl) {
    postsFeedEl.appendChild(postsEmptyEl);
    postsEmptyEl.textContent = loadingText || postsEmptyDefaultText;
    postsEmptyEl.style.color = loadingText ? 'var(--muted)' : '';
  }
}

function setUsername(text) {
  usernameEls.forEach((el) => {
    el.textContent = text || '';
  });
}

function cleanDisplayName(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withoutDomain = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const normalized = withoutDomain.replace(/[_\\.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const needsTitleCase =
    trimmed.includes('@') ||
    normalized === normalized.toLowerCase() ||
    normalized === normalized.toUpperCase();
  if (!needsTitleCase) return normalized;
  return normalized
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function showGuest() {
  if (guestBlock) guestBlock.style.display = '';
  if (userBlock) userBlock.style.display = 'none';
  setUsername('');
  if (homeTitleEl) homeTitleEl.textContent = 'Benvenuto';
  if (homeSubtitleEl) homeSubtitleEl.textContent = 'Accedi per gestire il tuo profilo o cercare musicisti.';
}

function showUser(name) {
  const safeName = cleanDisplayName(name) || 'musicista';
  setUsername(safeName);
  if (guestBlock) guestBlock.style.display = 'none';
  if (userBlock) userBlock.style.display = '';
  if (homeTitleEl) homeTitleEl.textContent = 'Home';
  if (homeSubtitleEl) homeSubtitleEl.textContent = safeName ? `Ciao, ${safeName}. Consulta gli annunci vicino a te.` : 'Ciao!';
}

function setPostMessage(text, isError = false) {
  if (!postMsgEl) return;
  postMsgEl.textContent = text || '';
  postMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function setFeedEmptyState(visible) {
  if (postsEmptyEl) postsEmptyEl.style.display = visible ? '' : 'none';
}

function degToRad(deg) {
  return deg * Math.PI / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = degToRad(lat2 - lat1);
  const dLng = degToRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
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

function parseInstruments(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((t) => normalizeInstrumentName(t))
    .filter(Boolean);
}

async function ensureCityListLoaded() {
  if (cityListLoaded && cityList.length > 0) return cityList;
  try {
    cityList = await loadCityList();
    cityListLoaded = true;
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento lista città:', err);
    cityList = [];
    cityListLoaded = false;
  }
  return cityList;
}

const VOICE_OPTIONS = [
  'Soprano',
  'Mezzosoprano',
  'Contralto',
  'Tenore',
  'Baritono',
  'Basso'
];

function renderInstrumentChips() {
  if (!postInstrumentsEl) return;
  const unique = Array.from(new Set(selectedInstruments.map((i) => normalizeInstrumentName(i)).filter(Boolean)));
  selectedInstruments = unique;
  postInstrumentsEl.value = unique.join(', ');
}

function updateVoiceClearVisibility() {
  if (!postVoicesClearBtn) return;
  const hasVoices = selectedVoices.length > 0;
  postVoicesClearBtn.hidden = !hasVoices;
}

function renderVoiceChips() {
  if (!postVoicesEl) return;
  const unique = Array.from(new Set(selectedVoices.map((i) => normalizeInstrumentName(i)).filter(Boolean)));
  selectedVoices = unique;
  postVoicesEl.value = unique.join(', ');
  updateVoiceClearVisibility();
}

function renderInstrumentSuggestions(term) {
  if (!postInstrumentsSuggestionsEl) return;
  postInstrumentsSuggestionsEl.innerHTML = '';
  const fragment = (term || '').split(',').pop().trim();
  if (!fragment) {
    postInstrumentsSuggestionsEl.hidden = true;
    return;
  }
  const pool = [
    'Arpa', 'Batteria', 'Basso elettrico', 'Chitarra', 'Chitarra acustica', 'Chitarra classica', 'Chitarra elettrica',
    'Clarinetto', 'Contrabbasso', 'Corno francese', 'Euphonium', 'Fagotto', 'Fisarmonica', 'Flauto', 'Glockenspiel',
    'Mandolino', 'Marimba', 'Oboe', 'Organo', 'Percussioni', 'Pianoforte', 'Sax contralto', 'Sax tenore', 'Sax baritono',
    'Sax soprano', 'Tastiera', 'Timpani', 'Tromba', 'Trombone', 'Tuba', 'Viola', 'Violino', 'Violoncello', 'Xilofono',
    'Voce', 'Cantante'
  ];
  const normTerm = fragment.toLowerCase();
  const filtered = pool.filter((i) => i.toLowerCase().includes(normTerm)).slice(0, 8);
  if (filtered.length === 0) {
    postInstrumentsSuggestionsEl.hidden = true;
    return;
  }
  filtered.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.textContent = item;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectedInstruments.push(item);
      renderInstrumentChips();
      postInstrumentsSuggestionsEl.hidden = true;
      if (postInstrumentsEl) postInstrumentsEl.focus();
    });
    postInstrumentsSuggestionsEl.appendChild(el);
  });
  postInstrumentsSuggestionsEl.hidden = false;
}

function renderVoiceSuggestions() {
  if (!postVoicesSuggestionsEl) return;
  postVoicesSuggestionsEl.innerHTML = '';
  VOICE_OPTIONS.forEach((voice) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.textContent = voice;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectedVoices.push(voice);
      renderVoiceChips();
    });
    postVoicesSuggestionsEl.appendChild(el);
  });
  postVoicesSuggestionsEl.hidden = false;
}

async function renderTargetCitySuggestions(term) {
  if (!postTargetCitySuggestionsEl) return;
  postTargetCitySuggestionsEl.innerHTML = '';
  const query = (term || '').trim();
  if (!query) {
    postTargetCitySuggestionsEl.hidden = true;
    return;
  }
  const list = await ensureCityListLoaded();
  if (!list || list.length === 0) {
    postTargetCitySuggestionsEl.hidden = true;
    return;
  }
  const results = filterCities(list, query, 6);
  if (!results.length) {
    postTargetCitySuggestionsEl.hidden = true;
    return;
  }
  results.forEach((city) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.textContent = `${city.name}${city.province ? ' (' + city.province + ')' : ''}`;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (postTargetCityEl) postTargetCityEl.value = city.name;
      postTargetCitySuggestionsEl.hidden = true;
    });
    postTargetCitySuggestionsEl.appendChild(el);
  });
  postTargetCitySuggestionsEl.hidden = false;
}

async function markPostResolved(post) {
  if (!post?.id || !isPostOwner(post)) return;
  try {
    await updateDoc(doc(db, 'posts', post.id), { resolved: true, updatedAt: serverTimestamp() });
    loadFeed();
  } catch (err) {
    console.error('[MusiMatch] Errore nel segnare come risolto:', err);
    setPostMessage('Errore nel segnare come risolto.', true);
  }
}

async function togglePostResolved(post) {
  if (!post?.id || !isPostOwner(post)) return;
  const newResolved = !post.resolved;
  try {
    await updateDoc(doc(db, 'posts', post.id), { resolved: newResolved, updatedAt: serverTimestamp() });
    loadFeed();
  } catch (err) {
    console.error('[MusiMatch] Errore nel cambiare stato risolto:', err);
    setPostMessage('Errore nel cambiare stato.', true);
  }
}

async function deletePost(post) {
  if (!post?.id || !isPostOwner(post)) return;
  const ok = window.confirm('Eliminare definitivamente questo annuncio?');
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'posts', post.id));
    if (currentEditingPostId === post.id) {
      currentEditingPostId = null;
      currentEditingPostData = null;
      if (postSubmitBtn) postSubmitBtn.textContent = 'Pubblica annuncio';
    }
    loadFeed();
  } catch (err) {
    console.error('[MusiMatch] Errore eliminazione annuncio:', err);
    setPostMessage('Errore nell’eliminazione.', true);
  }
}

function startEditPost(post) {
  if (!post || !isPostOwner(post)) return;
  currentEditingPostId = post.id;
  currentEditingPostData = post;
  if (postTextEl) postTextEl.value = post.body || '';
  selectedInstruments = (post.instrumentsWanted || []).filter(Boolean);
  selectedVoices = (post.voicesWanted || []).filter(Boolean);
  renderInstrumentChips();
  renderVoiceChips();
  if (postTargetCityEl) postTargetCityEl.value = post.location?.city || '';
  if (postSubmitBtn) postSubmitBtn.textContent = 'Salva modifiche';
  openPostModal();
}

function openPostModal() {
  if (!postModal) return;
  postModal.style.display = 'grid';
  postModal.style.visibility = 'visible';
  postModal.style.pointerEvents = 'auto';
  // reset stato chiuso e poi trigghiamo l'animazione nel frame successivo
  postModal.setAttribute('aria-hidden', 'true');
  requestAnimationFrame(() => {
    postModal.setAttribute('aria-hidden', 'false');
  });
  if (!currentEditingPostId && postSubmitBtn) postSubmitBtn.textContent = 'Pubblica annuncio';
  postModalOpen = true;
  if (postTextEl) {
    setTimeout(() => postTextEl.focus({ preventScroll: true }), 50);
  }
}

function closePostModal() {
  if (!postModal) return;
  const active = document.activeElement;
  if (active && postModal.contains(active) && typeof active.blur === 'function') {
    active.blur();
  }
  if (postTargetCitySuggestionsEl) postTargetCitySuggestionsEl.hidden = true;
  if (postVoicesSuggestionsEl) postVoicesSuggestionsEl.hidden = true;
  if (postInstrumentsSuggestionsEl) postInstrumentsSuggestionsEl.hidden = true;
  postModal.setAttribute('aria-hidden', 'true');
  postModalOpen = false;
  postModal.style.visibility = 'hidden';
  postModal.style.pointerEvents = 'none';
  setTimeout(() => {
    if (postModal.getAttribute('aria-hidden') === 'true') {
      postModal.style.display = 'none';
    }
  }, 260);
  if (postOpenModalBtn && typeof postOpenModalBtn.focus === 'function') {
    postOpenModalBtn.focus({ preventScroll: true });
  }
}

async function loadUserProfile(uid) {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('authUid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

function formatDistance(km) {
  if (km == null || Number.isNaN(km)) return '';
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(1)} km`;
}

function formatTimeAgo(date) {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ora';
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h fa`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} gg fa`;
}

function formatDateTime(date) {
  if (!date) return '';
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildProfileUrl(post) {
  const cachedId = post?.authorUid ? authUidToUserId.get(post.authorUid) : null;
  const profileId = post?.authorUserId || cachedId || post?.authorUid || '';
  return profileId ? `profile.html?id=${profileId}` : 'profile.html';
}

const authorPhotoCache = new Map();
const authorProfileCache = new Map(); // key: post identifier -> { id, data }
const authUidToUserId = new Map();

async function fetchUserDocByAuthUid(authUid) {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('authUid', '==', authUid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  authUidToUserId.set(authUid, docSnap.id);
  return { id: docSnap.id, data: docSnap.data() };
}

async function resolveAuthorProfile(post) {
  const cacheKey = post?.id || `${post?.authorUserId || ''}-${post?.authorUid || ''}`;
  if (authorProfileCache.has(cacheKey)) return authorProfileCache.get(cacheKey);
  let userDoc = null;
  const directId = post?.authorUserId;
  const authUid = post?.authorUid;
  try {
    if (directId) {
      const snap = await getDoc(doc(db, 'users', directId));
      if (snap.exists()) {
        userDoc = { id: snap.id, data: snap.data() };
      }
    }
    if (!userDoc && authUid) {
      const cached = authUidToUserId.get(authUid);
      if (cached) {
        const snap = await getDoc(doc(db, 'users', cached));
        if (snap.exists()) userDoc = { id: snap.id, data: snap.data() };
      }
    }
    if (!userDoc && authUid) {
      userDoc = await fetchUserDocByAuthUid(authUid);
    }
  } catch (err) {
    console.error('[MusiMatch] Errore recupero profilo autore:', err);
  }
  authorProfileCache.set(cacheKey, userDoc);
  return userDoc;
}

async function ensureAuthorPhoto(post) {
  const key = post?.authorUserId || post?.authorUid || post?.id;
  if (!key) return null;
  if (authorPhotoCache.has(key)) {
    const cached = authorPhotoCache.get(key);
    if (cached) return cached;
  }
  const userDoc = await resolveAuthorProfile(post);
  let url = null;
  const fallbackProfile = isPostOwner(post) ? currentUserProfile?.data : post?.authorProfileData || null;
  const profileData = userDoc?.data || fallbackProfile;
  if (profileData) {
    post.authorProfileData = profileData;
    const fallback = pickPreferredAvatarUrl(profileData);
    url = profileData.photoUrl || profileData.photoURL || profileData.avatarUrl || fallback || null;
  }
  if (url) authorPhotoCache.set(key, url);
  console.debug('[avatar][ensureAuthorPhoto]', post.id, {
    profileData,
    chosen: url,
    fallbackProfile: !!fallbackProfile,
    candidates: profileData ? resolveAvatarUrls(profileData) : []
  });
  return url;
}

async function hydrateAuthor(post, avatarEl, profileLinks = []) {
  const authorName = post?.authorName || 'Profilo';
  const userDoc = await resolveAuthorProfile(post);
  if (userDoc?.data) {
    post.authorProfileData = userDoc.data;
  }
  const resolvedId = userDoc?.id || post?.authorUserId || authUidToUserId.get(post?.authorUid) || post?.authorUid || '';
  if (resolvedId) {
    const newProfileUrl = buildProfileUrl({ ...post, authorUserId: resolvedId });
    profileLinks.forEach((link) => {
      if (link) link.href = newProfileUrl;
    });
  }
  const photoCandidates = userDoc?.data ? resolveAvatarUrls(userDoc.data) : [];
  if (photoCandidates.length && avatarEl) setAvatarImage(avatarEl, photoCandidates, authorName);
}

function createPostAvatar(name, url) {
  const avatarLink = document.createElement('div');
  avatarLink.className = 'post-avatar';
  avatarLink.title = name || 'Profilo';
  const fallbackChar = ((name || 'M').trim()[0] || 'M').toUpperCase();

  const addFallback = () => {
    avatarLink.innerHTML = '';
    const fallback = document.createElement('span');
    fallback.className = 'avatar-fallback';
    fallback.textContent = fallbackChar;
    avatarLink.appendChild(fallback);
  };

  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = name || 'Avatar';
    img.onerror = addFallback;
    avatarLink.appendChild(img);
  } else {
    addFallback();
  }
  return avatarLink;
}

function setAvatarImage(container, urls, name) {
  if (!container) return;
  const queue = Array.isArray(urls) ? urls.filter(Boolean) : [urls].filter(Boolean);
  if (queue.length === 0) return;
  const tryNext = () => {
    const nextUrl = queue.shift();
    if (!nextUrl) return;
    const img = new Image();
    img.alt = name || 'Avatar';
    img.onload = () => {
      container.innerHTML = '';
      container.appendChild(img);
      console.debug('[avatar][load-ok]', nextUrl);
    };
    img.onerror = (e) => {
      console.debug('[avatar][load-fail]', nextUrl, e?.error || '');
      tryNext();
    };
    img.src = nextUrl;
  };
  tryNext();
}

function isPostOwner(post) {
  const uid = auth.currentUser?.uid;
  const userId = currentUserProfile?.id;
  return (uid && post.authorUid === uid) || (userId && post.authorUserId === userId);
}

const openPostMenus = new Set();

function closeAllPostMenus() {
  openPostMenus.forEach((menu) => {
    menu.hidden = true;
    menu.style.visibility = '';
    menu.style.position = '';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.right = '';
  });
}

function positionPostMenu(menu, trigger) {
  if (!menu) return;
  menu.hidden = false;
  menu.style.visibility = 'visible';
  menu.style.position = '';
  menu.style.left = '';
  menu.style.top = '';
  menu.style.right = '';
  menu.style.zIndex = '20010';
}

function buildPostMenu(post) {
  if (!isPostOwner(post)) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'card-menu-wrapper';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kebab-btn';
  btn.setAttribute('aria-label', 'Azioni annuncio');
  btn.textContent = '⋮';

  const menu = document.createElement('div');
  menu.className = 'card-menu';
  menu.hidden = true;
  openPostMenus.add(menu);

  const addItem = (label, handler, disabled = false) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = label;
    item.disabled = disabled;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      handler();
      closeAllPostMenus();
    });
    menu.appendChild(item);
  };

  addItem('Modifica', () => startEditPost(post));
  const resolvedLabel = post.resolved ? 'Togli il badge "Risolto"' : 'Segna come risolto';
  addItem(resolvedLabel, () => togglePostResolved(post));
  addItem('Elimina', () => deletePost(post));

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    closeAllPostMenus();
    if (willOpen) {
      positionPostMenu(menu);
    } else {
      menu.hidden = true;
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  return wrapper;
}

function renderPostCard(post, distanceKm) {
  if (!postsFeedEl) return;
  ensureEmptyElAttached();
  const card = document.createElement('article');
  card.className = 'result-card';
  if (post.resolved) card.classList.add('post-resolved');

  if (post.resolved) {
    const resolved = document.createElement('span');
    resolved.className = 'badge badge-success badge-floating';
    resolved.textContent = '✓';
    card.appendChild(resolved);
  }

  const heading = document.createElement('div');
  heading.className = 'inline-header post-header-row';
  const loc = post.location || {};
  const createdDate = post.createdAt?.toDate ? post.createdAt.toDate() : (post.createdAt instanceof Date ? post.createdAt : null);
  const profileUrl = buildProfileUrl(post);
  const displayName = post.authorName || 'Profilo';
  const baseProfileData = post.authorProfileData || (isPostOwner(post) ? currentUserProfile?.data : null) || {};
  console.debug('[avatar][render]', post.id, {
    authorName: displayName,
    authorProfileData: baseProfileData,
    authorPhotoUrl: post.authorPhotoUrl,
    authorAvatarUrl: post.authorAvatarUrl,
    initialCandidates: expandAvatarCandidates([
      ...(resolveAvatarUrls(baseProfileData || {}) || []),
      post.authorPhotoUrl,
      post.authorPhotoURL,
      post.authorAvatarUrl
    ].filter(Boolean))
  });
  const authorWrapper = document.createElement('div');
  authorWrapper.className = 'post-author';

  const avatarLink = document.createElement('a');
  avatarLink.className = 'post-avatar-link';
  avatarLink.href = profileUrl;
  avatarLink.title = displayName;
  avatarLink.setAttribute('aria-label', `Apri il profilo di ${displayName}`);
  const avatar = createPostAvatar(displayName, null);
  avatarLink.appendChild(avatar);
  const initialAvatarCandidates = expandAvatarCandidates([
    ...(resolveAvatarUrls(baseProfileData || {}) || []),
    post.authorPhotoUrl,
    post.authorPhotoURL,
    post.authorAvatarUrl
  ].filter(Boolean));
  if (initialAvatarCandidates.length) {
    setAvatarImage(avatar, initialAvatarCandidates, displayName);
  }
  // Hydration con dati aggiornati da Firestore (preferisce gli avatar specifici)
  ensureAuthorPhoto(post)
    .then((url) => {
      const hydratedCandidates = expandAvatarCandidates([
        ...(resolveAvatarUrls(post.authorProfileData || baseProfileData || {}) || []),
        url,
        ...initialAvatarCandidates
      ].filter(Boolean));
      if (hydratedCandidates.length) {
        setAvatarImage(avatar, hydratedCandidates, displayName);
      }
    })
    .catch((err) => {
      console.error('[MusiMatch] Errore caricamento avatar autore:', err);
    });

  const authorText = document.createElement('div');
  authorText.className = 'post-author-text';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.style.margin = '0';
  eyebrow.textContent = post.authorType === 'ensemble' ? 'Ensemble' : 'Musicista';
  const nameLink = document.createElement('a');
  nameLink.className = 'post-author-name post-author-name-link';
  nameLink.href = profileUrl;
  nameLink.title = displayName;
  nameLink.setAttribute('aria-label', `Apri il profilo di ${displayName}`);
  nameLink.textContent = displayName;
  const cityLine = document.createElement('p');
  cityLine.className = 'post-author-city muted xsmall';
  cityLine.style.margin = '0';
  const partsTop = [`${loc.city || '—'}${loc.province ? ' (' + loc.province + ')' : ''}`];
  if (distanceKm != null) partsTop.push(`Distanza da te: ${formatDistance(distanceKm)}`);
  cityLine.textContent = partsTop.join(' · ');
  authorText.appendChild(eyebrow);
  authorText.appendChild(nameLink);
  authorText.appendChild(cityLine);

  authorWrapper.appendChild(avatarLink);
  authorWrapper.appendChild(authorText);

  hydrateAuthor(post, avatar, [nameLink, avatarLink]).catch((err) => {
    console.error('[MusiMatch] Errore nel completare i dati autore:', err);
  });

  heading.appendChild(authorWrapper);
  const menu = buildPostMenu(post);
  if (menu) heading.appendChild(menu);

  const body = document.createElement('p');
  body.className = 'muted';
  body.style.margin = '0.4rem 0';
  body.textContent = post.body || '';

  const footer = document.createElement('div');
  footer.className = 'inline-header';
  footer.style.justifyContent = 'space-between';

  const tags = document.createElement('div');
  tags.className = 'small muted';
  const instruments = (post.instrumentsWanted || []).filter(Boolean);
  const voices = (post.voicesWanted || []).filter(Boolean);
  const labels = [];
  if (instruments.length) labels.push(`Strumenti: ${instruments.join(', ')}`);
  if (voices.length) labels.push(`Voci: ${voices.join(', ')}`);
  tags.textContent = labels.length ? labels.join(' · ') : 'Annuncio generico';

  const meta = document.createElement('div');
  meta.className = 'muted xsmall';
  meta.style.marginLeft = 'auto';
  const parts = [];
  if (createdDate instanceof Date) parts.push(formatDateTime(createdDate));
  meta.textContent = parts.join(' · ');

  footer.appendChild(tags);
  footer.appendChild(meta);

  card.appendChild(heading);
  card.appendChild(body);
  card.appendChild(footer);

  postsFeedEl.appendChild(card);
}

async function fetchPosts() {
  const postsCol = collection(db, 'posts');
  const q = query(postsCol, orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function filterAndRenderPosts(posts) {
  if (!postsFeedEl) return;
  openPostMenus.clear();
  resetFeedContainer();
  ensureEmptyElAttached();
  postsEmptyDefaultText = postsEmptyEl?.textContent || postsEmptyDefaultText;
  let rendered = 0;

  const viewerLoc = currentUserProfile?.data?.location;
  const canComputeDistance = viewerLoc && typeof viewerLoc.lat === 'number' && typeof viewerLoc.lng === 'number';
  const viewerInstruments = Array.isArray(currentUserProfile?.data?.instruments) ? currentUserProfile.data.instruments : [];
  const viewerMain = currentUserProfile?.data?.mainInstrument || '';
  const viewerVoice = currentUserProfile?.data?.voiceType || currentUserProfile?.data?.mainInstrument || '';
  const viewerRadius = currentUserProfile?.data?.maxTravelKm || 50;

  posts.forEach((post) => {
    const isOwner = isPostOwner(post);
    if (isOwner && currentUserProfile?.data) {
      post.authorProfileData = currentUserProfile.data;
      if (!post.authorPhotoUrl) {
        post.authorPhotoUrl =
          currentUserProfile.data.photoUrl ||
          currentUserProfile.data.photoURL ||
          currentUserProfile.data.avatarUrl ||
          pickPreferredAvatarUrl(currentUserProfile.data) ||
          null;
      }
    }
    const posterRadius = Number.isFinite(post.radiusKm) ? post.radiusKm : 50;
    let displayDistance = null;
    let matchesDistance = true;

    if (canComputeDistance) {
      const distances = [];
      if (post.location && typeof post.location.lat === 'number' && typeof post.location.lng === 'number') {
        distances.push(haversineDistanceKm(viewerLoc.lat, viewerLoc.lng, post.location.lat, post.location.lng));
      }
      if (post.authorLocation && typeof post.authorLocation.lat === 'number' && typeof post.authorLocation.lng === 'number') {
        distances.push(haversineDistanceKm(viewerLoc.lat, viewerLoc.lng, post.authorLocation.lat, post.authorLocation.lng));
      }
      if (distances.length > 0) {
        displayDistance = Math.min(...distances);
        matchesDistance = distances.some((d) => d <= viewerRadius && d <= posterRadius);
      }
    }
    if (!matchesDistance && !isOwner) return;

    // Match strumenti/voci se specificati
    const wantedInstruments = (post.instrumentsWanted || []).filter(Boolean);
    const wantedVoices = (post.voicesWanted || []).filter(Boolean);
    const hasInstrumentCriteria = wantedInstruments.length > 0;
    const hasVoiceCriteria = wantedVoices.length > 0;
    let matchesSkill = true;

    if (!isOwner && hasInstrumentCriteria) {
      const lowerSet = new Set([...viewerInstruments, viewerMain].map((i) => (i || '').toLowerCase()));
      matchesSkill = wantedInstruments.some((w) => lowerSet.has((w || '').toLowerCase()));
    }

    if (matchesSkill && !isOwner && hasVoiceCriteria) {
      const viewerVoiceLower = (viewerVoice || '').toLowerCase();
      matchesSkill = wantedVoices.some((v) => (v || '').toLowerCase() === viewerVoiceLower);
    }

    if (!matchesSkill) return;
    renderPostCard(post, displayDistance);
    rendered += 1;
  });

  setFeedEmptyState(rendered === 0);
  if (postsEmptyEl && rendered === 0) {
    postsEmptyEl.textContent = postsEmptyDefaultText;
  }
}

async function loadFeed() {
  if (!currentUserProfile || !postsFeedEl) return;
  resetFeedContainer({ loadingText: 'Carico gli annunci...' });
  setFeedEmptyState(true);
  try {
    const posts = await fetchPosts();
    filterAndRenderPosts(posts);
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento annunci:', err);
    postsFeedEl.innerHTML = '<p class="helper-text" style="color:#f87171; margin:0;">Errore nel caricamento degli annunci.</p>';
  }
}

async function handleEditFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  if (!editId || !auth.currentUser) return;
  try {
    const snap = await getDoc(doc(db, 'posts', editId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (!isPostOwner(post)) return;
    startEditPost(post);
  } catch (err) {
    console.error('[MusiMatch] Errore apertura annuncio da query:', err);
  }
}

async function publishPost() {
  setPostMessage('');
  if (!auth.currentUser || !currentUserProfile) {
    setPostMessage('Devi essere loggato per pubblicare.', true);
    return;
  }
  const body = postTextEl?.value.trim();
  if (!body) {
    setPostMessage('Scrivi qualcosa prima di pubblicare.', true);
    return;
  }
  const instruments = selectedInstruments.length
    ? selectedInstruments
    : parseInstruments(postInstrumentsEl?.value || '');
  const voices = selectedVoices.slice();
  const radius = currentUserProfile.data?.maxTravelKm || 50;
  const loc = currentUserProfile.data?.location || {};
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    setPostMessage('Completa la tua città/sede prima di pubblicare.', true);
    return;
  }
  const authorPhoto =
    currentUserProfile.data?.photoUrl ||
    currentUserProfile.data?.photoURL ||
    currentUserProfile.data?.avatarUrl ||
    pickPreferredAvatarUrl(currentUserProfile.data) ||
    '';

  let postLocation = {
    city: loc.city || '',
    province: loc.province || '',
    lat: loc.lat,
    lng: loc.lng
  };

  const targetCity = postTargetCityEl?.value.trim();
  if (targetCity) {
    try {
      const [coords, list] = await Promise.all([
        geocodeCityName(targetCity),
        ensureCityListLoaded()
      ]);
      const match = list && list.length ? findCityByName(list, targetCity) : null;
      postLocation = {
        city: match?.name || targetCity,
        province: match?.province || '',
        lat: coords.lat,
        lng: coords.lng
      };
    } catch (err) {
      console.error('[MusiMatch] Errore geocoding città annuncio:', err);
      setPostMessage(err.message || 'Città non valida. Seleziona una città dalla lista.', true);
      return;
    }
  }

  const authorLocation = {
    city: loc.city || '',
    province: loc.province || '',
    lat: loc.lat,
    lng: loc.lng
  };

  const profileData = currentUserProfile.data || {};
  const authorAvatarUrl =
    profileData.photoUrl ||
    profileData.photoURL ||
    profileData.avatarUrl ||
    pickPreferredAvatarUrl(profileData) ||
    '';

  const payload = {
    authorUid: auth.currentUser.uid,
    authorUserId: currentUserProfile.id,
    authorName: currentUserProfile.data?.displayName || '',
    authorType: currentUserProfile.data?.userType || 'musician',
    authorPhotoUrl: authorAvatarUrl,
    authorAvatarUrl,
    authorProfileData: {
      userType: profileData.userType || 'musician',
      role: profileData.role || '',
      gender: profileData.gender || '',
      mainInstrument: profileData.mainInstrument || '',
      mainInstrumentSlug: profileData.mainInstrumentSlug || '',
      instruments: Array.isArray(profileData.instruments) ? profileData.instruments : [],
      voiceType: profileData.voiceType || '',
      ensembleType: profileData.ensembleType || '',
      photoUrl: profileData.photoUrl || '',
      photoURL: profileData.photoURL || '',
      avatarUrl: profileData.avatarUrl || ''
    },
    body,
    instrumentsWanted: instruments.length ? instruments : null,
    voicesWanted: voices.length ? voices : null,
    radiusKm: Number.isFinite(radius) ? radius : 50,
    authorLocation,
    location: postLocation,
    resolved: currentEditingPostData?.resolved || false
  };

  try {
    if (currentEditingPostId) {
      const { createdAt: _omit, ...updateData } = payload;
      await updateDoc(doc(db, 'posts', currentEditingPostId), {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      setPostMessage('Annuncio aggiornato.');
    } else {
      await addDoc(collection(db, 'posts'), {
        ...payload,
        resolved: false,
        createdAt: serverTimestamp()
      });
      setPostMessage('Annuncio pubblicato.');
    }
    if (postTextEl) postTextEl.value = '';
    if (postInstrumentsEl) postInstrumentsEl.value = '';
    if (postTargetCityEl) postTargetCityEl.value = '';
    if (postTargetCitySuggestionsEl) postTargetCitySuggestionsEl.hidden = true;
    selectedInstruments = [];
    selectedVoices = [];
    renderInstrumentChips();
    renderVoiceChips();
    currentEditingPostId = null;
    currentEditingPostData = null;
    if (postSubmitBtn) postSubmitBtn.textContent = 'Pubblica annuncio';
    closePostModal();
    loadFeed();
  } catch (err) {
    console.error('[MusiMatch] Errore pubblicazione annuncio:', err);
    setPostMessage('Errore nel pubblicare l’annuncio.', true);
  }
}

function prefillRadius(profile) {
  const radius = profile?.data?.maxTravelKm;
  if (postRadiusEl && Number.isFinite(radius)) postRadiusEl.value = radius;
}

if (postSubmitBtn) {
  postSubmitBtn.addEventListener('click', publishPost);
}

if (postInstrumentsEl) {
  postInstrumentsEl.addEventListener('input', (e) => {
    const val = e.target.value;
    const lastChar = val.slice(-1);
    if (lastChar === ',') {
      const tokens = parseInstruments(val);
      tokens.forEach((t) => selectedInstruments.push(t));
      renderInstrumentChips();
      if (postInstrumentsSuggestionsEl) postInstrumentsSuggestionsEl.hidden = true;
      postInstrumentsEl.value = selectedInstruments.join(', ') + ', ';
      postInstrumentsEl.setSelectionRange(postInstrumentsEl.value.length, postInstrumentsEl.value.length);
      return;
    }
    renderInstrumentSuggestions(val);
  });
  postInstrumentsEl.addEventListener('focus', (e) => {
    if (e.target.value) renderInstrumentSuggestions(e.target.value);
  });
  postInstrumentsEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (postInstrumentsSuggestionsEl) postInstrumentsSuggestionsEl.hidden = true;
    }, 120);
  });
}

if (postVoicesEl) {
  postVoicesEl.addEventListener('focus', () => {
    renderVoiceSuggestions();
  });
  postVoicesEl.addEventListener('click', () => {
    renderVoiceSuggestions();
  });
  postVoicesEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (postVoicesSuggestionsEl) postVoicesSuggestionsEl.hidden = true;
      updateVoiceClearVisibility();
    }, 120);
  });
}

if (postVoicesClearBtn) {
  postVoicesClearBtn.addEventListener('click', () => {
    selectedVoices = [];
    renderVoiceChips();
    if (postVoicesEl) postVoicesEl.focus();
  });
}

if (postTargetCityEl) {
  postTargetCityEl.addEventListener('input', (e) => {
    renderTargetCitySuggestions(e.target.value);
  });
  postTargetCityEl.addEventListener('focus', (e) => {
    renderTargetCitySuggestions(e.target.value);
  });
  postTargetCityEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (postTargetCitySuggestionsEl) postTargetCitySuggestionsEl.hidden = true;
    }, 120);
  });
}

if (postOpenModalBtn) {
  postOpenModalBtn.addEventListener('click', () => openPostModal());
}

if (postCloseModalBtn) {
  postCloseModalBtn.addEventListener('click', () => closePostModal());
}

if (postModal) {
  postModal.addEventListener('click', (e) => {
    if (e.target === postModal || e.target.classList.contains('modal-backdrop')) {
      closePostModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && postModalOpen) {
    closePostModal();
  }
});

document.addEventListener('click', () => closeAllPostMenus());

// Sync initial clear button state
renderVoiceChips();

// Mostra lo stato giusto appena disponibile, evitando flash
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserProfile = null;
    showGuest();
    return;
  }
  try {
    const profile = await loadUserProfile(user.uid);
    currentUserProfile = profile;
    const rawName = profile?.data?.displayName ||
      (user.displayName || '').trim() ||
      (user.email ? user.email.split('@')[0] : 'musicista');
    showUser(rawName);
    prefillRadius(profile);
    loadFeed();
    handleEditFromQuery();
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento profilo home:', err);
    showUser(user.displayName || user.email || 'musicista');
  }
});
