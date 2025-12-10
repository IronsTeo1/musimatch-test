// public/js/home.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const guestBlock = document.getElementById('home-guest');
const userBlock = document.getElementById('home-user');
const usernameEls = Array.from(document.querySelectorAll('[data-home-username]'));
const homeTitleEl = document.getElementById('home-title');
const homeSubtitleEl = document.getElementById('home-subtitle');
const postTextEl = document.getElementById('post-text');
const postInstrumentsEl = document.getElementById('post-instruments');
const postRadiusEl = document.getElementById('post-radius');
const postSubmitBtn = document.getElementById('post-submit');
const postMsgEl = document.getElementById('post-message');
const postsFeedEl = document.getElementById('posts-feed');
const postsEmptyEl = document.getElementById('posts-empty');
const postRefreshBtn = document.getElementById('post-refresh');

let currentUserProfile = null;

function setUsername(text) {
  usernameEls.forEach((el) => {
    el.textContent = text || '';
  });
}

function showGuest() {
  if (guestBlock) guestBlock.style.display = '';
  if (userBlock) userBlock.style.display = 'none';
  setUsername('');
  if (homeTitleEl) homeTitleEl.textContent = 'Benvenuto';
  if (homeSubtitleEl) homeSubtitleEl.textContent = 'Accedi per gestire il tuo profilo o cercare musicisti.';
}

function showUser(name) {
  setUsername(name || 'musicista');
  if (guestBlock) guestBlock.style.display = 'none';
  if (userBlock) userBlock.style.display = '';
  if (homeTitleEl) homeTitleEl.textContent = 'Home';
  if (homeSubtitleEl) homeSubtitleEl.textContent = name ? `Ciao, ${name}` : 'Ciao!';
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

function renderPostCard(post, distanceKm) {
  if (!postsFeedEl) return;
  const card = document.createElement('article');
  card.className = 'result-card';

  const heading = document.createElement('div');
  heading.className = 'inline-header';
  const title = document.createElement('div');
  title.innerHTML = `
    <p class="eyebrow" style="margin: 0;">${post.authorType === 'ensemble' ? 'Ensemble' : 'Musicista'}</p>
    <h3 style="margin: 0;">${post.authorName || 'Profilo'}</h3>
  `;
  const meta = document.createElement('div');
  meta.className = 'muted small';
  const loc = post.location || {};
  const distText = distanceKm != null ? ` · ${formatDistance(distanceKm)}` : '';
  meta.textContent = `${loc.city || '—'}${loc.province ? ' (' + loc.province + ')' : ''}${distText}`;
  heading.appendChild(title);
  heading.appendChild(meta);

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
  const timeText = formatTimeAgo(post.createdAt?.toDate ? post.createdAt.toDate() : post.createdAt);
  tags.textContent = instruments.length ? `Cerca: ${instruments.join(', ')}` : 'Annuncio generico';

  const actions = document.createElement('div');
  const link = document.createElement('a');
  link.href = `profile.html?id=${post.authorUserId || post.authorUid}`;
  link.className = 'ghost ghost-primary btn-compact';
  link.textContent = 'Apri profilo';
  actions.appendChild(link);

  const timeEl = document.createElement('span');
  timeEl.className = 'muted xsmall';
  timeEl.textContent = timeText ? timeText : '';

  footer.appendChild(tags);
  footer.appendChild(actions);

  card.appendChild(heading);
  card.appendChild(body);
  card.appendChild(timeEl);
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
  postsFeedEl.innerHTML = '';
  let rendered = 0;

  const viewerLoc = currentUserProfile?.data?.location;
  const viewerRadius = currentUserProfile?.data?.maxTravelKm || 50;
  const canComputeDistance = viewerLoc && typeof viewerLoc.lat === 'number' && typeof viewerLoc.lng === 'number';

  posts.forEach((post) => {
    let distance = null;
    let withinRadius = true;
    if (canComputeDistance && post.location && typeof post.location.lat === 'number' && typeof post.location.lng === 'number') {
      distance = haversineDistanceKm(viewerLoc.lat, viewerLoc.lng, post.location.lat, post.location.lng);
      const allowed = Number.isFinite(post.radiusKm) ? post.radiusKm : 50;
      withinRadius = distance <= allowed;
    }
    if (!withinRadius) return;
    renderPostCard(post, distance);
    rendered += 1;
  });

  setFeedEmptyState(rendered === 0);
}

async function loadFeed() {
  if (!currentUserProfile || !postsFeedEl) return;
  setFeedEmptyState(false);
  postsFeedEl.innerHTML = '<p class="muted" style="margin:0;">Carico gli annunci...</p>';
  try {
    const posts = await fetchPosts();
    filterAndRenderPosts(posts);
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento annunci:', err);
    postsFeedEl.innerHTML = '<p class="helper-text" style="color:#f87171; margin:0;">Errore nel caricamento degli annunci.</p>';
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
  const instruments = parseInstruments(postInstrumentsEl?.value || '');
  const radius = postRadiusEl?.value ? parseInt(postRadiusEl.value, 10) : (currentUserProfile.data?.maxTravelKm || 50);
  const loc = currentUserProfile.data?.location || {};
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    setPostMessage('Completa la tua città/sede prima di pubblicare.', true);
    return;
  }

  const payload = {
    authorUid: auth.currentUser.uid,
    authorUserId: currentUserProfile.id,
    authorName: currentUserProfile.data?.displayName || '',
    authorType: currentUserProfile.data?.userType || 'musician',
    body,
    instrumentsWanted: instruments.length ? instruments : null,
    radiusKm: Number.isFinite(radius) ? radius : 50,
    location: {
      city: loc.city || '',
      province: loc.province || '',
      lat: loc.lat,
      lng: loc.lng
    },
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'posts'), payload);
    setPostMessage('Annuncio pubblicato.');
    if (postTextEl) postTextEl.value = '';
    if (postInstrumentsEl) postInstrumentsEl.value = '';
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
if (postRefreshBtn) {
  postRefreshBtn.addEventListener('click', loadFeed);
}

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
    const name = profile?.data?.displayName ||
      (user.displayName || '').trim() ||
      (user.email ? user.email.split('@')[0] : 'musicista');
    showUser(name);
    prefillRadius(profile);
    loadFeed();
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento profilo home:', err);
    showUser(user.displayName || user.email || 'musicista');
  }
});
