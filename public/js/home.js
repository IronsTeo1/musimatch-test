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
  startAfter,
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
const postRadiusRangeEl = document.getElementById('post-radius-range');
const postVoicesEl = document.getElementById('post-voices');
const postVoicesSuggestionsEl = document.getElementById('post-voices-suggestions');
const postVoicesClearBtn = document.getElementById('post-voices-clear');
const postTargetCityEl = document.getElementById('post-target-city');
const postTargetCitySuggestionsEl = document.getElementById('post-target-city-suggestions');
const postEnsembleEl = document.getElementById('post-ensemble');
const postTabSeekingBtn = document.getElementById('post-tab-seeking');
const postTabOfferingBtn = document.getElementById('post-tab-offering');
const postSeekingFields = document.getElementById('post-seeking-fields');
const postOfferingFields = document.getElementById('post-offering-fields');
const postOfferTeachInstruments = document.getElementById('post-offer-teach-instruments');
const postOfferInstrumentsEl = document.getElementById('post-offer-instruments');
const postOfferInstrumentsSuggestionsEl = document.getElementById('post-offer-instruments-suggestions');
const postOfferTeachSinging = document.getElementById('post-offer-teach-singing');
const postOfferRateEl = document.getElementById('post-offer-rate');
const postOfferConcertsEl = document.getElementById('post-offer-concerts');
const postOfferServicesEl = document.getElementById('post-offer-services');
const postOfferContextEl = document.getElementById('post-offer-context');
const postOfferRoleEl = document.getElementById('post-offer-role');
const postOfferAccompanimentEl = document.getElementById('post-offer-accompaniment');
const postOfferFormatEl = document.getElementById('post-offer-format');
const postOfferGenreEl = document.getElementById('post-offer-genre');
const postOfferGenreNotesEl = document.getElementById('post-offer-genre-notes');
const postOfferRehearsalEl = document.getElementById('post-offer-rehearsal');
const postOfferSetupEl = document.getElementById('post-offer-setup');
const postOpenModalBtn = document.getElementById('post-open-modal');
const postCloseModalBtn = document.getElementById('post-close-modal');
const postModal = document.getElementById('post-modal');
const postSubmitBtn = document.getElementById('post-submit');
const postMsgEl = document.getElementById('post-message');
const postsFeedEl = document.getElementById('posts-feed');
const postsEmptyEl = document.getElementById('posts-empty');
let postsEmptyDefaultText = postsEmptyEl?.textContent || 'Non ci sono annunci in questo momento. Torna a trovarci più tardi.';
const PAGE_SIZE_HOME = 10;
const homePagination = {
  cursor: null,
  done: false,
  loading: false
};
let homeSentinel = null;
let homeObserver = null;
const HOME_FEED_CACHE_KEY = 'mm:lastHomeFeed';
const filterOpenBtn = document.getElementById('filter-open-modal');
const filterCloseBtn = document.getElementById('filter-close-modal');
const filterModal = document.getElementById('filter-modal');
const filterCityEl = document.getElementById('filter-city');
const filterCitySuggestionsEl = document.getElementById('filter-city-suggestions');
const filterRadiusEl = document.getElementById('filter-radius');
const filterRadiusRangeEl = document.getElementById('filter-radius-range');
const filterApplyBtn = document.getElementById('filter-apply');
const filterResetBtn = document.getElementById('filter-reset');
const filterMsgEl = document.getElementById('filter-message');
const filterUseProfileBtn = document.getElementById('filter-use-profile');
const filterUseGeoBtn = document.getElementById('filter-use-geo');
const filterKeywordEl = document.getElementById('filter-keywords');
const filterInstrumentEl = document.getElementById('filter-instrument');
const filterInstrumentClearBtn = document.getElementById('filter-instrument-clear');
const filterInstrumentSuggestionsEl = document.getElementById('filter-instrument-suggestions');
const filterVoiceEl = document.getElementById('filter-voice');
const filterVoiceClearBtn = document.getElementById('filter-voice-clear');
const filterVoiceSuggestionsEl = document.getElementById('filter-voice-suggestions');
const filterTypeButtons = Array.from(document.querySelectorAll('.filter-type-btn'));
const filterLevelButtons = Array.from(document.querySelectorAll('.filter-level-btn'));
const filterTypeState = { current: null };
const floatingNav = document.querySelector('.floating-nav');
const headerAuthActions = document.querySelector('.header-auth-actions');
let activeFilter = { center: null, radius: null, postType: null, keyword: '', levels: [] };
let awaitingGeo = false;
const DEFAULT_TEST_LOCATION = {
  lat: 45.4642, // Milano
  lng: 9.19,
  city: 'Milano (test)',
  province: 'MI'
};
function isEnsembleProfile() {
  const type = (currentUserProfile?.data?.userType || currentUserProfile?.data?.role || '').toLowerCase();
  return type === 'ensemble';
}
// Gestisce la chiusura dei modal senza trigger involontari quando si trascina il mouse fuori dal contenuto
function setupModalSafeClose(modalEl, closeFn) {
  if (!modalEl || typeof closeFn !== 'function') return;
  let pointerDownOnBackdrop = false;
  const resetPointerState = () => {
    pointerDownOnBackdrop = false;
  };
  modalEl.addEventListener('mousedown', (e) => {
    pointerDownOnBackdrop = e.target === modalEl;
  });
  modalEl.addEventListener('click', (e) => {
    const clickedBackdrop = e.target === modalEl && e.currentTarget === e.target;
    if (clickedBackdrop) {
      closeFn();
    }
    resetPointerState();
  });
  const backdrop = modalEl.querySelector('.modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('mousedown', () => {
      pointerDownOnBackdrop = true;
    });
    backdrop.addEventListener('click', () => {
      if (pointerDownOnBackdrop) closeFn();
      resetPointerState();
    });
  }
}

function setPostRadiusInputs(val) {
  const hasVal = Number.isFinite(val);
  if (postRadiusEl) postRadiusEl.value = hasVal ? val : '';
  if (postRadiusRangeEl) {
    const fallback = postRadiusRangeEl.defaultValue || '50';
    postRadiusRangeEl.value = hasVal ? val : fallback;
  }
}

