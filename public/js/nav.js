// public/js/nav.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

let profileLink = null;
let messagesLink = null;
let navLinks = [];
let navWrapper = null;
let navReady = false;
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

function revealNav() {
  if (!navWrapper || navReady) return;
  navWrapper.classList.add('nav-ready');
  navReady = true;
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

// Applica lo stato cache per mostrare il menu subito in navigazione tra pagine
function initNav() {
  if (initialized) return;
  navWrapper = document.querySelector('.floating-nav');
  profileLink = document.getElementById('nav-profile');
  messagesLink = document.getElementById('nav-messages');
  navLinks = Array.from(document.querySelectorAll('.floating-nav a'));
  initialized = true;

  revealNav();
  // Aggiorna con lo stato reale non appena disponibile (resiliente allo storage mancante)
  onAuthStateChanged(auth, () => {
    revealNav();
  });

  markActiveNav();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNav, { once: true });
} else {
  initNav();
}
