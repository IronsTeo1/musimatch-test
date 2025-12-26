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
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
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
const profileSettingsLink = document.getElementById('profile-settings-link');
const profileLikeToggle = document.getElementById('profile-like-toggle');
const profileFavToggle = document.getElementById('profile-fav-toggle');
const profileFavOpen = document.getElementById('profile-fav-open');
const messageOpenModalBtn = document.getElementById('message-open-modal');
const messageModal = document.getElementById('message-modal');
const messageCloseModalBtn = document.getElementById('message-close-modal');
const messageSendBtn = document.getElementById('message-send-btn');
const messageTextEl = document.getElementById('message-text');
const messageSendMsgEl = document.getElementById('message-send-msg');
const messageModalTitleEl = document.getElementById('message-modal-title');
const mainInstrText = document.getElementById('profile-mainInstrument');
const instrumentsText = document.getElementById('profile-instruments');
const mainInstrField = document.getElementById('profile-mainInstrument-field');
const mainInstrDetailText = document.getElementById('profile-mainInstrument-detail');
const instrumentsField = document.getElementById('profile-instruments-field');
const profileLabelMainInstrument = document.getElementById('profile-label-mainInstrument');
const profileLabelInstruments = document.getElementById('profile-label-instruments');
const profileCard = document.querySelector('.profile-compact');
const levelText = document.getElementById('profile-level');
const locationText = document.getElementById('profile-location');
const maxTravelField = document.getElementById('profile-maxTravel-field');
const maxTravelText = document.getElementById('profile-maxTravel');
const genderText = document.getElementById('profile-gender');
const genderField = document.getElementById('profile-gender-field');
const nationalityText = document.getElementById('profile-nationality');
const nationalityField = document.getElementById('profile-nationality-field');
const bioText = document.getElementById('profile-bio');
const cvText = document.getElementById('profile-cv');
const willingText = document.getElementById('profile-willing');
const willingLabel = document.getElementById('profile-willing-label');
const willingField = document.getElementById('profile-willing-field');
const membersField = document.getElementById('profile-members-field');
const membersText = document.getElementById('profile-members');
const websiteField = document.getElementById('profile-website-field');
const websiteLink = document.getElementById('profile-website');
const foundedField = document.getElementById('profile-founded-field');
const foundedText = document.getElementById('profile-founded');
const ratesTableBodyEl = document.getElementById('rates-table-body');
const profileMetaEl = document.getElementById('profile-meta');
const ratesOpenModalBtn = document.getElementById('rates-open-modal');
const ratesCloseModalBtn = document.getElementById('rates-close-modal');
const ratesModal = document.getElementById('rates-modal');
const profilePostsListEl = document.getElementById('profile-posts-list');
const profilePostsEmptyEl = document.getElementById('profile-posts-empty');
const profilePostsEmptyDefaultText = (profilePostsEmptyEl?.textContent || '').trim() || 'Pubblica un annuncio per vederlo in questa sezione';
const PAGE_SIZE_PROFILE = 10;
const profilePagination = {
  cursor: null,
  done: false,
  loading: false
};
let profileSentinel = null;
let profileObserver = null;
const PROFILE_CACHE_KEY = 'mm:lastProfileDoc';
const MESSAGES_STORAGE_KEY = 'musimatch-messages';
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
const postRadiusRangeEl = document.getElementById('post-radius-range');
const postRadiusEl = document.getElementById('post-radius');
const urlUserId = new URLSearchParams(window.location.search).get('id');
const openLikeParam = new URLSearchParams(window.location.search).get('openLike');
const openMessageParam = new URLSearchParams(window.location.search).get('openMessage');
let dataCache = {};
let viewingOwnProfile = false;
let targetProfileId = null;
let viewerProfileId = null;
let selectedInstruments = [];
let selectedVoices = [];
let postMode = 'seeking';
let cityList = [];
let cityListLoaded = false;
let postModalOpen = false;
let ratesModalOpen = false;
let editingPostId = null;
let editingPostData = null;
let viewerProfile = null;
// Gestisce la chiusura sicura dei modal evitando chiusure involontarie quando si trascina il mouse fuori dal contenuto
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

function formatDateValue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatWebsite(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(href);
    return { href, label: u.host.replace(/^www\./, '') };
  } catch (e) {
    return { href, label: trimmed };
  }
}

function normalizeAvatarUrl(raw) {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  const cleaned = url
    .replace('/avatars/img/', '/avatars/')
    .replace('/assets/img/img/', '/assets/img/')
    .replace('/img/avatars/img/avatars/', '/assets/img/avatars/')
    .replace('/img/avatars/avatars/', '/assets/img/avatars/')
    .replace('//assets', '/assets');
  const pngMatch = url.match(/^(https?:\/\/[^/]+)?\/?(assets\/img\/avatars\/[^?]+)\.png(\?.*)?$/i);
  if (pngMatch) {
    const origin = pngMatch[1] || '';
    const path = pngMatch[2] || '';
    const qs = pngMatch[3] || '';
    return `${origin}/${path}.webp${qs}`;
  }
  return cleaned;
}

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
if (profileSettingsLink) {
  profileSettingsLink.style.display = 'none';
}
if (profileFavOpen) profileFavOpen.style.display = 'none';
if (profileLikeToggle) profileLikeToggle.style.display = 'none';
if (profileFavToggle) profileFavToggle.style.display = 'none';
if (messageOpenModalBtn) {
  messageOpenModalBtn.style.display = 'none';
}