// Assicura che il modal sia nascosto al load se aria-hidden è true
if (postModal && postModal.getAttribute('aria-hidden') !== 'false') {
  postModal.style.display = 'none';
  postModal.style.visibility = 'hidden';
  postModal.style.pointerEvents = 'none';
}
if (filterModal && filterModal.getAttribute('aria-hidden') !== 'false') {
  filterModal.style.display = 'none';
  filterModal.style.visibility = 'hidden';
  filterModal.style.pointerEvents = 'none';
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
let postMode = 'seeking';
const geocodedCityCache = new Map();

// Cache-busting versione avatar (forza refresh ad ogni load)
const AVATAR_VERSION = Date.now().toString();
const AVATAR_ROOT = '/assets/img/avatars';

function formatProfileKind(data = {}) {
  const kind = (data.profileKind || '').toLowerCase();
  const userType = (data.userType || '').toLowerCase();
  const role = (data.role || '').toLowerCase();
  const ensembleType = (data.ensembleType || '').toLowerCase();
  if (kind === 'band' || ensembleType === 'banda' || ensembleType === 'band') return 'Banda';
  if (kind === 'choir' || ensembleType === 'coro' || ensembleType === 'choir') return 'Coro';
  if (kind === 'orchestra' || ensembleType === 'orchestra') return 'Orchestra';
  if (kind === 'singer' || role === 'singer' || role === 'cantante') return 'Cantante';
  if (userType === 'ensemble' && ensembleType) {
    return ensembleType.charAt(0).toUpperCase() + ensembleType.slice(1);
  }
  return userType === 'ensemble' ? 'Ensemble' : 'Musicista';
}

function profileKindSlug(data = {}) {
  const kind = (data.profileKind || '').toLowerCase();
  const userType = (data.userType || '').toLowerCase();
  const role = (data.role || '').toLowerCase();
  const ensembleType = (data.ensembleType || '').toLowerCase();
  if (kind) return kind;
  if (userType === 'ensemble' && ensembleType) return ensembleType;
  if (role === 'singer' || role === 'cantante') return 'singer';
  if (userType === 'ensemble') return 'ensemble';
  return 'musician';
}
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

function buildAvatarPath({ folder = '', nameParts = [] }) {
  const segments = [AVATAR_ROOT];
  if (folder) segments.push(folder);
  const name = ['avatar', ...nameParts.filter(Boolean)].join('-');
  return `${segments.join('/')}/${name}.webp?v=${AVATAR_VERSION}`;
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
  const photoUrl = normalizeAvatarUrl(data.photoUrl);
  const photoURL = normalizeAvatarUrl(data.photoURL);
  const avatarUrl = normalizeAvatarUrl(data.avatarUrl);
  if (photoUrl) urls.push(photoUrl);
  if (photoURL) urls.push(photoURL);
  if (avatarUrl) urls.push(avatarUrl);

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
  return urls.map((u) => normalizeAvatarUrl(u)).filter(Boolean);
}

function pickPreferredAvatarUrl(data) {
  const urls = resolveAvatarUrls(data);
  return urls.length ? urls[0] : null;
}

function expandAvatarCandidates(list) {
  const out = [];
  const seen = new Set();
  (list || []).forEach((item) => {
    const base = normalizeAvatarUrl(item);
    if (!base) return;
    const variants = [];
    variants.push(base);
    const clean = base.replace(/^\//, '');
    if (!base.startsWith('/')) variants.push('/' + clean);
    variants.push(window.location.origin + '/' + clean);
    const noQuery = base.split('?')[0];
    if (noQuery && noQuery !== base) variants.push(noQuery);
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
  if (headerAuthActions) headerAuthActions.style.display = '';
  setUsername('');
  if (homeTitleEl) homeTitleEl.textContent = 'Benvenuto su MusiMatch';
  if (homeSubtitleEl) homeSubtitleEl.textContent = 'Registrati o accedi per vedere e pubblicare annunci vicino a te.';
  if (floatingNav) floatingNav.style.display = 'none';
}

function showUser(name) {
  const safeName = cleanDisplayName(name) || 'musicista';
  setUsername(safeName);
  if (guestBlock) guestBlock.style.display = 'none';
  if (userBlock) userBlock.style.display = '';
  if (headerAuthActions) headerAuthActions.style.display = 'none';
  if (homeTitleEl) homeTitleEl.textContent = 'Home';
  if (homeSubtitleEl) homeSubtitleEl.textContent = safeName ? `Ciao, ${safeName}. Consulta gli annunci vicino a te.` : 'Ciao!';
  if (floatingNav) floatingNav.style.display = '';
}

function setPostMessage(text, isError = false) {
  if (!postMsgEl) return;
  postMsgEl.textContent = text || '';
  postMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function refreshOfferVisibility() {
  const isEnsemble = isEnsembleProfile();
  const musicianBlocks = document.querySelectorAll('.post-offer-musician');
  const seekingAdvanced = document.querySelectorAll('.post-seeking-advanced');
  const seekingEnsemble = document.querySelectorAll('.post-seeking-ensemble');
  const postTabs = document.querySelectorAll('.post-tabs');
  musicianBlocks.forEach((el) => {
    el.style.display = isEnsemble ? 'none' : '';
  });
  seekingAdvanced.forEach((el) => {
    el.style.display = isEnsemble ? 'none' : '';
  });
  seekingEnsemble.forEach((el) => {
    el.style.display = isEnsemble ? 'none' : '';
  });
  postTabs.forEach((el) => {
    el.style.display = isEnsemble ? 'none' : '';
  });
  if (postTabOfferingBtn) {
    postTabOfferingBtn.style.display = isEnsemble ? 'none' : '';
    postTabOfferingBtn.setAttribute('aria-disabled', isEnsemble ? 'true' : 'false');
  }
}

function setPostMode(mode = 'seeking') {
  const isEnsemble = isEnsembleProfile();
  const requested = mode === 'offering' ? 'offering' : 'seeking';
  postMode = isEnsemble ? 'seeking' : requested;
  if (postTabSeekingBtn) postTabSeekingBtn.classList.toggle('active', postMode === 'seeking');
  if (postTabOfferingBtn) postTabOfferingBtn.classList.toggle('active', postMode === 'offering');
  if (postSeekingFields) postSeekingFields.hidden = postMode !== 'seeking';
  if (postOfferingFields) postOfferingFields.hidden = postMode !== 'offering';
  refreshOfferVisibility();
}

function setFeedEmptyState(visible) {
  if (postsEmptyEl) postsEmptyEl.style.display = visible ? '' : 'none';
}

function setFilterMessage(text, isError = false) {
  if (!filterMsgEl) return;
  filterMsgEl.textContent = text || '';
  filterMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function setFilterType(type) {
  filterTypeButtons.forEach((btn) => {
    const isActive = btn.dataset.type === type;
    btn.classList.toggle('active', isActive);
  });
  filterTypeState.current = type || null;
}

function setFilterClearVisibility() {
  // mantenuto per compatibilità; filtri avanzati rimossi
}

function cacheHomeFeed(posts = []) {
  try {
    localStorage.setItem(HOME_FEED_CACHE_KEY, JSON.stringify(posts));
  } catch (e) {
    // ignore
  }
}

function loadCachedHomeFeed() {
  try {
    const raw = localStorage.getItem(HOME_FEED_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function ensureHomeSentinel() {
  if (!homeSentinel) {
    homeSentinel = document.createElement('div');
    homeSentinel.className = 'feed-sentinel';
    homeSentinel.setAttribute('aria-hidden', 'true');
  }
  return homeSentinel;
}

function updateHomeEmptyState() {
  const hasCard = !!postsFeedEl?.querySelector('.result-card');
  setFeedEmptyState(!hasCard);
}

async function renderFilterCitySuggestions(term) {
  if (!filterCitySuggestionsEl) return;
  filterCitySuggestionsEl.innerHTML = '';
  const query = (term || '').trim();
  if (!query) {
    filterCitySuggestionsEl.hidden = true;
    return;
  }
  const list = await ensureCityListLoaded();
  if (!list || !list.length) {
    filterCitySuggestionsEl.hidden = true;
    return;
  }
  const results = filterCities(list, query, 15);
  if (!results.length) {
    filterCitySuggestionsEl.hidden = true;
    return;
  }
  results.forEach((city) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.textContent = `${city.name}${city.province ? ' (' + city.province + ')' : ''}`;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (filterCityEl) filterCityEl.value = city.name;
      filterCitySuggestionsEl.hidden = true;
    });
    filterCitySuggestionsEl.appendChild(el);
  });
  filterCitySuggestionsEl.hidden = false;
}

function renderFilterInstrumentSuggestions(term) {
  if (!filterInstrumentSuggestionsEl) return;
  filterInstrumentSuggestionsEl.innerHTML = '';
  const fragment = (term || '').split(',').pop().trim();
  if (!fragment) {
    filterInstrumentSuggestionsEl.hidden = true;
    return;
  }
  const pool = [
    'Arpa',
    'Batteria',
    'Basso elettrico',
    'Cantante',
    'Chitarra acustica',
    'Chitarra classica',
    'Chitarra elettrica',
    'Clarinetto',
    'Clarinetto basso',
    'Contrabbasso',
    'Cornetta',
    'Corno francese',
    'Corno inglese',
    'Euphonium',
    'Fagotto',
    'Fisarmonica',
    'Flauto',
    'Flauto dritto',
    'Flicorno',
    'Glockenspiel',
    'Mandolino',
    'Marimba',
    'Oboe',
    'Organo',
    'Ottavino',
    'Percussioni',
    'Pianoforte',
    'Sax baritono',
    'Sax contralto',
    'Sax soprano',
    'Sax tenore',
    'Tastiera',
    'Timpani',
    'Tromba',
    'Trombone',
    'Tuba',
    'Viola',
    'Violino',
    'Violoncello',
    'Xilofono'
  ];
  const normTerm = fragment.toLowerCase();
  const filtered = pool.filter((i) => i.toLowerCase().includes(normTerm)).slice(0, 8);
  if (filtered.length === 0) {
    filterInstrumentSuggestionsEl.hidden = true;
    return;
  }
  filtered.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.textContent = item;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (filterInstrumentEl) {
        const parts = (filterInstrumentEl.value || '').split(',');
        const baseTokens = parts
          .slice(0, -1)
          .map((p) => normalizeInstrumentName(p))
          .filter(Boolean);
        const tokens = [...baseTokens, normalizeInstrumentName(item)].filter(Boolean);
        filterInstrumentEl.value = tokens.length ? tokens.join(', ') + ', ' : '';
      }
      setFilterClearVisibility();
      filterInstrumentSuggestionsEl.hidden = true;
    });
    filterInstrumentSuggestionsEl.appendChild(el);
  });
  filterInstrumentSuggestionsEl.hidden = false;
}

function renderFilterVoiceSuggestions() {
  if (!filterVoiceSuggestionsEl) return;
  filterVoiceSuggestionsEl.innerHTML = '';
  VOICE_OPTIONS.forEach((voice) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.textContent = voice;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (filterVoiceEl) filterVoiceEl.value = voice;
      setFilterClearVisibility();
      filterVoiceSuggestionsEl.hidden = true;
    });
    filterVoiceSuggestionsEl.appendChild(el);
  });
  filterVoiceSuggestionsEl.hidden = false;
}

