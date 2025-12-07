// public/js/auth.js
import { app, auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

const form = document.getElementById('auth-form');
const emailEl = document.getElementById('auth-email');
const pwdEl = document.getElementById('auth-password');
const messageEl = document.getElementById('auth-message');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnReset = document.getElementById('btn-reset');

function setMessage(text, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text || '';
  messageEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function setLoading(state) {
  [btnLogin, btnRegister, btnReset].forEach((btn) => {
    if (btn) btn.disabled = state;
  });
}

async function login() {
  if (!emailEl || !pwdEl) return;
  const email = emailEl.value.trim();
  const pwd = pwdEl.value;
  if (!email || !pwd) {
    setMessage('Inserisci email e password.', true);
    return;
  }
  setLoading(true);
  setMessage('Accesso in corso...');
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
    setMessage('Accesso riuscito, reindirizzamento...');
    window.location.href = 'profile.html';
  } catch (err) {
    setMessage(err.message || 'Errore di accesso.', true);
  } finally {
    setLoading(false);
  }
}

async function register() {
  if (!emailEl || !pwdEl) return;
  const email = emailEl.value.trim();
  const pwd = pwdEl.value;
  if (!email || !pwd) {
    setMessage('Inserisci email e password.', true);
    return;
  }
  setLoading(true);
  setMessage('Registrazione in corso...');
  try {
    await createUserWithEmailAndPassword(auth, email, pwd);
    setMessage('Account creato. Ti portiamo al profilo...');
    window.location.href = 'profile.html';
  } catch (err) {
    setMessage(err.message || 'Errore di registrazione.', true);
  } finally {
    setLoading(false);
  }
}

async function resetPwd() {
  if (!emailEl) return;
  const email = emailEl.value.trim();
  if (!email) {
    setMessage('Inserisci la tua email per recuperare la password.', true);
    return;
  }
  setLoading(true);
  setMessage('Invio email di reset...');
  try {
    await sendPasswordResetEmail(auth, email);
    setMessage('Email inviata. Controlla la casella di posta.');
  } catch (err) {
    setMessage(err.message || 'Errore nell\'invio.', true);
  } finally {
    setLoading(false);
  }
}

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    login();
  });
}

if (btnRegister) {
  btnRegister.addEventListener('click', register);
}

if (btnReset) {
  btnReset.addEventListener('click', resetPwd);
}

// Se già autenticato, vai al profilo
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'profile.html';
  }
});
