// public/js/profile.js
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  where,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {
  loadCityList,
  filterCities,
  findCityByName,
  geocodeCityName
} from './search.js';
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
const ratesTableBodyEl = document.getElementById('rates-table-body');
const profileMetaEl = document.getElementById('profile-meta');
const ratesOpenModalBtn = document.getElementById('rates-open-modal');
const ratesCloseModalBtn = document.getElementById('rates-close-modal');
const ratesModal = document.getElementById('rates-modal');
const profilePostsListEl = document.getElementById('profile-posts-list');
const profilePostsEmptyEl = document.getElementById('profile-posts-empty');
const profilePostsEmptyDefaultText = (profilePostsEmptyEl?.textContent || '').trim() || 'Pubblica un annuncio per vederlo in questa sezione';
const postOpenModalBtn = document.getElementById('post-open-modal');
const postCloseModalBtn = document.getElementById('post-close-modal');
const postModal = document.getElementById('post-modal');
const postSubmitBtn = document.getElementById('post-submit');
const postMsgEl = document.getElementById('post-message');
const postTextEl = document.getElementById('post-text');
const postInstrumentsEl = document.getElementById('post-instruments');
const postInstrumentsSuggestionsEl = document.getElementById('post-instruments-suggestions');
const postVoicesEl = document.getElementById('post-voices');
const postVoicesSuggestionsEl = document.getElementById('post-voices-suggestions');
const postVoicesClearBtn = document.getElementById('post-voices-clear');
const postTargetCityEl = document.getElementById('post-target-city');
const postTargetCitySuggestionsEl = document.getElementById('post-target-city-suggestions');
const urlUserId = new URLSearchParams(window.location.search).get('id');
let dataCache = {};
let viewingOwnProfile = false;
let targetProfileId = null;
let selectedInstruments = [];
let selectedVoices = [];
let cityList = [];
let cityListLoaded = false;
let postModalOpen = false;
let ratesModalOpen = false;
let editingPostId = null;
let editingPostData = null;

const avatarContainer = document.getElementById('profile-avatar');
const avatarModal = document.getElementById('avatar-modal');
const avatarModalImg = document.getElementById('avatar-modal-img');
const avatarModalClose = document.getElementById('avatar-modal-close');
const postModalElement = document.getElementById('post-modal');
const ratesModalElement = document.getElementById('rates-modal');

// Assicura che il modal annuncio del profilo sia chiuso al load
if (postModalElement && postModalElement.getAttribute('aria-hidden') !== 'false') {
  postModalElement.style.display = 'none';
  postModalElement.style.visibility = 'hidden';
  postModalElement.style.pointerEvents = 'none';
}
if (ratesModalElement && ratesModalElement.getAttribute('aria-hidden') !== 'false') {
  ratesModalElement.style.display = 'grid';
  ratesModalElement.style.visibility = 'hidden';
  ratesModalElement.style.pointerEvents = 'none';
}

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

// Bust cache avatar: forza refresh ad ogni load
const AVATAR_VERSION = Date.now().toString();