function renderFilterEnsembleSuggestions() {
  if (!filterEnsembleSuggestionsEl) return;
  filterEnsembleSuggestionsEl.innerHTML = '';
  ENSEMBLE_OPTIONS.forEach((ens) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.textContent = ens;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (filterEnsembleEl) filterEnsembleEl.value = ens;
      setFilterClearVisibility();
      filterEnsembleSuggestionsEl.hidden = true;
    });
    filterEnsembleSuggestionsEl.appendChild(el);
  });
  filterEnsembleSuggestionsEl.hidden = false;
}

function detachHomeObserver() {
  if (homeObserver && homeSentinel) {
    homeObserver.unobserve(homeSentinel);
  }
}

function attachHomeObserver() {
  if (homePagination.done) {
    detachHomeObserver();
    return;
  }
  if (!homeObserver) {
    homeObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !homePagination.loading && !homePagination.done) {
          loadNextHomePage();
        }
      },
      { rootMargin: '200px 0px' }
    );
  }
  const sentinel = ensureHomeSentinel();
  if (postsFeedEl && !sentinel.isConnected) {
    postsFeedEl.appendChild(sentinel);
  }
  if (homeObserver && sentinel) {
    homeObserver.observe(sentinel);
  }
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

function normalizeSearchToken(raw) {
  return (raw || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function keywordTokens(str) {
  return (str || '')
    .split(/[\s,]+/)
    .map((t) => normalizeSearchToken(t))
    .filter(Boolean);
}

function keywordVariantSet(token) {
  const base = normalizeSearchToken(token);
  const variants = new Set();
  const push = (v) => {
    if (v && v.length >= 2) variants.add(v);
  };
  push(base);
  // rimozione di vocali finali (plurali/maschile-femminile)
  push(base.replace(/[aeiou]$/i, ''));
  push(base.replace(/(i|e)$/i, ''));
  // gestisce "che/chi" -> "ch" e "c"
  if (base.endsWith('he') || base.endsWith('hi')) push(base.slice(0, -1));
  if (base.endsWith('che') || base.endsWith('chi')) push(base.slice(0, -2));
  // taglia suffissi comuni
  if (base.endsWith('mente')) push(base.replace(/mente$/, ''));
  if (base.endsWith('zioni')) push(base.replace(/zioni$/, 'zion'));
  if (base.endsWith('zione')) push(base.replace(/zione$/, 'zion'));
  if (base.endsWith('isti') || base.endsWith('iste')) push(base.replace(/ist[ie]$/, 'ista'));
  if (base.endsWith('ali') || base.endsWith('ale')) push(base.replace(/al[ie]$/, 'al'));
  return Array.from(variants);
}

function expandKeywordVariants(tokens) {
  const variants = new Set();
  tokens.forEach((t) => {
    keywordVariantSet(t).forEach((v) => variants.add(v));
  });
  return Array.from(variants);
}

function expandInstrumentVariants(token) {
  const norm = normalizeSearchToken(token);
  const variants = {
    tromba: ['trombe'],
    contralto: ['contralti'],
    fisarmonica: ['fisarmoniche']
  };
  const extra = variants[norm] || [];
  return [norm, ...extra];
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

function normalizeCityKey(name) {
  return (name || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function geocodeCityCached(name) {
  const key = normalizeCityKey(name);
  if (!key) throw new Error('Inserisci una città valida.');
  if (geocodedCityCache.has(key)) return geocodedCityCache.get(key);
  const coords = await geocodeCityName(name);
  geocodedCityCache.set(key, coords);
  return coords;
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

function renderOfferInstrumentSuggestions(term) {
  if (!postOfferInstrumentsSuggestionsEl) return;
  postOfferInstrumentsSuggestionsEl.innerHTML = '';
  const fragment = (term || '').split(',').pop().trim();
  if (!fragment) {
    postOfferInstrumentsSuggestionsEl.hidden = true;
    return;
  }
  const pool = [
    'Arpa', 'Batteria', 'Basso elettrico', 'Chitarra', 'Chitarra acustica', 'Chitarra classica', 'Chitarra elettrica',
    'Clarinetto', 'Contrabbasso', 'Corno francese', 'Euphonium', 'Fagotto', 'Fisarmonica', 'Flauto', 'Glockenspiel',
    'Mandolino', 'Marimba', 'Oboe', 'Organo', 'Percussioni', 'Pianoforte', 'Sax contralto', 'Sax tenore', 'Sax baritono',
    'Sax soprano', 'Tastiera', 'Timpani', 'Tromba', 'Trombone', 'Tuba', 'Viola', 'Violino', 'Violoncello', 'Xilofono'
  ];
  const normTerm = fragment.toLowerCase();
  const filtered = pool.filter((i) => i.toLowerCase().includes(normTerm)).slice(0, 8);
  if (!filtered.length) {
    postOfferInstrumentsSuggestionsEl.hidden = true;
    return;
  }
  filtered.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'autocomplete-item';
    el.textContent = item;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const currentRaw = postOfferInstrumentsEl?.value || '';
      const parts = currentRaw.split(',');
      if (parts.length) parts.pop(); // rimuovi frammento corrente
      const baseTokens = parseInstruments(parts.join(','));
      baseTokens.push(item);
      const unique = Array.from(new Set(baseTokens.filter(Boolean)));
      if (postOfferInstrumentsEl) {
        postOfferInstrumentsEl.value = unique.join(', ') + ', ';
        postOfferInstrumentsEl.focus();
      }
      postOfferInstrumentsSuggestionsEl.hidden = true;
    });
    postOfferInstrumentsSuggestionsEl.appendChild(el);
  });
  postOfferInstrumentsSuggestionsEl.hidden = false;
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

function animateBadgeIn(badge) {
  if (!badge) return;
  badge.classList.remove('badge-anim-out');
  badge.classList.add('badge-anim-in');
  badge.addEventListener(
    'animationend',
    () => {
      badge.classList.remove('badge-anim-in');
    },
    { once: true }
  );
}

function animateBadgeOut(badge, onDone) {
  if (!badge) return;
  badge.classList.remove('badge-anim-in');
  badge.classList.add('badge-anim-out');
  badge.addEventListener(
    'animationend',
    () => {
      if (onDone) onDone();
    },
    { once: true }
  );
}

function applyPostResolvedState(card, resolved) {
  if (!card) return;
  card.classList.toggle('post-resolved', resolved);
  const existing = card.querySelector('.badge-floating');
  if (resolved) {
    if (!existing) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-success badge-floating';
      badge.textContent = '✓';
      card.insertBefore(badge, card.firstChild || null);
      animateBadgeIn(badge);
    }
  } else if (existing) {
    animateBadgeOut(existing, () => existing.remove());
  }
}

async function togglePostResolved(post, menuEl, toggleBtn) {
  if (!post?.id || !isPostOwner(post)) return;
  const newResolved = !post.resolved;
  const card = menuEl ? menuEl.closest('.result-card') : null;
  try {
    await updateDoc(doc(db, 'posts', post.id), { resolved: newResolved, updatedAt: serverTimestamp() });
    post.resolved = newResolved;
    applyPostResolvedState(card, newResolved);
    if (toggleBtn) {
      toggleBtn.textContent = newResolved ? 'Togli il badge "Risolto"' : 'Segna come risolto';
    }
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
  const mode = post.postType || 'seeking';
  setPostMode(mode);
  if (postTextEl) postTextEl.value = post.body || '';
  selectedInstruments = (post.instrumentsWanted || []).filter(Boolean);
  selectedVoices = (post.voicesWanted || []).filter(Boolean);
  if (postEnsembleEl) postEnsembleEl.value = post.ensembleWanted || '';
  if (mode === 'offering') {
    const offer = post.offerDetails || {};
    if (postOfferTeachInstruments) postOfferTeachInstruments.checked = !!offer.teachInstruments;
    if (postOfferInstrumentsEl) postOfferInstrumentsEl.value = Array.isArray(offer.instruments) ? offer.instruments.join(', ') : '';
    if (postOfferTeachSinging) postOfferTeachSinging.checked = !!offer.teachSinging;
    if (postOfferRateEl) postOfferRateEl.value = offer.hourlyRate ?? '';
    if (postOfferConcertsEl) postOfferConcertsEl.checked = !!offer.concerts;
    if (postOfferServicesEl) postOfferServicesEl.checked = !!offer.services;
    if (postOfferContextEl) postOfferContextEl.value = offer.offerContext || '';
    if (postOfferRoleEl) postOfferRoleEl.value = offer.offerRole || '';
    if (postOfferAccompanimentEl) postOfferAccompanimentEl.checked = !!offer.accompaniment;
    if (postOfferFormatEl) postOfferFormatEl.value = offer.format || '';
    if (postOfferGenreEl) postOfferGenreEl.value = offer.genre || '';
    if (postOfferGenreNotesEl) postOfferGenreNotesEl.value = offer.genreNotes || '';
    if (postOfferRehearsalEl) postOfferRehearsalEl.value = offer.rehearsal || '';
    if (postOfferSetupEl) postOfferSetupEl.value = offer.setupNotes || '';
  } else {
    if (postOfferTeachInstruments) postOfferTeachInstruments.checked = false;
    if (postOfferInstrumentsEl) postOfferInstrumentsEl.value = '';
    if (postOfferTeachSinging) postOfferTeachSinging.checked = false;
    if (postOfferRateEl) postOfferRateEl.value = '';
    if (postOfferConcertsEl) postOfferConcertsEl.checked = false;
    if (postOfferServicesEl) postOfferServicesEl.checked = false;
    if (postOfferContextEl) postOfferContextEl.value = '';
    if (postOfferRoleEl) postOfferRoleEl.value = '';
    if (postOfferAccompanimentEl) postOfferAccompanimentEl.checked = false;
    if (postOfferFormatEl) postOfferFormatEl.value = '';
    if (postOfferGenreEl) postOfferGenreEl.value = '';
    if (postOfferGenreNotesEl) postOfferGenreNotesEl.value = '';
    if (postOfferRehearsalEl) postOfferRehearsalEl.value = '';
    if (postOfferSetupEl) postOfferSetupEl.value = '';
  }
  renderInstrumentChips();
  renderVoiceChips();
  if (postTargetCityEl) postTargetCityEl.value = post.location?.city || '';
  setPostRadiusInputs(Number.isFinite(post.radiusKm) ? post.radiusKm : null);
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
  if (!currentEditingPostId) setPostMode('seeking');
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

function openFilterModal() {
  if (!filterModal) return;
  filterModal.style.display = 'grid';
  filterModal.style.visibility = 'visible';
  filterModal.style.pointerEvents = 'auto';
  filterModal.setAttribute('aria-hidden', 'true');
  requestAnimationFrame(() => {
    filterModal.setAttribute('aria-hidden', 'false');
  });
  setFilterMessage('');
  if (filterKeywordEl) filterKeywordEl.value = activeFilter.keyword || '';
  if (filterCityEl && activeFilter.center?.city) {
    filterCityEl.value = activeFilter.center.city;
  }
  if (filterRadiusEl) {
    filterRadiusEl.value = Number.isFinite(activeFilter.radius) ? activeFilter.radius : '';
    if (filterRadiusRangeEl) {
      filterRadiusRangeEl.value = Number.isFinite(activeFilter.radius) ? activeFilter.radius : filterRadiusRangeEl.value;
    }
  }
  filterTypeButtons.forEach((btn) => {
    btn.classList.toggle('active', !!activeFilter.postType && btn.dataset.type === activeFilter.postType);
  });
  filterLevelButtons.forEach((btn) => {
    const level = (btn.dataset.level || '').toLowerCase();
    btn.classList.toggle('active', activeFilter.levels?.includes(level));
  });
}

function closeFilterModal() {
  if (!filterModal) return;
  const active = document.activeElement;
  if (active && filterModal.contains(active) && typeof active.blur === 'function') {
    active.blur();
  }
  if (filterCitySuggestionsEl) filterCitySuggestionsEl.hidden = true;
  filterModal.setAttribute('aria-hidden', 'true');
  filterModal.style.visibility = 'hidden';
  filterModal.style.pointerEvents = 'none';
  setTimeout(() => {
    if (filterModal.getAttribute('aria-hidden') === 'true') {
      filterModal.style.display = 'none';
    }
  }, 260);
  if (filterOpenBtn && typeof filterOpenBtn.focus === 'function') {
    filterOpenBtn.focus({ preventScroll: true });
  }
}

async function applyFilterFromForm() {
  setFilterMessage('');
  let center = activeFilter.center || null;
  const cityTerm = filterCityEl?.value.trim();
  if (cityTerm) {
    if (cityTerm.toLowerCase() === 'posizione attuale' && activeFilter.center) {
      center = activeFilter.center;
    } else {
      const list = await ensureCityListLoaded();
      const match = list && list.length ? findCityByName(list, cityTerm) : null;
      const normalizedInput = normalizeCityKey(cityTerm);
      const centerMatchesInput =
        center &&
        typeof center.lat === 'number' &&
        typeof center.lng === 'number' &&
        normalizeCityKey(center.city) === normalizedInput;
      if (!centerMatchesInput) {
        if (!match) {
          setFilterMessage('Seleziona una città valida dai suggerimenti.', true);
          return;
        }
        try {
          const coords = await geocodeCityCached(match?.name || cityTerm);
          center = { lat: coords.lat, lng: coords.lng, city: match?.name || cityTerm, province: match?.province || '' };
        } catch (err) {
          setFilterMessage(err?.message || 'Città non valida. Seleziona una città dai suggerimenti.', true);
          return;
        }
      }
    }
  }
  let radius = null;
  if (filterRadiusEl && filterRadiusEl.value !== '') {
    const val = parseFloat(filterRadiusEl.value);
    if (Number.isNaN(val) || val < 0) {
      setFilterMessage('Inserisci un raggio valido (km).', true);
      return;
    }
    radius = val;
    if (!center) {
      setFilterMessage('Imposta una città di riferimento o usa i pulsanti rapidi.', true);
      return;
    }
  }
  const selectedTypes = filterTypeButtons
    .filter((btn) => btn.classList.contains('active'))
    .map((btn) => btn.dataset.type);
  const selectedLevels = filterLevelButtons
    .filter((btn) => btn.classList.contains('active'))
    .map((btn) => (btn.dataset.level || '').toLowerCase())
    .filter(Boolean);
  let postType = null;
  if (selectedTypes.length === 1) postType = selectedTypes[0];
  if (selectedTypes.length === 0 && filterTypeState.current) postType = filterTypeState.current;
  activeFilter = {
    center,
    radius,
    keyword: filterKeywordEl?.value.trim() || '',
    postType,
    levels: selectedLevels
  };
  closeFilterModal();
  await loadFeed();
}

async function resetFilter() {
  activeFilter = { center: null, radius: null, keyword: '', postType: null, levels: [] };
  if (filterCityEl) filterCityEl.value = '';
  if (filterRadiusEl) filterRadiusEl.value = '';
  if (filterRadiusRangeEl) filterRadiusRangeEl.value = filterRadiusRangeEl.defaultValue || '0';
  if (filterKeywordEl) filterKeywordEl.value = '';
  filterTypeButtons.forEach((btn) => btn.classList.remove('active'));
  filterLevelButtons.forEach((btn) => btn.classList.remove('active'));
  setFilterClearVisibility();
  setFilterMessage('');
  closeFilterModal();
  await loadFeed();
}

function useProfileCity() {
  setFilterMessage('');
  awaitingGeo = false;
  const loc = currentUserProfile?.data?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    setFilterMessage('Completa la tua città nel profilo prima di usarla qui.', true);
    return;
  }
  activeFilter.center = { lat: loc.lat, lng: loc.lng, city: loc.city || '', province: loc.province || '' };
  if (filterCityEl) filterCityEl.value = loc.city || '';
  setFilterMessage('Città del profilo impostata. Applica per vedere gli annunci.', false);
}

function useGeoLocation() {
  setFilterMessage('Rilevo la posizione...', false);
  awaitingGeo = true;
  if (!navigator.geolocation) {
    setFilterMessage('Geolocalizzazione non supportata dal browser.', true);
    activeFilter.center = { ...DEFAULT_TEST_LOCATION };
    if (filterCityEl) filterCityEl.value = DEFAULT_TEST_LOCATION.city;
    awaitingGeo = false;
    awaitingGeo = false;
    return;
  }
  try {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        activeFilter.center = { lat: latitude, lng: longitude, city: 'Posizione attuale', province: '' };
        if (filterCityEl) filterCityEl.value = 'Posizione attuale';
        setFilterMessage('Posizione impostata. Applica per aggiornare.', false);
        awaitingGeo = false;
      },
      (err) => {
        const friendly =
          err?.code === 1
            ? 'Permesso negato per la posizione.'
            : err?.code === 2
              ? 'Posizione non disponibile al momento.'
              : err?.code === 3
                ? 'Timeout nel recupero posizione.'
                : 'Impossibile ottenere la posizione.';
        const fallback = { ...DEFAULT_TEST_LOCATION };
        activeFilter.center = fallback;
        if (filterCityEl) filterCityEl.value = fallback.city;
        setFilterMessage(`${friendly} — uso posizione di test (${fallback.city}).`, true);
        awaitingGeo = false;
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
    );
  } catch (err) {
    const fallback = { ...DEFAULT_TEST_LOCATION };
    activeFilter.center = fallback;
    if (filterCityEl) filterCityEl.value = fallback.city;
    setFilterMessage('Geolocalizzazione non disponibile, uso posizione di test.', true);
    awaitingGeo = false;
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
    return item;
  };

  addItem('Modifica', () => startEditPost(post));
  const resolvedLabel = post.resolved ? 'Togli il badge "Risolto"' : 'Segna come risolto';
  let resolvedBtn;
  resolvedBtn = addItem(resolvedLabel, () => togglePostResolved(post, menu, resolvedBtn));
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
  eyebrow.textContent = formatProfileKind(post.authorProfileData || baseProfileData || {});
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
  if (post.postType === 'offering') {
    const offer = post.offerDetails || {};
    const parts = [];
    if (offer.offerContext) parts.push(offer.offerContext);
    if (offer.offerRole) parts.push(offer.offerRole);
    if (offer.accompaniment) parts.push('Accompagnamento');
    if (offer.format) parts.push(`Formato: ${offer.format}`);
    if (offer.genre) parts.push(`Repertorio: ${offer.genre}`);
    if (offer.genreNotes) parts.push(offer.genreNotes);
    if (offer.rehearsal) parts.push(`Prove: ${offer.rehearsal}`);
    if (offer.setupNotes) parts.push(offer.setupNotes);
    if (offer.teachInstruments && Array.isArray(offer.instruments) && offer.instruments.length) {
      parts.push(`Lezioni: ${offer.instruments.join(', ')}`);
    } else if (offer.teachInstruments) {
      parts.push('Lezioni di strumento');
    }
    if (offer.teachSinging) parts.push('Lezioni di canto');
    if (offer.concerts) parts.push('Concerti');
    if (offer.services) parts.push('Servizi civili/religiosi');
    if (Number.isFinite(offer.hourlyRate)) parts.push(`Tariffa: ${offer.hourlyRate}€/h`);
    tags.innerHTML = '';
    const badge = document.createElement('span');
    badge.className = 'badge badge-type badge-offering';
    badge.textContent = 'A disposizione';
    tags.appendChild(badge);
    if (parts.length) {
      const txt = document.createElement('span');
      txt.textContent = ' ' + parts.join(' · ');
      tags.appendChild(txt);
    }
  } else {
    const instruments = (post.instrumentsWanted || []).filter(Boolean);
    const voices = (post.voicesWanted || []).filter(Boolean);
    const ensembleWanted = post.ensembleWanted ? `Ensemble: ${post.ensembleWanted}` : null;
    const lookingFor = [...instruments, ...voices, ensembleWanted].filter(Boolean);
    tags.innerHTML = '';
    const badge = document.createElement('span');
    badge.className = 'badge badge-type badge-seeking';
    badge.textContent = 'Cercasi';
    tags.appendChild(badge);
    if (lookingFor.length) {
      const txt = document.createElement('span');
      txt.textContent = ' ' + lookingFor.join(', ');
      tags.appendChild(txt);
    }
  }

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

async function fetchPostsPage(cursor = null) {
  const postsCol = collection(db, 'posts');
  let qBase = query(postsCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE_HOME));
  if (cursor) {
    qBase = query(postsCol, orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE_HOME));
  }
  const snap = await getDocs(qBase);
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor;
  return { posts, lastDoc, size: snap.docs.length };
}

function filterAndRenderPosts(posts, { append = false } = {}) {
  if (!postsFeedEl) return;
  openPostMenus.clear();
  if (!append) {
    resetFeedContainer();
    ensureEmptyElAttached();
    postsEmptyDefaultText = postsEmptyEl?.textContent || postsEmptyDefaultText;
  }
  let rendered = 0;

  const viewerLoc = currentUserProfile?.data?.location;
  const searchCenter = activeFilter.center || viewerLoc;
  const canComputeDistance = searchCenter && typeof searchCenter.lat === 'number' && typeof searchCenter.lng === 'number';
  const viewerInstruments = Array.isArray(currentUserProfile?.data?.instruments) ? currentUserProfile.data.instruments : [];
  const viewerMain = currentUserProfile?.data?.mainInstrument || '';
  const viewerVoice = currentUserProfile?.data?.voiceType || currentUserProfile?.data?.mainInstrument || '';
  const viewerRadius = currentUserProfile?.data?.maxTravelKm || 50;
  const keywordList = expandKeywordVariants(keywordTokens(activeFilter.keyword || ''));
  const filterPostType = (activeFilter.postType || '').toLowerCase();
  const filterLevels = Array.isArray(activeFilter.levels) ? activeFilter.levels : [];

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
    const posterRadius = Number.isFinite(post.radiusKm) ? post.radiusKm : Infinity;
    let displayDistance = null;
    let matchesDistance = true;

    if (canComputeDistance) {
      const center = searchCenter;
      const effectiveRadius = Number.isFinite(activeFilter.radius) ? activeFilter.radius : viewerRadius;
      const baseLat = center?.lat;
      const baseLng = center?.lng;
      if (typeof baseLat === 'number' && typeof baseLng === 'number') {
        const distances = [];
        const locationsToCheck = [
          post.location,
          post.locationAlt,
          post.authorLocation
        ];
        locationsToCheck.forEach((locCandidate) => {
          if (locCandidate && typeof locCandidate.lat === 'number' && typeof locCandidate.lng === 'number') {
            distances.push(haversineDistanceKm(baseLat, baseLng, locCandidate.lat, locCandidate.lng));
          }
        });
        const chosenDist = distances.length ? Math.min(...distances) : null;
        if (chosenDist != null) {
          displayDistance = chosenDist;
          const limit = Number.isFinite(activeFilter.radius)
            ? activeFilter.radius
            : Number.isFinite(effectiveRadius)
              ? Math.min(effectiveRadius, posterRadius)
              : posterRadius;
          matchesDistance = chosenDist <= limit;
        } else {
          matchesDistance = true;
          displayDistance = null;
        }
      } else {
        matchesDistance = true;
        displayDistance = null;
      }
    } else {
      matchesDistance = true;
      displayDistance = null;
    }
    if (!matchesDistance) return;

    // Match strumenti/voci se specificati
    const wantedInstruments = (post.instrumentsWanted || []).filter(Boolean);
    const wantedVoices = (post.voicesWanted || []).filter(Boolean);
    const hasInstrumentCriteria = wantedInstruments.length > 0;
    const hasVoiceCriteria = wantedVoices.length > 0;
    const offerInstruments = post.offerDetails?.instruments || [];
    const offerRole = normalizeSearchToken(post.offerDetails?.offerRole || '');
    const offerContext = normalizeSearchToken(post.offerDetails?.offerContext || '');
    const offerGenre = normalizeSearchToken(post.offerDetails?.genre || '');
    const offerFormat = normalizeSearchToken(post.offerDetails?.format || '');
    const offerNotes = normalizeSearchToken(post.offerDetails?.genreNotes || post.offerDetails?.setupNotes || '');
    const bodyNormalized = normalizeSearchToken(post.body || '');
    const authorName = normalizeSearchToken(post.authorName || '');
    const authorProfile = post.authorProfileData || {};
    const locationStrings = [
      post.location?.city,
      post.location?.province,
      post.authorLocation?.city,
      post.authorLocation?.province
    ]
      .filter(Boolean)
      .map((t) => normalizeSearchToken(t));
    const instrumentsLower = [
      ...wantedInstruments,
      ...offerInstruments,
      ...(post.authorProfileData?.instruments || [])
    ]
      .filter(Boolean)
      .map((i) => normalizeSearchToken(i || ''));
    const voicesLower = wantedVoices.map((v) => normalizeSearchToken(v || ''));
    const authorMainInstrument = normalizeSearchToken(authorProfile.mainInstrument || authorProfile.mainInstrumentSlug || '');
    const authorVoiceTypes = [
      authorProfile.voiceType,
      authorProfile.voiceTypeSecondary
    ]
      .filter(Boolean)
      .map((v) => normalizeSearchToken(v));
    const authorEnsembleType = normalizeSearchToken(authorProfile.ensembleType || authorProfile.profileKind || '');
    if (keywordList.length > 0) {
      const haystack = [
        bodyNormalized,
        offerRole,
        offerContext,
        offerGenre,
        offerFormat,
        offerNotes,
        authorName,
        normalizeSearchToken(post.ensembleWanted || ''),
        normalizeSearchToken(post.postType || '')
      ]
        .concat(locationStrings)
        .concat(instrumentsLower)
        .concat(voicesLower)
        .concat(authorVoiceTypes)
        .concat([
          authorMainInstrument,
          authorEnsembleType,
          normalizeSearchToken(authorProfile.role || authorProfile.userType || '')
        ])
        .join(' ');
      const matchesKeyword = keywordList.some((token) => haystack.includes(token));
      if (!matchesKeyword) return;
    }
    if (filterPostType && (post.postType || 'seeking').toLowerCase() !== filterPostType) {
      return;
    }
    const authorLevel = (post.authorProfileData?.activityLevel || '').toLowerCase();
    if (filterLevels.length && !filterLevels.includes(authorLevel)) {
      return;
    }
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

  const shouldShowEmpty = !append && rendered === 0 && !postsFeedEl.querySelector('.result-card');
  setFeedEmptyState(shouldShowEmpty);
  if (postsEmptyEl && shouldShowEmpty) {
    postsEmptyEl.textContent = postsEmptyDefaultText;
  }
  if (!homePagination.done) {
    const sentinel = ensureHomeSentinel();
    if (postsFeedEl && !sentinel.isConnected) {
      postsFeedEl.appendChild(sentinel);
    } else if (postsFeedEl) {
      postsFeedEl.appendChild(sentinel);
    }
  }
}

async function loadNextHomePage() {
  if (!currentUserProfile || !postsFeedEl) return;
  if (homePagination.loading || homePagination.done) return;
  homePagination.loading = true;
  try {
    const { posts, lastDoc, size } = await fetchPostsPage(homePagination.cursor);
    if (homePagination.cursor === null && posts.length) {
      cacheHomeFeed(posts);
    }
    if (size === 0 && !postsFeedEl.querySelector('.result-card')) {
      setFeedEmptyState(true);
    } else {
      setFeedEmptyState(false);
      filterAndRenderPosts(posts, { append: homePagination.cursor !== null });
    }
    updateHomeEmptyState();
    homePagination.cursor = lastDoc;
    if (size < PAGE_SIZE_HOME) {
      homePagination.done = true;
    }
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento annunci:', err);
    if (homePagination.cursor === null) {
      const cached = loadCachedHomeFeed();
      if (cached && cached.length) {
        filterAndRenderPosts(cached, { append: false });
        setFeedEmptyState(false);
      }
    }
    if (postsFeedEl) {
      const error = document.createElement('p');
      error.className = 'helper-text';
      error.style.color = '#f87171';
      error.style.margin = '0.35rem 0';
      const msg =
        err?.code === 'unavailable' || (err?.message || '').toLowerCase().includes('client is offline')
          ? 'Impossibile connettersi a Firestore (emulatore/offline).'
          : 'Errore nel caricamento degli annunci.';
      error.textContent = msg;
      postsFeedEl.appendChild(error);
    }
  } finally {
    homePagination.loading = false;
    if (homePagination.done) {
      detachHomeObserver();
    } else {
      attachHomeObserver();
    }
  }
}

async function loadFeed() {
  if (!currentUserProfile || !postsFeedEl) return;
  homePagination.cursor = null;
  homePagination.done = false;
  homePagination.loading = false;
  detachHomeObserver();
  resetFeedContainer({ loadingText: 'Carico gli annunci...' });
  setFeedEmptyState(true);
  await loadNextHomePage();
  attachHomeObserver();
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
  const ensembleWanted = (postEnsembleEl?.value || '').trim();
  let radiusVal = null;
  if (postRadiusEl && postRadiusEl.value !== '') {
    const parsed = parseFloat(postRadiusEl.value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setPostMessage('Inserisci un raggio valido (km).', true);
      return;
    }
    radiusVal = parsed;
  }
  const radius = Number.isFinite(radiusVal)
    ? radiusVal
    : Number.isFinite(currentUserProfile.data?.maxTravelKm)
      ? currentUserProfile.data.maxTravelKm
      : 50;
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
  let postLocationAlt = null;

  const targetCity = postTargetCityEl?.value.trim();
  if (targetCity) {
    try {
      const [coords, list] = await Promise.all([
        geocodeCityName(targetCity),
        ensureCityListLoaded()
      ]);
      const match = list && list.length ? findCityByName(list, targetCity) : null;
      postLocationAlt = {
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

  const isEnsemble = (currentUserProfile.data?.userType || currentUserProfile.data?.role) === 'ensemble';
  if (isEnsemble) {
    postMode = 'seeking';
  }

  const previousOffer = currentEditingPostData?.offerDetails || {};
  const hasOfferInputs = !!(postOfferContextEl || postOfferRoleEl);
  let offerDetails = null;
  if (postMode === 'offering') {
    if (hasOfferInputs) {
      offerDetails = {
        ...previousOffer,
        offerContext: postOfferContextEl?.value || '',
        offerRole: (postOfferRoleEl?.value || '').trim()
      };
    } else {
      const hasPrevData = previousOffer && Object.keys(previousOffer).length > 0;
      offerDetails = hasPrevData ? previousOffer : {};
    }
  }

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
      activityLevel: profileData.activityLevel || '',
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
    postType: postMode,
    offerDetails,
    instrumentsWanted: postMode === 'seeking' && instruments.length ? instruments : null,
    voicesWanted: postMode === 'seeking' && voices.length ? voices : null,
    ensembleWanted: postMode === 'seeking' && ensembleWanted ? ensembleWanted : null,
    radiusKm: Number.isFinite(radius) ? radius : 50,
    authorLocation,
    location: postLocation,
    locationAlt: postLocationAlt,
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
    if (postOfferTeachInstruments) postOfferTeachInstruments.checked = false;
    if (postOfferTeachSinging) postOfferTeachSinging.checked = false;
    if (postOfferInstrumentsEl) postOfferInstrumentsEl.value = '';
    if (postOfferRateEl) postOfferRateEl.value = '';
    if (postOfferConcertsEl) postOfferConcertsEl.checked = false;
    if (postOfferServicesEl) postOfferServicesEl.checked = false;
    if (postOfferContextEl) postOfferContextEl.value = '';
    if (postOfferRoleEl) postOfferRoleEl.value = '';
    if (postEnsembleEl) postEnsembleEl.value = '';
    const fallbackRadius = Number.isFinite(currentUserProfile?.data?.maxTravelKm)
      ? currentUserProfile.data.maxTravelKm
      : null;
    setPostRadiusInputs(fallbackRadius);
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
  setPostRadiusInputs(Number.isFinite(radius) ? radius : null);
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

if (postTabSeekingBtn) {
  postTabSeekingBtn.addEventListener('click', () => setPostMode('seeking'));
}
if (postTabOfferingBtn) {
  postTabOfferingBtn.addEventListener('click', () => setPostMode('offering'));
}

if (postVoicesClearBtn) {
  postVoicesClearBtn.addEventListener('click', () => {
    selectedVoices = [];
    renderVoiceChips();
    if (postVoicesEl) postVoicesEl.focus();
  });
}

if (postOfferInstrumentsEl) {
  postOfferInstrumentsEl.addEventListener('input', (e) => {
    if (e.data === ',' && postOfferInstrumentsEl.value.trim().slice(-1) === ',') {
      postOfferInstrumentsEl.value = `${postOfferInstrumentsEl.value} `;
    }
    renderOfferInstrumentSuggestions(e.target.value);
  });
  postOfferInstrumentsEl.addEventListener('focus', (e) => {
    renderOfferInstrumentSuggestions(e.target.value);
  });
  postOfferInstrumentsEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (postOfferInstrumentsSuggestionsEl) postOfferInstrumentsSuggestionsEl.hidden = true;
    }, 120);
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

if (postRadiusRangeEl && postRadiusEl) {
  postRadiusRangeEl.addEventListener('input', (e) => {
    postRadiusEl.value = e.target.value;
  });
  postRadiusEl.addEventListener('input', (e) => {
    if (e.target.value === '') {
      postRadiusRangeEl.value = postRadiusRangeEl.defaultValue || '50';
      return;
    }
    const parsed = parseFloat(e.target.value);
    if (Number.isFinite(parsed)) {
      postRadiusRangeEl.value = parsed;
    }
  });
}

if (filterCityEl) {
  filterCityEl.addEventListener('input', (e) => {
    renderFilterCitySuggestions(e.target.value);
  });
  filterCityEl.addEventListener('focus', (e) => {
    renderFilterCitySuggestions(e.target.value);
  });
  filterCityEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (filterCitySuggestionsEl) filterCitySuggestionsEl.hidden = true;
    }, 120);
  });
}

