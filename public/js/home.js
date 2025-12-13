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

let currentUserProfile = null;
let selectedInstruments = [];
let selectedVoices = [];
let cityList = [];
let cityListLoaded = false;
let postModalOpen = false;
let currentEditingPostId = null;
let currentEditingPostData = null;

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
  if (homeSubtitleEl) homeSubtitleEl.textContent = safeName ? `Ciao, ${safeName}` : 'Ciao!';
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
  if (!currentEditingPostId && postSubmitBtn) postSubmitBtn.textContent = 'Pubblica annuncio';
  postModal.setAttribute('aria-hidden', 'false');
  postModalOpen = true;
  if (postTextEl) {
    setTimeout(() => postTextEl.focus({ preventScroll: true }), 50);
  }
}

function closePostModal() {
  if (!postModal) return;
  postModal.setAttribute('aria-hidden', 'true');
  postModalOpen = false;
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
  const profileId = post?.authorUserId || post?.authorUid || '';
  return profileId ? `profile.html?id=${profileId}` : 'profile.html';
}

function createPostAvatar(name, url, profileUrl) {
  const avatarLink = document.createElement('a');
  avatarLink.href = profileUrl;
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

  const topRow = document.createElement('div');
  topRow.className = 'card-top-row';
  if (post.resolved) {
    const resolved = document.createElement('span');
    resolved.className = 'badge badge-success';
    resolved.textContent = 'Risolto';
    topRow.appendChild(resolved);
  }

  const heading = document.createElement('div');
  heading.className = 'inline-header post-header-row';
  const loc = post.location || {};
  const createdDate = post.createdAt?.toDate ? post.createdAt.toDate() : (post.createdAt instanceof Date ? post.createdAt : null);
  const profileUrl = buildProfileUrl(post);
  const author = document.createElement('div');
  author.className = 'post-author';
  const avatar = createPostAvatar(post.authorName, post.authorPhotoUrl, profileUrl);
  const authorLink = document.createElement('a');
  authorLink.className = 'post-author-text post-author-link';
  authorLink.href = profileUrl;
  authorLink.title = post.authorName || 'Profilo';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.style.margin = '0';
  eyebrow.textContent = post.authorType === 'ensemble' ? 'Ensemble' : 'Musicista';
  const nameEl = document.createElement('span');
  nameEl.className = 'post-author-name';
  nameEl.textContent = post.authorName || 'Profilo';
  const cityLine = document.createElement('p');
  cityLine.className = 'post-author-city muted xsmall';
  cityLine.style.margin = '0';
  cityLine.textContent = `${loc.city || '—'}${loc.province ? ' (' + loc.province + ')' : ''}`;
  authorLink.appendChild(eyebrow);
  authorLink.appendChild(nameEl);
  authorLink.appendChild(cityLine);
  author.appendChild(avatar);
  author.appendChild(authorLink);

  const meta = document.createElement('div');
  meta.className = 'muted small';
  meta.style.marginLeft = 'auto';
  const parts = [];
  if (distanceKm != null) parts.push(formatDistance(distanceKm));
  if (createdDate instanceof Date) parts.push(formatDateTime(createdDate));
  meta.textContent = parts.join(' · ');

  heading.appendChild(author);
  heading.appendChild(meta);
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

  footer.appendChild(tags);

  if (post.resolved) card.appendChild(topRow);
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

  const payload = {
    authorUid: auth.currentUser.uid,
    authorUserId: currentUserProfile.id,
    authorName: currentUserProfile.data?.displayName || '',
    authorType: currentUserProfile.data?.userType || 'musician',
    authorPhotoUrl: currentUserProfile.data?.photoUrl || '',
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