function addBounceOnClick(el, className) {
  if (!el) return;
  el.addEventListener('click', () => {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  });
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

function setMessageSend(text, isError = false) {
  if (!messageSendMsgEl) return;
  messageSendMsgEl.textContent = text || '';
  messageSendMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

let favToastEl = null;
let favToastTimer = null;
function getFavToastEl() {
  if (favToastEl) return favToastEl;
  favToastEl = document.createElement('div');
  favToastEl.id = 'fav-toast';
  favToastEl.className = 'fav-toast';
  favToastEl.setAttribute('role', 'status');
  favToastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(favToastEl);
  return favToastEl;
}

function showFavToast(text) {
  if (!profileFavToggle) return;
  const toast = getFavToastEl();
  toast.textContent = text;
  const rect = profileFavToggle.getBoundingClientRect();
  toast.style.top = `${rect.bottom + 8}px`;
  toast.style.left = `${rect.left + rect.width / 2}px`;
  toast.classList.add('is-visible');
  clearTimeout(favToastTimer);
  favToastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 1500);
}

function setFavButtonState(isFav) {
  if (!profileFavToggle) return;
  const icon = profileFavToggle.querySelector('img');
  if (icon) {
    icon.src = isFav ? 'assets/icons/favorite.svg' : 'assets/icons/favorite_add.svg';
    icon.alt = isFav ? 'Preferito' : 'Aggiungi ai preferiti';
  }
  profileFavToggle.classList.toggle('is-active', !!isFav);
  profileFavToggle.setAttribute('aria-pressed', isFav ? 'true' : 'false');
}

function setLikeButtonState(isLiked) {
  if (!profileLikeToggle) return;
  const icon = profileLikeToggle.querySelector('img');
  if (icon) {
    icon.alt = isLiked ? 'Ti è piaciuto' : 'Metti mi piace';
    icon.style.opacity = isLiked ? '1' : '0.7';
  }
  profileLikeToggle.classList.toggle('is-active', !!isLiked);
  profileLikeToggle.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
}

function playFavBounce(next) {
  if (!profileFavToggle) {
    if (typeof next === 'function') next();
    return;
  }
  profileFavToggle.classList.remove('fav-bounce');
  // force reflow to restart animation
  void profileFavToggle.offsetWidth;
  const done = () => {
    profileFavToggle.classList.remove('fav-bounce');
    if (typeof next === 'function') next();
  };
  profileFavToggle.addEventListener('animationend', done, { once: true });
  setTimeout(done, 400);
  profileFavToggle.classList.add('fav-bounce');
}

function playLikeBounce(next) {
  if (!profileLikeToggle) {
    if (typeof next === 'function') next();
    return;
  }
  profileLikeToggle.classList.remove('like-bounce');
  void profileLikeToggle.offsetWidth;
  const done = () => {
    profileLikeToggle.classList.remove('like-bounce');
    if (typeof next === 'function') next();
  };
  profileLikeToggle.addEventListener('animationend', done, { once: true });
  setTimeout(done, 400);
  profileLikeToggle.classList.add('like-bounce');
}

function setPostMessage(text, isError = false) {
  if (!postMsgEl) return;
  postMsgEl.textContent = text || '';
  postMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function refreshOfferVisibility() {
  const isEnsemble = (dataCache?.userType || dataCache?.role || '').toLowerCase() === 'ensemble';
  document.querySelectorAll('.post-offer-musician').forEach((el) => {
    el.style.display = isEnsemble ? 'none' : '';
  });
  document.querySelectorAll('.post-seeking-advanced').forEach((el) => {
    el.style.display = isEnsemble ? 'none' : '';
  });
  document.querySelectorAll('.post-seeking-ensemble').forEach((el) => {
    el.style.display = isEnsemble ? 'none' : '';
  });
  document.querySelectorAll('.post-tabs').forEach((el) => {
    el.style.display = isEnsemble ? 'none' : '';
  });
  if (postTabOfferingBtn) {
    postTabOfferingBtn.style.display = isEnsemble ? 'none' : '';
    postTabOfferingBtn.setAttribute('aria-disabled', isEnsemble ? 'true' : 'false');
  }
}

function setPostMode(mode = 'seeking') {
  const isEnsemble = (dataCache?.userType || dataCache?.role || '').toLowerCase() === 'ensemble';
  const requested = mode === 'offering' ? 'offering' : 'seeking';
  postMode = isEnsemble ? 'seeking' : requested;
  if (postTabSeekingBtn) postTabSeekingBtn.classList.toggle('active', postMode === 'seeking');
  if (postTabOfferingBtn) postTabOfferingBtn.classList.toggle('active', postMode === 'offering');
  if (postSeekingFields) postSeekingFields.hidden = postMode !== 'seeking';
  if (postOfferingFields) postOfferingFields.hidden = postMode !== 'offering';
  refreshOfferVisibility();
}

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

function ensureProfileSentinel() {
  if (!profileSentinel) {
    profileSentinel = document.createElement('div');
    profileSentinel.className = 'feed-sentinel';
    profileSentinel.setAttribute('aria-hidden', 'true');
  }
  return profileSentinel;
}

function cacheProfileDoc(doc) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(doc));
  } catch (e) {
    // ignore cache write
  }
}

