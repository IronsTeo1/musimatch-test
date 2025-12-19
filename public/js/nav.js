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
let initialized = false;

function setNavLabel(link, text) {
  if (!link) return;
  const labelEl = link.querySelector('.nav-label');
  if (labelEl) {
    labelEl.textContent = text;
  } else {
    link.textContent = text;
  }
}

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
    setNavLabel(authLink, 'Login');
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNav, { once: true });
} else {
  initNav();
}