if (filterInstrumentEl) {
  filterInstrumentEl.addEventListener('input', (e) => {
    const val = e.target.value;
    const lastChar = val.slice(-1);
    if (lastChar === ',') {
      const tokens = parseInstruments(val);
      filterInstrumentEl.value = tokens.length ? tokens.join(', ') + ', ' : '';
      renderFilterInstrumentSuggestions(filterInstrumentEl.value);
      setFilterClearVisibility();
      return;
    }
    renderFilterInstrumentSuggestions(val);
    setFilterClearVisibility();
  });
  filterInstrumentEl.addEventListener('focus', (e) => {
    renderFilterInstrumentSuggestions(e.target.value);
  });
  filterInstrumentEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (filterInstrumentSuggestionsEl) filterInstrumentSuggestionsEl.hidden = true;
    }, 120);
  });
}

if (filterVoiceEl) {
  filterVoiceEl.addEventListener('focus', () => {
    renderFilterVoiceSuggestions();
  });
  filterVoiceEl.addEventListener('click', () => {
    renderFilterVoiceSuggestions();
  });
  filterVoiceEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (filterVoiceSuggestionsEl) filterVoiceSuggestionsEl.hidden = true;
    }, 120);
  });
}

if (postOpenModalBtn) {
  postOpenModalBtn.addEventListener('click', () => openPostModal());
}