function loadStoredThreads() {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveStoredThreads(threads) {
  try {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(threads || []));
  } catch (e) {
    // ignore
  }
}

function loadMessageStore() {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (Array.isArray(parsed)) return {}; // vecchio formato
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveMessageStore(store) {
  try {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(store || {}));
  } catch (e) {
    // ignore
  }
}

function getUserThreads(store, userId) {
  if (!userId) return [];
  const list = store[userId];
  return Array.isArray(list) ? list : [];
}

function setUserThreads(store, userId, threads) {
  if (!userId) return store;
  store[userId] = threads || [];
  return store;
}

function mergeThreads(base = [], extra = []) {
  const map = new Map();
  (base || []).forEach((t) => {
    if (t && t.id) map.set(t.id, t);
  });
  (extra || []).forEach((t) => {
    if (t && t.id) map.set(t.id, t);
  });
  return Array.from(map.values());
}

function buildThreadId(a, b) {
  return [a, b].filter(Boolean).sort().join('__');
}

function loadCachedProfileDoc() {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function updateProfileEmptyState() {
  if (!profilePostsEmptyEl) return;
  const hasCard = !!profilePostsListEl?.querySelector('.result-card');
  profilePostsEmptyEl.style.display = hasCard ? 'none' : '';
}

function detachProfileObserver() {
  if (profileObserver && profileSentinel) {
    profileObserver.unobserve(profileSentinel);
  }
}

function attachProfileObserver() {
  if (profilePagination.done) {
    detachProfileObserver();
    return;
  }
  if (!profileObserver) {
    profileObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !profilePagination.loading && !profilePagination.done) {
          loadNextProfilePage();
        }
      },
      { rootMargin: '200px 0px' }
    );
  }
  const sentinel = ensureProfileSentinel();
  if (profilePostsListEl && !sentinel.isConnected) {
    profilePostsListEl.appendChild(sentinel);
  } else if (profilePostsListEl) {
    profilePostsListEl.appendChild(sentinel);
  }
  if (profileObserver && sentinel) {
    profileObserver.observe(sentinel);
  }
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
  const safeUrl = normalizeAvatarUrl(url);
  const avatar = document.createElement('div');
  avatar.className = 'post-avatar';
  avatar.title = name || 'Profilo';
  const fallbackChar = ((name || 'M').trim()[0] || 'M').toUpperCase();
  const fallbackSrc = '/assets/img/avatars/avatar-cantante-unknown.webp';

  if (safeUrl) {
    const img = document.createElement('img');
    img.src = safeUrl;
    img.alt = name || 'Avatar';
    img.onerror = () => {
      img.onerror = null;
      img.src = fallbackSrc;
    };
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
  const seen = new Set();
  const queue = [];
  const pushVariant = (val) => {
    if (!val || seen.has(val)) return;
    seen.add(val);
    queue.push(val);
  };
  const baseList = (Array.isArray(urls) ? urls : [urls])
    .map((u) => normalizeAvatarUrl(u))
    .filter(Boolean);
  baseList.forEach((u) => {
    pushVariant(u);
    const clean = u.replace(/^\//, '');
    pushVariant('/' + clean);
    pushVariant(window.location.origin + '/' + clean);
    const noQuery = u.split('?')[0];
    if (noQuery && noQuery !== u) {
      const cleanNoQuery = noQuery.replace(/^\//, '');
      pushVariant(noQuery);
      pushVariant('/' + cleanNoQuery);
      pushVariant(window.location.origin + '/' + cleanNoQuery);
    }
  });
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
    vocalist: 'cantante',
    soprano: 'cantante',
    contralto: 'cantante',
    mezzosoprano: 'cantante',
    tenore: 'cantante',
    baritono: 'cantante',
    basso: 'cantante'
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
  const avatarUrl = normalizeAvatarUrl(data?.avatarUrl);
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
  return urls.length ? urls[0] : null;
}

function updatePageHeading(data, isOwnProfile) {
  if (!pageTitleEl || !pageSubtitleEl) return;
  if (isOwnProfile) {
    pageTitleEl.textContent = 'Il tuo profilo';
    pageSubtitleEl.textContent = 'Visualizza il profilo come lo vedono gli altri musicisti.';
  } else {
    pageTitleEl.textContent = 'Profilo pubblico';
    pageSubtitleEl.textContent = 'Stai consultando la scheda di un altro utente.';
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
    pageTitleEl.textContent = 'Profilo pubblico';
    pageSubtitleEl.textContent = 'Stai consultando la scheda di un altro utente.';
  } else {
    clearLastProfileName();
    pageTitleEl.textContent = 'Il tuo profilo';
    pageSubtitleEl.textContent = 'Visualizza il profilo come lo vedono gli altri musicisti.';
  }
}

async function loadUserDoc(uid) {
  try {
    const usersCol = collection(db, 'users');
    const qCol = query(usersCol, where('authUid', '==', uid));
    const snapshot = await getDocs(qCol);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, data: docSnap.data() };
  } catch (err) {
    err.__context = 'loadUserDoc';
    throw err;
  }
}

async function loadUserDocById(userId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return { id: snap.id, data: snap.data() };
  } catch (err) {
    err.__context = 'loadUserDocById';
    markProfileReady();
    throw err;
  }
}

function markProfileReady() {
  if (profileCard) profileCard.classList.remove('profile-loading');
}

const profilePostMenus = new Set();