function setMessage(text, isError = false) {
  if (!msgEl) return;
  msgEl.textContent = text || '';
  msgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function setPostMessage(text, isError = false) {
  if (!postMsgEl) return;
  postMsgEl.textContent = text || '';
  postMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function toggleMetaItem(el, value) {
  if (!el) return false;
  const hasValue = !!value;
  el.textContent = hasValue ? value : '';
  el.classList.toggle('visible', hasValue);
  return hasValue;
}

function refreshMetaSeparators(container) {
  if (!container) return;
  const items = Array.from(container.querySelectorAll('.meta-item')).filter((i) => i.classList.contains('visible'));
  items.forEach((item, idx) => {
    item.classList.toggle('with-sep', idx > 0);
  });
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

function parseInstruments(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((t) => normalizeInstrumentName(t))
    .filter(Boolean);
}

const VOICE_OPTIONS = [
  'Soprano',
  'Mezzosoprano',
  'Contralto',
  'Tenore',
  'Baritono',
  'Basso'
];

function buildPostProfileUrl(post) {
  const cachedId = post?.authorUid ? authUidToUserId.get(post.authorUid) : null;
  const profileId = post?.authorUserId || cachedId || post?.authorUid || targetProfileId || '';
  return profileId ? `profile.html?id=${profileId}` : 'profile.html';
}

const authorPhotoCache = new Map();
const authorProfileCache = new Map();
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
  const directId = post?.authorUserId || targetProfileId;
  const authUid = post?.authorUid;
  try {
    if (directId) {
      const snap = await getDoc(doc(db, 'users', directId));
      if (snap.exists()) userDoc = { id: snap.id, data: snap.data() };
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
    console.error('[MusiMatch] Errore recupero profilo autore (profilo):', err);
  }
  authorProfileCache.set(cacheKey, userDoc);
  return userDoc;
}

async function ensureAuthorPhoto(post) {
  const key = post?.authorUserId || post?.authorUid || post?.id || targetProfileId;
  if (!key) return null;
  if (authorPhotoCache.has(key)) return authorPhotoCache.get(key);
  const userDoc = await resolveAuthorProfile(post);
  let url = null;
  if (userDoc?.data) {
    const fallback = pickPreferredAvatarUrl(userDoc.data);
    url = userDoc.data.photoUrl || userDoc.data.photoURL || userDoc.data.avatarUrl || fallback || null;
  }
  authorPhotoCache.set(key, url);
  return url;
}

async function hydrateAuthor(post, avatarEl, profileLinks = []) {
  const authorName = post?.authorName || 'Profilo';
  const userDoc = await resolveAuthorProfile(post);
  const resolvedId = userDoc?.id || post?.authorUserId || authUidToUserId.get(post?.authorUid) || post?.authorUid || targetProfileId || '';
  if (resolvedId) {
    const newProfileUrl = buildPostProfileUrl({ ...post, authorUserId: resolvedId });
    profileLinks.forEach((link) => {
      if (link) link.href = newProfileUrl;
    });
  }
  const photoCandidates = userDoc?.data ? resolveAvatarUrls(userDoc.data) : [];
  if (photoCandidates.length && avatarEl) setInlineAvatarImage(avatarEl, photoCandidates, authorName);
}

function createPostAvatar(name, url) {
  const avatar = document.createElement('div');
  avatar.className = 'post-avatar';
  avatar.title = name || 'Profilo';
  const fallbackChar = ((name || 'M').trim()[0] || 'M').toUpperCase();

  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = name || 'Avatar';
    avatar.appendChild(img);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'avatar-fallback';
    fallback.textContent = fallbackChar;
    avatar.appendChild(fallback);
  }
  return avatar;
}

function setInlineAvatarImage(linkEl, urls, name) {
  if (!linkEl) return;
  const queue = Array.isArray(urls) ? urls.filter(Boolean) : [urls].filter(Boolean);
  if (queue.length === 0) return;
  const tryNext = () => {
    const nextUrl = queue.shift();
    if (!nextUrl) return;
    const img = new Image();
    img.alt = name || 'Avatar';
    img.onload = () => {
      linkEl.innerHTML = '';
      img.className = '';
      linkEl.appendChild(img);
    };
    img.onerror = tryNext;
    img.src = nextUrl;
  };
  tryNext();
}

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

async function ensureCityListLoaded() {
  if (cityListLoaded && cityList.length > 0) return cityList;
  try {
    cityList = await loadCityList();
    cityListLoaded = true;
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento lista città (profilo):', err);
    cityList = [];
    cityListLoaded = false;
  }
  return cityList;
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

function normalizeGenderSlug(raw) {
  const g = (raw || '').toString().toLowerCase();
  if (g === 'male' || g === 'female' || g === 'non_binary') return g;
  return 'unknown';
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

function hasTrumpetSelected({ mainInstrument, instruments = [] }) {
  const target = 'Tromba';
  return mainInstrument === target || instruments.includes(target);
}

const AVATAR_ROOT = '/assets/img/avatars';

function buildAvatarPath({ folder = '', nameParts = [] }) {
  const segments = [AVATAR_ROOT];
  if (folder) segments.push(folder);
  const name = ['avatar', ...nameParts.filter(Boolean)].join('-');
  return `${segments.join('/')}/${name}.png?v=${AVATAR_VERSION}`;
}

function resolveAvatarUrls(data) {
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
  if (data?.photoUrl) urls.push(data.photoUrl);
  if (data?.photoURL) urls.push(data.photoURL);
  if (data?.avatarUrl) urls.push(data.avatarUrl);

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

function pickPreferredAvatarUrl(data) {
  const urls = resolveAvatarUrls(data || {});
  return urls.length ? urls[0] : null;
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

const profilePostMenus = new Set();

function closeAllProfilePostMenus() {
  profilePostMenus.forEach((menu) => {
    menu.hidden = true;
    menu.style.visibility = '';
    menu.style.position = '';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.right = '';
  });
}

function positionProfilePostMenu(menu) {
  if (!menu) return;
  menu.hidden = false;
  menu.style.visibility = 'visible';
  menu.style.position = '';
  menu.style.left = '';
  menu.style.top = '';
  menu.style.right = '';
  menu.style.zIndex = '20010';
}

function buildProfilePostMenu(post) {
  if (!viewingOwnProfile) return null;
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
  profilePostMenus.add(menu);

  const addItem = (label, handler, disabled = false) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = label;
    item.disabled = disabled;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      handler();
      closeAllProfilePostMenus();
    });
    menu.appendChild(item);
  };

  addItem('Modifica', () => startEditProfilePost(post));
  const resolvedLabel = post.resolved ? 'Togli il badge "Risolto"' : 'Segna come risolto';
  addItem(resolvedLabel, () => toggleProfilePostResolved(post));
  addItem('Elimina', () => deleteProfilePost(post));

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    closeAllProfilePostMenus();
    if (willOpen) {
      positionProfilePostMenu(menu);
    } else {
      menu.hidden = true;
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  return wrapper;
}

async function fetchUserPosts(userId) {
  const postsCol = collection(db, 'posts');
  const q = query(postsCol, where('authorUserId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function markProfilePostResolved(post) {
  if (!post?.id || !viewingOwnProfile) return;
  try {
    await updateDoc(doc(db, 'posts', post.id), { resolved: true, updatedAt: serverTimestamp() });
    loadProfilePosts(targetProfileId);
  } catch (err) {
    console.error('[MusiMatch] Errore nel segnare come risolto (profilo):', err);
    setMessage('Errore nel segnare come risolto.', true);
  }
}

async function toggleProfilePostResolved(post) {
  if (!post?.id || !viewingOwnProfile) return;
  const newResolved = !post.resolved;
  try {
    await updateDoc(doc(db, 'posts', post.id), { resolved: newResolved, updatedAt: serverTimestamp() });
    loadProfilePosts(targetProfileId);
  } catch (err) {
    console.error('[MusiMatch] Errore toggle risolto (profilo):', err);
    setMessage('Errore nel cambiare stato risolto.', true);
  }
}

async function deleteProfilePost(post) {
  if (!post?.id || !viewingOwnProfile) return;
  const ok = window.confirm('Eliminare definitivamente questo annuncio?');
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'posts', post.id));
    loadProfilePosts(targetProfileId);
  } catch (err) {
    console.error('[MusiMatch] Errore eliminazione annuncio (profilo):', err);
    setMessage('Errore nell’eliminazione.', true);
  }
}

function startEditProfilePost(post) {
  if (!post || !viewingOwnProfile) return;
  editingPostId = post.id;
  editingPostData = post;
  if (postTextEl) postTextEl.value = post.body || '';
  selectedInstruments = (post.instrumentsWanted || []).filter(Boolean);
  selectedVoices = (post.voicesWanted || []).filter(Boolean);
  renderInstrumentChips();
  renderVoiceChips();
  if (postTargetCityEl) postTargetCityEl.value = post.location?.city || '';
  if (postSubmitBtn) postSubmitBtn.textContent = 'Salva modifiche';
  openPostModal();
}

function renderProfilePosts(posts) {
  if (!profilePostsListEl) return;
  profilePostsListEl.innerHTML = '';
  profilePostMenus.clear();
  if (profilePostsEmptyEl) {
    profilePostsListEl.appendChild(profilePostsEmptyEl);
    profilePostsEmptyEl.textContent = profilePostsEmptyDefaultText;
    profilePostsEmptyEl.style.display = 'none';
  }
  let rendered = 0;

  posts.forEach((post) => {
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
    const profileUrl = buildPostProfileUrl(post);
    const displayName = post.authorName || 'Profilo';
    const authorWrapper = document.createElement('div');
    authorWrapper.className = 'post-author';

    const avatarLink = document.createElement('a');
    avatarLink.className = 'post-avatar-link';
    avatarLink.href = profileUrl;
    avatarLink.title = displayName;
    avatarLink.setAttribute('aria-label', `Apri il profilo di ${displayName}`);
    const initialAvatarUrl = post.authorPhotoUrl || dataCache?.photoUrl || pickPreferredAvatarUrl(dataCache);
    const avatar = createPostAvatar(displayName, initialAvatarUrl);
    avatarLink.appendChild(avatar);

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
    cityLine.textContent = `${loc.city || '—'}${loc.province ? ' (' + loc.province + ')' : ''}`;
    authorText.appendChild(eyebrow);
    authorText.appendChild(nameLink);
    authorText.appendChild(cityLine);

    authorWrapper.appendChild(avatarLink);
    authorWrapper.appendChild(authorText);

    hydrateAuthor(post, avatar, [nameLink, avatarLink]);

    heading.appendChild(authorWrapper);
    const menu = buildProfilePostMenu(post);
    if (menu) heading.appendChild(menu);

    const body = document.createElement('p');
    body.className = 'muted';
    body.style.margin = '0.35rem 0';
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

    const timeEl = document.createElement('span');
    timeEl.className = 'muted xsmall';
    timeEl.textContent = createdDate ? formatDateTime(createdDate) : '';

    footer.appendChild(tags);
    footer.appendChild(timeEl);

    card.appendChild(heading);
    card.appendChild(body);
    card.appendChild(footer);

    profilePostsListEl.appendChild(card);
    rendered += 1;
  });

  if (profilePostsEmptyEl) profilePostsEmptyEl.style.display = rendered === 0 ? '' : 'none';
}

async function loadProfilePosts(userId) {
  if (!profilePostsListEl || !userId) return;
  if (profilePostsEmptyEl) {
    profilePostsEmptyEl.textContent = 'Carico gli annunci...';
    profilePostsEmptyEl.style.display = '';
  }
  try {
    const posts = await fetchUserPosts(userId);
    renderProfilePosts(posts);
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento annunci profilo:', err);
    if (profilePostsEmptyEl) {
      profilePostsEmptyEl.textContent = 'Errore nel caricamento degli annunci.';
      profilePostsEmptyEl.style.display = '';
    }
  }
}


function populateForm(data) {
  if (!data) return;
  dataCache = data;
  const isEnsemble = data.userType === 'ensemble';
  if (titleEl) titleEl.textContent = data.displayName || 'Profilo musicista';
  const mainInstrValue = data.mainInstrument || '';
  if (mainInstrText) mainInstrText.textContent = mainInstrValue;
  if (instrumentsText) {
    instrumentsText.textContent = '';
  }
  const levelMap = {
    professional: 'Professionista',
    amateur: 'Amatore'
  };
  const levelValue = levelMap[data.activityLevel] || '';
  if (levelText) levelText.textContent = levelValue;
  let locationString = '';
  const loc = data.location || {};
  const city = loc.city || '';
  const province = loc.province ? ` (${loc.province})` : '';
  const addressLine = [loc.street, loc.streetNumber].filter(Boolean).join(' ');
  if (city || province || addressLine) {
    locationString = isEnsemble && addressLine
      ? `${addressLine}, ${city}${province}`
      : `${city}${province}`;
  }
  if (locationText) locationText.textContent = locationString;
  if (profileMetaEl) {
    const vis = [
      toggleMetaItem(mainInstrText, mainInstrValue),
      toggleMetaItem(levelText, levelValue),
      toggleMetaItem(locationText, locationString)
    ];
    refreshMetaSeparators(profileMetaEl);
    profileMetaEl.style.display = vis.some(Boolean) ? 'flex' : 'none';
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
  if (!ratesTableBodyEl) return;
  ratesTableBodyEl.innerHTML = '';
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
    ratesTableBodyEl.innerHTML = '<tr><td colspan="2" class="muted">Tariffe non impostate.</td></tr>';
    return;
  }
  entries.forEach((r) => {
    if (!r.value && r.value !== 0) return;
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = r.label;
    const valueCell = document.createElement('td');
    valueCell.className = 'text-right';
    valueCell.textContent = `${r.value}€`;
    row.appendChild(labelCell);
    row.appendChild(valueCell);
    ratesTableBodyEl.appendChild(row);
  });
}

function canPublishFromProfile() {
  return viewingOwnProfile && !!auth.currentUser && !!targetProfileId;
}

function syncCreatePostButton() {
  if (!postOpenModalBtn) return;
  const visible = canPublishFromProfile();
  postOpenModalBtn.style.display = visible ? '' : 'none';
  postOpenModalBtn.disabled = !visible;
}

function resetPostForm({ keepMessage = false } = {}) {
  if (postTextEl) postTextEl.value = '';
  if (postInstrumentsEl) postInstrumentsEl.value = '';
  if (postTargetCityEl) postTargetCityEl.value = '';
  if (postTargetCitySuggestionsEl) postTargetCitySuggestionsEl.hidden = true;
  if (postInstrumentsSuggestionsEl) postInstrumentsSuggestionsEl.hidden = true;
  if (postVoicesSuggestionsEl) postVoicesSuggestionsEl.hidden = true;
  selectedInstruments = [];
  selectedVoices = [];
  renderInstrumentChips();
  renderVoiceChips();
  editingPostId = null;
  editingPostData = null;
  if (postSubmitBtn) postSubmitBtn.textContent = 'Pubblica annuncio';
  if (!keepMessage) setPostMessage('');
}

function openPostModal() {
  if (!postModal || !canPublishFromProfile()) return;
  postModal.style.display = 'grid';
  postModal.style.visibility = 'visible';
  postModal.style.pointerEvents = 'auto';
  // reset stato chiuso e poi trigghiamo l'animazione nel frame successivo
  postModal.setAttribute('aria-hidden', 'true');
  requestAnimationFrame(() => {
    postModal.setAttribute('aria-hidden', 'false');
  });
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

function openRatesModal() {
  if (!ratesModal) return;
  ratesModal.style.display = 'grid';
  ratesModal.style.visibility = 'visible';
  ratesModal.style.pointerEvents = 'auto';
  ratesModal.setAttribute('aria-hidden', 'true');
  requestAnimationFrame(() => {
    ratesModal.setAttribute('aria-hidden', 'false');
    ratesModal.classList.add('open');
  });
  ratesModalOpen = true;
}

function closeRatesModal() {
  if (!ratesModal) return;
  ratesModal.setAttribute('aria-hidden', 'true');
  ratesModal.classList.remove('open');
  ratesModalOpen = false;
  ratesModal.style.visibility = 'hidden';
  ratesModal.style.pointerEvents = 'none';
  setTimeout(() => {
    if (ratesModal.getAttribute('aria-hidden') === 'true') {
      ratesModal.style.display = 'none';
    }
  }, 260);
}

async function publishProfilePost() {
  setPostMessage('');
  if (!canPublishFromProfile()) {
    setPostMessage('Devi essere loggato sul tuo profilo per pubblicare.', true);
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
  const radius = dataCache?.maxTravelKm;
  const loc = dataCache?.location || {};
  if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    setPostMessage('Completa la tua città/sede prima di pubblicare.', true);
    return;
  }
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
      console.error('[MusiMatch] Errore geocoding città annuncio (profilo):', err);
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
  const profileData = dataCache || {};
  const authorAvatarUrl =
    profileData.photoUrl ||
    profileData.photoURL ||
    profileData.avatarUrl ||
    pickPreferredAvatarUrl(profileData) ||
    '';

  const payload = {
    authorUid: auth.currentUser.uid,
    authorUserId: targetProfileId,
    authorName: dataCache?.displayName || '',
    authorType: dataCache?.userType || 'musician',
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
    resolved: false
  };

  try {
    if (editingPostId) {
      const { createdAt: _omit, ...updateData } = payload;
      await updateDoc(doc(db, 'posts', editingPostId), {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      setPostMessage('Annuncio aggiornato.');
    } else {
      await addDoc(collection(db, 'posts'), {
        ...payload,
        createdAt: serverTimestamp()
      });
      setPostMessage('Annuncio pubblicato.');
    }
    resetPostForm({ keepMessage: true });
    closePostModal();
    loadProfilePosts(targetProfileId);
  } catch (err) {
    console.error('[MusiMatch] Errore pubblicazione annuncio (profilo):', err);
    setPostMessage('Errore nel pubblicare l’annuncio.', true);
  }
}

function setProfileAvatarImage(urls = []) {
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
  viewingOwnProfile = false;
  targetProfileId = null;
  dataCache = {};
  syncCreatePostButton();
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
      viewingOwnProfile = isOwnProfile;
      targetProfileId = targetDoc.id;
      syncCreatePostButton();
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
      setProfileAvatarImage(avatarUrls);
      loadProfilePosts(targetDoc.id);
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

if (postSubmitBtn) {
  postSubmitBtn.addEventListener('click', publishProfilePost);
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

if (ratesOpenModalBtn) {
  ratesOpenModalBtn.addEventListener('click', openRatesModal);
}

if (ratesCloseModalBtn) {
  ratesCloseModalBtn.addEventListener('click', closeRatesModal);
}

if (ratesModal) {
  ratesModal.addEventListener('click', (e) => {
    if (e.target === ratesModal || e.target.classList.contains('modal-backdrop')) {
      closeRatesModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (postModalOpen) closePostModal();
    if (ratesModalOpen) closeRatesModal();
  }
});

renderVoiceChips();

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

document.addEventListener('click', () => closeAllProfilePostMenus());