if (postCloseModalBtn) {
  postCloseModalBtn.addEventListener('click', () => closePostModal());
}

if (filterOpenBtn) {
  filterOpenBtn.addEventListener('click', () => openFilterModal());
}
if (filterCloseBtn) {
  filterCloseBtn.addEventListener('click', () => closeFilterModal());
}
if (filterApplyBtn) {
  filterApplyBtn.addEventListener('click', () => applyFilterFromForm());
}
if (filterResetBtn) {
  filterResetBtn.addEventListener('click', () => resetFilter());
}
if (filterUseProfileBtn) {
  filterUseProfileBtn.addEventListener('click', () => useProfileCity());
}
if (filterUseGeoBtn) {
  filterUseGeoBtn.addEventListener('click', () => useGeoLocation());
}
filterTypeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    const alreadyActive = btn.classList.contains('active');
    filterTypeButtons.forEach((b) => b.classList.remove('active'));
    if (!alreadyActive) {
      setFilterType(type);
    } else {
      setFilterType(null);
    }
  });
});
filterLevelButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
  });
});
if (filterRadiusRangeEl && filterRadiusEl) {
  const syncRangeToNumber = () => {
    filterRadiusEl.value = filterRadiusRangeEl.value;
  };
  const syncNumberToRange = () => {
    const num = filterRadiusEl.value;
    if (num === '') return;
    const val = Math.max(0, Math.min(200, parseFloat(num)));
    filterRadiusRangeEl.value = Number.isFinite(val) ? val : 0;
  };
  filterRadiusRangeEl.addEventListener('input', syncRangeToNumber);
  filterRadiusEl.addEventListener('input', syncNumberToRange);
}

setupModalSafeClose(postModal, closePostModal);
setupModalSafeClose(filterModal, closeFilterModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (postModalOpen) closePostModal();
    if (filterModal && filterModal.getAttribute('aria-hidden') === 'false') closeFilterModal();
  }
});

document.addEventListener('click', () => closeAllPostMenus());

// Sync initial clear button state
renderVoiceChips();
setPostMode('seeking');

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
    refreshOfferVisibility();
    setPostMode('seeking');
    prefillRadius(profile);
    loadFeed();
    handleEditFromQuery();
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento profilo home:', err);
    showUser(user.displayName || user.email || 'musicista');
  }
});
