// public/js/nav.js
import { auth } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

const authLink = document.getElementById('nav-auth');
const profileLink = document.getElementById('nav-profile');
const settingsLink = document.getElementById('nav-settings');

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
}

if (authLink) {
  authLink.addEventListener('click', async (e) => {
    // login link behaves as navigation only
  });
}

onAuthStateChanged(auth, updateNav);
