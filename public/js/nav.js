// public/js/nav.js
import { auth } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

let authLink = null;
let profileLink = null;
let settingsLink = null;
let navLinks = [];
let navWrapper = null;
let navReady = false;
const NAV_STATE_KEY = 'musimatch-nav-state';
const NAV_STATE_ATTR = 'data-nav-state';
const NAV_OFFSET_KEY = 'musimatch-nav-offset-left';
let navDragState = null;
let initialized = false;

function getCachedNavState() {
  let cached = null;
  try {
    cached = sessionStorage.getItem(NAV_STATE_KEY) || localStorage.getItem(NAV_STATE_KEY);
  } catch (e) {
    cached = null;
  }
  if (cached === 'logged-in' || cached === 'logged-out') return cached;
  return null;
}

function revealNav() {
  if (!navWrapper || navReady) return;
  navWrapper.classList.add('nav-ready');
  navReady = true;
}

function persistNavState(user) {
  try {
    const val = user ? 'logged-in' : 'logged-out';
    sessionStorage.setItem(NAV_STATE_KEY, val);
    localStorage.setItem(NAV_STATE_KEY, val);
    document.documentElement.setAttribute(NAV_STATE_ATTR, val);
  } catch (e) {
    // ignore
  }
}

function applyCachedNavState() {
  const cached = getCachedNavState();

  if (!authLink) return;
  const state = cached || 'pending';
  document.documentElement.setAttribute(NAV_STATE_ATTR, state);

  if (state === 'logged-in') {
    authLink.style.display = 'none';
    if (profileLink) profileLink.style.display = 'inline-flex';
    if (settingsLink) settingsLink.style.display = 'inline-flex';
  } else if (state === 'logged-out') {
    authLink.style.display = 'inline-flex';
    if (profileLink) profileLink.style.display = 'none';
    if (settingsLink) settingsLink.style.display = 'none';
  }
}

function markActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'home.html';
  let activeLink = null;
  navLinks.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const target = href.split('/').pop();
    if (!target || target === '#') return;
    if (current === target) {
      link.classList.add('active');
      activeLink = link;
    } else {
      link.classList.remove('active');
    }
  });
}

function updateNav(user) {
  if (!authLink) return;
  if (user) {
    authLink.style.display = 'none';
    if (profileLink) profileLink.style.display = 'inline-flex';
    if (settingsLink) settingsLink.style.display = 'inline-flex';
  } else {
    authLink.style.display = 'inline-flex';
    authLink.textContent = 'Login';
    authLink.dataset.state = 'login';
    authLink.href = 'login.html';
    if (profileLink) profileLink.style.display = 'none';
    if (settingsLink) settingsLink.style.display = 'none';
  }
  persistNavState(user);
  revealNav();
}

if (authLink) {
  authLink.addEventListener('click', async (e) => {
    // login link behaves as navigation only
  });
}

function clampNavLeft(leftPx) {
  if (!navWrapper) return leftPx;
  const max = Math.max(8, window.innerWidth - navWrapper.offsetWidth - 8);
  return Math.min(Math.max(8, leftPx), max);
}

function applyNavLeft(leftPx) {
  const clamped = clampNavLeft(leftPx);
  navWrapper.style.left = `${clamped}px`;
  navWrapper.style.right = 'auto';
  return clamped;
}

function restoreNavOffset() {
  let stored = null;
  try {
    stored = parseFloat(localStorage.getItem(NAV_OFFSET_KEY));
  } catch (e) {
    stored = null;
  }
  if (Number.isFinite(stored)) {
    applyNavLeft(stored);
  }
}

function ensureNavAnchoredLeft() {
  if (!navWrapper) return;
  const rect = navWrapper.getBoundingClientRect();
  applyNavLeft(rect.left);
}

function initNavDrag() {
  if (!navWrapper) return;
  navWrapper.style.touchAction = 'none';
  const onMove = (e) => {
    if (!navDragState) return;
    const delta = e.clientX - navDragState.startX;
    navDragState.lastLeft = applyNavLeft(navDragState.startLeft + delta);
  };

  const stopDrag = () => {
    if (!navDragState) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stopDrag);
    window.removeEventListener('pointercancel', stopDrag);
    navWrapper.classList.remove('nav-dragging');
    if (navDragState.lastLeft != null) {
      try {
        localStorage.setItem(NAV_OFFSET_KEY, String(navDragState.lastLeft));
      } catch (e) {
        // ignore
      }
    }
    navDragState = null;
  };

  navWrapper.addEventListener('pointerdown', (e) => {
    if (!navWrapper) return;
    if (e.button !== 0) return;
    if (e.target.closest('a, button, input, select, textarea')) return;
    e.preventDefault();
    const rect = navWrapper.getBoundingClientRect();
    navDragState = {
      startX: e.clientX,
      startLeft: rect.left,
      lastLeft: rect.left
    };
    navWrapper.classList.add('nav-dragging');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  });
}

// Applica lo stato cache per mostrare il menu subito in navigazione tra pagine
function initNav() {
  if (initialized) return;
  navWrapper = document.querySelector('.floating-nav');
  authLink = document.getElementById('nav-auth');
  profileLink = document.getElementById('nav-profile');
  settingsLink = document.getElementById('nav-settings');
  navLinks = Array.from(document.querySelectorAll('.floating-nav a'));
  initialized = true;

  applyCachedNavState();
  revealNav();
  // Aggiorna con lo stato reale non appena disponibile (resiliente allo storage mancante)
  onAuthStateChanged(auth, (user) => {
    updateNav(user);
  });

  markActiveNav();
  ensureNavAnchoredLeft();
  restoreNavOffset();
  initNavDrag();
  window.addEventListener('resize', () => {
    if (!navWrapper) return;
    const currentLeft = parseFloat(navWrapper.style.left);
    const fallback = navWrapper.getBoundingClientRect().left;
    applyNavLeft(Number.isFinite(currentLeft) ? currentLeft : fallback);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNav, { once: true });
} else {
  initNav();
}
