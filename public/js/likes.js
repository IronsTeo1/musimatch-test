// public/js/likes.js

import { db } from './firebase-config.js';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const listEl = document.getElementById('likes-list');
const emptyEl = document.getElementById('likes-empty');
const totalEl = document.getElementById('likes-total');
const subtitleEl = document.getElementById('likes-subtitle');
const totalIconEl = document.getElementById('likes-total-icon');

const params = new URLSearchParams(window.location.search);
let targetProfileId = params.get('id') || null;
const referrerProfile =
  document.referrer && document.referrer.includes('profile.html') ? document.referrer : null;

function setTotal(val) {
  if (!totalEl) return;
  totalEl.textContent = `${val} preferiti`;
}

function setSubtitle(name) {
  if (!subtitleEl) return;
  if (name) {
    subtitleEl.textContent = `Profili che hanno messo ${name} tra i preferiti`;
  } else {
    subtitleEl.textContent = 'I profili che ti hanno messo nei preferiti.';
  }
}

function bounceLike(el) {
  if (!el) return;
  el.classList.remove('like-bounce');
  void el.offsetWidth;
  el.classList.add('like-bounce');
  el.addEventListener('animationend', () => el.classList.remove('like-bounce'), { once: true });
}

function markActive(el, isActive) {
  if (!el) return;
  el.classList.toggle('is-active', !!isActive);
}

function renderEmpty(show) {
  if (!emptyEl) return;
  emptyEl.style.display = show ? '' : 'none';
  if (show && emptyEl) emptyEl.textContent = 'Nessun preferito ancora.';
}

function renderLikes(items = []) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!items.length) {
    renderEmpty(true);
    return;
  }
  renderEmpty(false);
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'favorite-row';

    const info = document.createElement('div');
    info.className = 'favorite-info';
    const nameEl = document.createElement('a');
    nameEl.className = 'favorite-name';
    nameEl.href = `profile.html?id=${encodeURIComponent(item.likerId || item.id)}`;
    nameEl.textContent = item.likerName || 'Profilo';
    info.appendChild(nameEl);
    if (item.createdAt) {
      const meta = document.createElement('div');
      meta.className = 'favorite-meta';
      meta.textContent = item.createdAt.toLocaleDateString('it-IT');
      info.appendChild(meta);
    }

    row.appendChild(info);
    listEl.appendChild(row);
  });
}

async function fetchLikerNames(ids = []) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'users', id));
        if (snap.exists()) {
          map.set(id, snap.data()?.displayName || snap.data()?.email || 'Profilo');
        }
      } catch (e) {
        console.error('[likes] Errore fetch nome liker', id, e);
      }
    })
  );
  return map;
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
    console.error('[likes] Errore gestione back al profilo:', err);
  }
}

async function loadLikes() {
  try {
    if (!targetProfileId) {
      console.warn('[likes] Nessun id target specificato.');
      renderLikes([]);
      setTotal(0);
      return;
    }
    const userSnap = await getDoc(doc(db, 'users', targetProfileId));
    if (userSnap.exists()) {
      const displayName = userSnap.data()?.displayName || null;
      setSubtitle(displayName);
      markActive(totalIconEl, true);
      if (totalIconEl) {
        totalIconEl.onclick = () => bounceLike(totalIconEl);
        totalIconEl.style.cursor = 'pointer';
      }
    }
    const snap = await getDocs(
      query(
        collectionGroup(db, 'favorites'),
        where('targetId', '==', targetProfileId),
        orderBy('createdAt', 'desc')
      )
    );
    const itemsRaw = snap.docs.map((d) => {
      const data = d.data() || {};
      const created = data.createdAt?.toDate ? data.createdAt.toDate() : null;
      const likerId = d.ref.parent?.parent?.id || data.ownerId || null;
      return {
        id: likerId || d.id,
        likerId: likerId || d.id,
        likerName: data.likerName || '',
        createdAt: created
      };
    });
    const nameMap = await fetchLikerNames(itemsRaw.map((i) => i.likerId));
    const items = itemsRaw.map((i) => ({
      ...i,
      likerName: nameMap.get(i.likerId) || i.likerName || 'Profilo'
    }));
    setTotal(items.length);
    renderLikes(items);
  } catch (err) {
    console.error('[likes] Errore caricamento preferiti:', err);
    renderLikes([]);
    setTotal(0);
    if (emptyEl) emptyEl.textContent = 'Errore nel caricare i preferiti.';
  }
}

loadLikes();
setupBackFallback();