function closeAllProfilePostMenus() {
  profilePostMenus.forEach((menu) => {
    menu.hidden = true;
    menu.classList.remove('open');
    menu.style.visibility = '';
    menu.style.position = '';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.right = '';
  });
}

function isFirestoreOfflineError(err) {
  if (!err) return false;
  const code = err.code || err?.error?.code || '';
  const msg = (err.message || '').toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('failed-precondition') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes('err_empty_response') ||
    msg.includes('failed to get document because the client is offline')
  );
}

function positionProfilePostMenu(menu) {
  if (!menu) return;
  menu.hidden = false;
  menu.classList.add('open');
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
    return item;
  };

  addItem('Modifica', () => startEditProfilePost(post));
  const resolvedLabel = post.resolved ? 'Togli il badge "Risolto"' : 'Segna come risolto';
  let resolvedBtn;
  resolvedBtn = addItem(resolvedLabel, () => toggleProfilePostResolved(post, menu, resolvedBtn));
  addItem('Elimina', () => deleteProfilePost(post));

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    closeAllProfilePostMenus();
    if (willOpen) {
      positionProfilePostMenu(menu);
    } else {
      menu.hidden = true;
      menu.classList.remove('open');
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  return wrapper;
}

async function fetchUserPosts(userId, cursor = null) {
  const postsCol = collection(db, 'posts');
  let qBase = query(postsCol, where('authorUserId', '==', userId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE_PROFILE));
  if (cursor) {
    qBase = query(
      postsCol,
      where('authorUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(PAGE_SIZE_PROFILE)
    );
  }
  const snap = await getDocs(qBase);
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor;
  return { posts, lastDoc, size: snap.docs.length };
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

function animateProfileBadgeIn(badge) {
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

function animateProfileBadgeOut(badge, onDone) {
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

function applyProfilePostResolvedState(card, resolved) {
  if (!card) return;
  card.classList.toggle('post-resolved', resolved);
  const existing = card.querySelector('.badge-floating');
  if (resolved) {
    if (!existing) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-success badge-floating';
      badge.textContent = '✓';
      card.insertBefore(badge, card.firstChild || null);
      animateProfileBadgeIn(badge);
    }
  } else if (existing) {
    animateProfileBadgeOut(existing, () => existing.remove());
  }
}

async function toggleProfilePostResolved(post, menuEl, toggleBtn) {
  if (!post?.id || !viewingOwnProfile) return;
  const newResolved = !post.resolved;
  const card = menuEl ? menuEl.closest('.result-card') : null;
  try {
    await updateDoc(doc(db, 'posts', post.id), { resolved: newResolved, updatedAt: serverTimestamp() });
    post.resolved = newResolved;
    applyProfilePostResolvedState(card, newResolved);
    if (toggleBtn) {
      toggleBtn.textContent = newResolved ? 'Togli il badge "Risolto"' : 'Segna come risolto';
    }
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
  }
  renderInstrumentChips();
  renderVoiceChips();
  if (postTargetCityEl) postTargetCityEl.value = post.location?.city || '';
  setPostRadiusInputs(Number.isFinite(post.radiusKm) ? post.radiusKm : null);
  if (postSubmitBtn) postSubmitBtn.textContent = 'Salva modifiche';
  openPostModal();
}

function renderProfilePosts(posts, { reset = false } = {}) {
  if (!profilePostsListEl) return;
  if (reset) {
    profilePostsListEl.innerHTML = '';
    profilePostMenus.clear();
    if (profilePostsEmptyEl) {
      profilePostsListEl.appendChild(profilePostsEmptyEl);
      profilePostsEmptyEl.textContent = profilePostsEmptyDefaultText;
      profilePostsEmptyEl.style.display = 'none';
    }
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
    const kindLabel = formatProfileKind(post.authorProfileData || dataCache || {});
    eyebrow.textContent = kindLabel;
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
    tags.className = 'small';
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

  updateProfileEmptyState();
  if (!profilePagination.done) {
    const sentinel = ensureProfileSentinel();
    if (profilePostsListEl && !sentinel.isConnected) {
      profilePostsListEl.appendChild(sentinel);
    } else if (profilePostsListEl) {
      profilePostsListEl.appendChild(sentinel);
    }
  }
}

async function loadNextProfilePage() {
  if (!profilePostsListEl || !targetProfileId) return;
  if (profilePagination.loading || profilePagination.done) return;
  profilePagination.loading = true;
  try {
    const { posts, lastDoc, size } = await fetchUserPosts(targetProfileId, profilePagination.cursor);
    if (size === 0 && !profilePostsListEl.querySelector('.result-card')) {
      if (profilePostsEmptyEl) profilePostsEmptyEl.style.display = '';
    } else {
      renderProfilePosts(posts, { reset: false });
    }
    updateProfileEmptyState();
    profilePagination.cursor = lastDoc;
    if (size < PAGE_SIZE_PROFILE) {
      profilePagination.done = true;
    }
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento annunci profilo:', err);
    if (profilePostsEmptyEl) {
      profilePostsEmptyEl.textContent = isFirestoreOfflineError(err)
        ? 'Impossibile connettersi a Firestore (emulatore/offline).'
        : 'Errore nel caricamento degli annunci.';
      profilePostsEmptyEl.style.display = '';
    }
  } finally {
    profilePagination.loading = false;
    if (profilePagination.done) {
      detachProfileObserver();
    } else {
      attachProfileObserver();
    }
  }
}

async function loadProfilePosts(userId) {
  if (!profilePostsListEl || !userId) return;
  profilePagination.cursor = null;
  profilePagination.done = false;
  profilePagination.loading = false;
  detachProfileObserver();
  renderProfilePosts([], { reset: true });
  if (profilePostsEmptyEl) {
    profilePostsEmptyEl.textContent = 'Carico gli annunci...';
    profilePostsEmptyEl.style.display = '';
  }
  await loadNextProfilePage();
  attachProfileObserver();
}


function populateForm(data) {
  if (!data) {
    markProfileReady();
    return;
  }
  dataCache = data;
  const isSinger = (data.role || '').toLowerCase() === 'singer';
  const voicePrimary = data.voiceType || '';
  const voiceSecondary = data.voiceTypeSecondary || '';
  const normalizedMainInstrument = normalizeInstrumentName(data.mainInstrument || '');
  const mainInstrValue = isSinger
    ? normalizeInstrumentName(voicePrimary || normalizedMainInstrument)
    : normalizedMainInstrument || normalizeInstrumentName(voicePrimary || '');
  const rawInstruments = Array.isArray(data.instruments) ? data.instruments : [];
  const extraInstruments = rawInstruments.map((i) => normalizeInstrumentName(i)).filter(Boolean);
  if (voiceSecondary) extraInstruments.push(normalizeInstrumentName(voiceSecondary));
  if (isSinger && mainInstrValue) {
    // evita di ripetere la voce principale fra le altre capacità
    const mainSlug = normalizeInstrumentName(mainInstrValue);
    const filtered = extraInstruments.filter((i) => normalizeInstrumentName(i) !== mainSlug);
    extraInstruments.length = 0;
    extraInstruments.push(...filtered);
  }
  if (postRadiusEl && !editingPostId) {
    postRadiusEl.value = Number.isFinite(data.maxTravelKm) ? data.maxTravelKm : '';
  }
  refreshOfferVisibility();
  const isEnsemble = data.userType === 'ensemble';
  if (titleEl) titleEl.textContent = data.displayName || 'Profilo musicista';
  if (mainInstrText) mainInstrText.textContent = mainInstrValue;
  if (mainInstrField) mainInstrField.style.display = mainInstrValue ? '' : 'none';
  if (mainInstrDetailText) mainInstrDetailText.textContent = mainInstrValue || '—';
  if (profileLabelMainInstrument) {
    profileLabelMainInstrument.textContent = isSinger ? 'Registro vocale principale' : 'Strumento principale';
  }
  const instrumentsLabel = isSinger ? 'Altre capacità vocali' : 'Altri strumenti suonati';
  if (profileLabelInstruments) profileLabelInstruments.textContent = instrumentsLabel;
  const uniqueExtras = Array.from(new Set(extraInstruments)).filter(Boolean);
  const extrasText = uniqueExtras.join(', ');
  if (instrumentsField) instrumentsField.style.display = extrasText ? '' : 'none';
  if (instrumentsText) instrumentsText.textContent = extrasText || '';
  const levelMap = {
    professional: 'Professionista',
    amateur: 'Amatore',
    student: 'Studente'
  };
  const levelValue = levelMap[data.activityLevel] || '';
  if (levelText) levelText.textContent = levelValue;
  let locationString = '';
  let ensembleAddressLine = '';
  const loc = data.location || {};
  const city = loc.city || '';
  const province = loc.province ? ` (${loc.province})` : '';
  const addressLine = [loc.street, loc.streetNumber].filter(Boolean).join(' ');
  if (city || province || addressLine) {
    locationString = `${city}${province}`;
    if (isEnsemble) {
      ensembleAddressLine = [addressLine, locationString].filter(Boolean).join(', ');
    }
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
  if (maxTravelField) {
    if (isEnsemble) {
      maxTravelField.style.display = 'none';
    } else {
      maxTravelField.style.display = '';
      if (maxTravelText) {
        const val = Number.isFinite(data.maxTravelKm) ? `${data.maxTravelKm} km` : '—';
        maxTravelText.textContent = val;
      }
    }
  }
  if (profileLabelMainInstrument) {
    profileLabelMainInstrument.textContent = data.role === 'singer' ? 'Estensione vocale principale' : 'Strumento principale';
  }
  if (profileLabelInstruments) {
    profileLabelInstruments.textContent = data.role === 'singer' ? 'Altre capacità vocali' : 'Altri strumenti suonati';
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
  if (isEnsemble) {
    if (willingLabel) willingLabel.textContent = 'Indirizzo sede';
    if (willingText) {
      const val = ensembleAddressLine || locationString || '—';
      willingText.textContent = val;
    }
    if (willingField) willingField.style.display = ensembleAddressLine || locationString ? '' : 'none';
    if (membersField) membersField.style.display = '';
    if (membersText) {
      const rawMembers = data.ensembleMembers ?? data.members;
      const membersVal = parseInt(rawMembers, 10);
      membersText.textContent = Number.isFinite(membersVal) ? membersVal : '—';
    }
    if (foundedField) {
      const formattedDate = formatDateValue(data.foundedDate);
      foundedField.style.display = formattedDate ? '' : 'none';
      if (foundedText && formattedDate) foundedText.textContent = formattedDate;
    }
    if (websiteField) {
      const site = formatWebsite(data.website);
      websiteField.style.display = site ? '' : 'none';
      if (websiteLink && site) {
        websiteLink.href = site.href;
        websiteLink.textContent = site.label;
      }
    }
    if (ratesOpenModalBtn) ratesOpenModalBtn.textContent = 'Compensi';
    const ratesTitleEl = document.getElementById('rates-modal-title');
    if (ratesTitleEl) ratesTitleEl.textContent = 'Compensi';
  } else {
    if (foundedField) foundedField.style.display = 'none';
    if (websiteField) websiteField.style.display = 'none';
    if (willingLabel) willingLabel.textContent = 'Disponibile a unirsi a un gruppo';
    if (willingText) willingText.textContent = data.willingToJoinForFree ? 'Sì' : 'No';
    if (willingField) willingField.style.display = '';
    if (membersField) membersField.style.display = 'none';
    if (ratesOpenModalBtn) ratesOpenModalBtn.textContent = 'Tariffe';
    const ratesTitleEl = document.getElementById('rates-modal-title');
    if (ratesTitleEl) ratesTitleEl.textContent = 'Tariffe';
  }
  renderRates(data.rates || {}, data);
  markProfileReady();
}

function shouldHideRatesForViewer(targetData = {}, rates = {}) {
  if (!viewerProfile) return false;
  if ((viewerProfile.userType || '').toLowerCase() !== 'ensemble') return false;
  const targetType = (targetData.userType || '').toLowerCase();
  const targetRole = (targetData.role || '').toLowerCase();
  const isMusician = targetType === 'musician' || targetRole === 'musician' || targetRole === 'singer';
  if (!isMusician) return false;

  const toValues = (obj = {}) =>
    Object.values(obj)
      .map((v) => (Number.isFinite(v) ? v : parseFloat(v)))
      .filter((n) => Number.isFinite(n));

  const targetVals = toValues(rates);
  const viewerVals = toValues(viewerProfile.rates || {});
  if (!targetVals.length || !viewerVals.length) return false;

  return viewerVals.some((v) => targetVals.some((t) => v > t));
}

function renderRates(rates, targetData = {}) {
  if (!ratesTableBodyEl) return;
  ratesTableBodyEl.innerHTML = '';
  const hideRates = shouldHideRatesForViewer(targetData, rates);
  if (hideRates) {
    ratesTableBodyEl.innerHTML =
      '<tr><td colspan="2" class="muted">Tariffe nascoste.</td></tr>';
    return;
  }
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
  if (postEnsembleEl) postEnsembleEl.value = '';
  selectedInstruments = [];
  selectedVoices = [];
  renderInstrumentChips();
  renderVoiceChips();
  editingPostId = null;
  editingPostData = null;
  if (postSubmitBtn) postSubmitBtn.textContent = 'Pubblica annuncio';
  if (!keepMessage) setPostMessage('');
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
  if (postEnsembleEl) postEnsembleEl.value = '';
  const fallbackRadius = Number.isFinite(dataCache?.maxTravelKm) ? dataCache.maxTravelKm : null;
  setPostRadiusInputs(fallbackRadius);
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
  if (!editingPostId) setPostMode('seeking');
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

function openMessageModal() {
  if (!messageModal) return;
  messageModal.style.display = 'grid';
  messageModal.style.visibility = 'visible';
  messageModal.style.pointerEvents = 'auto';
  messageModal.setAttribute('aria-hidden', 'true');
  requestAnimationFrame(() => {
    messageModal.setAttribute('aria-hidden', 'false');
  });
  if (messageTextEl) {
    messageTextEl.value = '';
    setTimeout(() => messageTextEl.focus({ preventScroll: true }), 50);
  }
  setMessageSend('');
}

function closeMessageModal() {
  if (!messageModal) return;
  messageModal.setAttribute('aria-hidden', 'true');
  messageModal.style.visibility = 'hidden';
  messageModal.style.pointerEvents = 'none';
  setTimeout(() => {
    if (messageModal.getAttribute('aria-hidden') === 'true') {
      messageModal.style.display = 'none';
    }
  }, 260);
  if (messageOpenModalBtn && typeof messageOpenModalBtn.focus === 'function') {
    messageOpenModalBtn.focus({ preventScroll: true });
  }
}

async function refreshFavoriteToggle() {
  if (!profileFavToggle) return;
  profileFavToggle.style.display = 'none';
  if (!auth.currentUser || viewingOwnProfile || !targetProfileId || !viewerProfileId) return;
  try {
    const favRef = doc(db, 'users', viewerProfileId, 'favorites', targetProfileId);
    const snap = await getDoc(favRef);
    const isFav = snap.exists();
    setFavButtonState(isFav);
    profileFavToggle.style.display = '';
  } catch (err) {
    console.error('[MusiMatch] Errore lettura preferito:', err);
  }
}

async function refreshLikeToggle() {
  if (!profileLikeToggle) return;
  profileLikeToggle.style.display = 'none';
  if (!auth.currentUser || viewingOwnProfile || !targetProfileId) return;
  setLikeButtonState(false);
  profileLikeToggle.style.display = '';
}

async function toggleFavorite() {
  if (!auth.currentUser || viewingOwnProfile || !profileFavToggle || !targetProfileId || !viewerProfileId) return;
  try {
    profileFavToggle.disabled = true;
    const favRef = doc(db, 'users', viewerProfileId, 'favorites', targetProfileId);
    const currentSnap = await getDoc(favRef);
    let nextIsFav = false;
    if (currentSnap.exists()) {
      await deleteDoc(favRef);
      nextIsFav = false;
    } else {
      const favType = getProfileTypeTag(dataCache);
      await setDoc(favRef, {
        targetId: targetProfileId,
        targetType: favType,
        targetName: dataCache?.displayName || '',
        createdAt: serverTimestamp()
      });
      nextIsFav = true;
    }
    playFavBounce(() => {
      setFavButtonState(nextIsFav);
      showFavToast(nextIsFav ? 'Profilo aggiunto ai preferiti' : 'Profilo rimosso dai preferiti');
    });
  } catch (err) {
    console.error('[MusiMatch] Errore toggle preferito:', err);
  } finally {
    profileFavToggle.disabled = false;
  }
}

async function toggleLike() {
  if (!auth.currentUser || viewingOwnProfile || !profileLikeToggle || !targetProfileId) return;
  try {
    profileLikeToggle.disabled = true;
    const goToLikes = () => {
      const url = new URL('likes.html', window.location.origin);
      url.searchParams.set('id', targetProfileId);
      window.location.href = url.toString();
    };
    playLikeBounce(() => {
      setLikeButtonState(false);
      setTimeout(goToLikes, 80);
    });
  } catch (err) {
    console.error('[MusiMatch] Errore toggle like:', err);
  } finally {
    profileLikeToggle.disabled = false;
  }
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
    : Number.isFinite(dataCache?.maxTravelKm)
      ? dataCache.maxTravelKm
      : 50;
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

  const previousOffer = editingPostData?.offerDetails || {};
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
    authorUserId: targetProfileId,
    authorName: dataCache?.displayName || '',
    authorType: dataCache?.userType || 'musician',
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

function upsertMessageThread(threads, targetId, targetName) {
  const existingIdx = threads.findIndex((t) => t.id === targetId);
  if (existingIdx >= 0) return { threads, thread: threads[existingIdx] };
  const newThread = {
    id: targetId,
    name: targetName || 'Profilo',
    preview: '',
    updatedAt: new Date().toISOString(),
    messages: []
  };
  const nextThreads = [...threads, newThread];
  return { threads: nextThreads, thread: newThread };
}

async function sendMessageToProfile(text) {
  setMessageSend('');
  if (!targetProfileId) {
    setMessageSend('Profilo non valido.', true);
    return;
  }
  const trimmed = (text || '').trim();
  if (!trimmed) {
    setMessageSend('Scrivi un messaggio prima di inviare.', true);
    return;
  }
  const sender = auth.currentUser;
  if (!sender) {
    setMessageSend('Devi essere loggato per inviare messaggi.', true);
    return;
  }
  const senderUid = sender.uid;
  const senderName =
    viewerProfile?.displayName ||
    viewerProfile?.data?.displayName ||
    sender.displayName ||
    sender.email ||
    'Utente';
  const targetAuthId = dataCache?.authUid || targetProfileId;
  if (!targetAuthId) {
    setMessageSend('Destinatario non valido.', true);
    return;
  }
  const targetName = dataCache?.displayName || titleEl?.textContent || 'Profilo';
  const threadId = buildThreadId(senderUid, targetAuthId);
  const threadRef = doc(db, 'threads', threadId);
  try {
    if (messageSendBtn) messageSendBtn.setAttribute('disabled', 'true');
    const snap = await getDoc(threadRef);
    const baseData = {
      participants: [senderUid, targetAuthId],
      participantNames: {
        [senderUid]: senderName,
        [targetAuthId]: targetName
      }
    };
    if (snap.exists()) {
      await updateDoc(threadRef, {
        ...baseData,
        lastMessage: trimmed,
        lastSenderUid: senderUid,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(threadRef, {
        ...baseData,
        lastMessage: trimmed,
        lastSenderUid: senderUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    await addDoc(collection(threadRef, 'messages'), {
      text: trimmed,
      fromUid: senderUid,
      createdAt: serverTimestamp()
    });
    if (messageTextEl) messageTextEl.value = '';
    setMessageSend('Messaggio inviato.');
    closeMessageModal();
  } catch (err) {
    console.error('[MusiMatch] Errore invio messaggio (profilo):', err);
    setMessageSend('Non è stato possibile inviare il messaggio.', true);
  } finally {
    if (messageSendBtn) messageSendBtn.removeAttribute('disabled');
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
  viewerProfile = null;
  syncCreatePostButton();
  const renderTargetProfile = async () => {
    try {
      const targetDoc = urlUserId
        ? await loadUserDocById(urlUserId)
        : await loadUserDoc(user?.uid || '');
      if (!targetDoc) {
        // Prova cache se offline/emulatore non raggiungibile
        const cached = loadCachedProfileDoc();
        if (cached && cached.data) {
          viewingOwnProfile = !!(cached.data.authUid && cached.data.authUid === user?.uid) || !urlUserId;
          targetProfileId = cached.id;
          dataCache = cached.data;
          syncCreatePostButton();
          updatePageHeading(cached.data, viewingOwnProfile);
          populateForm(cached.data);
          const avatarUrlsCached = resolveAvatarUrls(cached.data);
          setProfileAvatarImage(avatarUrlsCached);
          setMessage('Profilo caricato dalla cache (connessione Firestore non disponibile).', true);
          loadProfilePosts(cached.id);
          return;
        }
        setMessage('Profilo non trovato o Firestore non raggiungibile.', true);
        return;
      }
      const isOwnProfile = !!(targetDoc.data?.authUid && targetDoc.data.authUid === user?.uid) || !urlUserId;
      viewingOwnProfile = isOwnProfile;
      targetProfileId = targetDoc.id;
      viewerProfileId = null;
      cacheProfileDoc(targetDoc);
      syncCreatePostButton();
      updatePageHeading(targetDoc.data, isOwnProfile);
      if (user) {
        if (isOwnProfile) {
          viewerProfile = targetDoc.data;
          viewerProfileId = targetDoc.id;
        } else {
          const viewerDoc = await loadUserDoc(user.uid);
          viewerProfile = viewerDoc?.data || null;
          viewerProfileId = viewerDoc?.id || null;
        }
      }
      if (titleEl) {
        titleEl.style.display = '';
        titleEl.textContent = targetDoc.data?.displayName || 'Profilo musicista';
        if (profileSettingsLink) profileSettingsLink.style.display = viewingOwnProfile ? '' : 'none';
        if (profileFavOpen) profileFavOpen.style.display = viewingOwnProfile ? '' : 'none';
        if (messageOpenModalBtn) messageOpenModalBtn.style.display = viewingOwnProfile ? 'none' : '';
        if (isOwnProfile) {
          clearLastProfileName();
        }
      }
      populateForm(targetDoc.data);
      const avatarUrls = resolveAvatarUrls(targetDoc.data);
      setProfileAvatarImage(avatarUrls);
      loadProfilePosts(targetDoc.id);
      refreshFavoriteToggle();
      refreshLikeToggle();
      if (!isOwnProfile && openLikeParam === '1' && profileLikeToggle) {
        playLikeBounce(() => setTimeout(() => {
          window.location.href = `likes.html?id=${encodeURIComponent(targetDoc.id)}`;
        }, 80));
      }
      if (!isOwnProfile && openMessageParam === '1') {
        openMessageModal();
      }
    } catch (err) {
      console.error('[MusiMatch] Errore caricamento profilo:', err);
      if (isFirestoreOfflineError(err)) {
        const cached = loadCachedProfileDoc();
        if (cached && cached.data) {
          viewingOwnProfile = !!(cached.data.authUid && cached.data.authUid === user?.uid) || !urlUserId;
          targetProfileId = cached.id;
          dataCache = cached.data;
          syncCreatePostButton();
          updatePageHeading(cached.data, viewingOwnProfile);
          populateForm(cached.data);
          const avatarUrlsCached = resolveAvatarUrls(cached.data);
          setProfileAvatarImage(avatarUrlsCached);
          setMessage('Offline/Emulatore non raggiungibile: profilo caricato dalla cache.', true);
          loadProfilePosts(cached.id);
        } else {
          setMessage('Connessione a Firestore non disponibile. Avvia gli emulatori o controlla la rete.', true);
        }
      } else {
        setMessage('Errore nel caricamento del profilo.', true);
      }
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

if (postTabSeekingBtn) {
  postTabSeekingBtn.addEventListener('click', () => setPostMode('seeking'));
}
if (postTabOfferingBtn) {
  postTabOfferingBtn.addEventListener('click', () => setPostMode('offering'));
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

if (postOpenModalBtn) {
  postOpenModalBtn.addEventListener('click', () => openPostModal());
}

if (postCloseModalBtn) {
  postCloseModalBtn.addEventListener('click', () => closePostModal());
}

setupModalSafeClose(postModal, closePostModal);

if (ratesOpenModalBtn) {
  ratesOpenModalBtn.addEventListener('click', openRatesModal);
}

if (ratesCloseModalBtn) {
  ratesCloseModalBtn.addEventListener('click', closeRatesModal);
}

setupModalSafeClose(ratesModal, closeRatesModal);

if (messageOpenModalBtn) {
  messageOpenModalBtn.addEventListener('click', openMessageModal);
}
if (messageCloseModalBtn) {
  messageCloseModalBtn.addEventListener('click', closeMessageModal);
}
if (messageSendBtn) {
  messageSendBtn.addEventListener('click', () => sendMessageToProfile(messageTextEl?.value || ''));
}
if (profileLikeToggle) {
  profileLikeToggle.addEventListener('click', toggleLike);
  profileLikeToggle.addEventListener('click', () => {
    profileLikeToggle.classList.remove('like-bounce');
    void profileLikeToggle.offsetWidth;
    profileLikeToggle.classList.add('like-bounce');
  });
}
if (profileFavToggle) {
  profileFavToggle.addEventListener('click', toggleFavorite);
  profileFavToggle.addEventListener('click', () => {
    profileFavToggle.classList.remove('fav-bounce');
    void profileFavToggle.offsetWidth;
    profileFavToggle.classList.add('fav-bounce');
  });
}
setupModalSafeClose(messageModal, closeMessageModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (postModalOpen) closePostModal();
    if (ratesModalOpen) closeRatesModal();
    if (messageModal && messageModal.getAttribute('aria-hidden') === 'false') closeMessageModal();
  }
});

renderVoiceChips();
setPostMode('seeking');
refreshOfferVisibility();

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
setupModalSafeClose(avatarModal, closeAvatarModal);

document.addEventListener('click', () => closeAllProfilePostMenus());
