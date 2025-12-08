// public/js/settings.js
import { auth } from './firebase-config.js';
import { db } from './firebase-config.js';
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const newEmailEl = document.getElementById('new-email');
const currentPwdEmailEl = document.getElementById('current-pwd-email');
const btnUpdateEmail = document.getElementById('btn-update-email');
const emailMsgEl = document.getElementById('email-message');

const currentPwdPassEl = document.getElementById('current-pwd-pass');
const newPassEl = document.getElementById('new-pass');
const newPassConfirmEl = document.getElementById('new-pass-confirm');
const btnUpdatePass = document.getElementById('btn-update-pass');
const passMsgEl = document.getElementById('pass-message');

const bioEl = document.getElementById('set-bio');
const cvEl = document.getElementById('set-cv');
const btnUpdateBio = document.getElementById('btn-update-bio');
const bioMsgEl = document.getElementById('bio-message');

const rateRehearsal = document.getElementById('set-rate-rehearsal');
const rateConcert = document.getElementById('set-rate-concert');
const rateService = document.getElementById('set-rate-service');
const rateTrumpet = document.getElementById('set-rate-trumpet');
const rateSolo = document.getElementById('set-rate-solo');
const btnUpdateRates = document.getElementById('btn-update-rates');
const ratesMsgEl = document.getElementById('rates-message');

const btnLogout = document.getElementById('btn-logout');

function setEmailMessage(text, isError = false) {
  if (!emailMsgEl) return;
  emailMsgEl.textContent = text || '';
  emailMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function setPassMessage(text, isError = false) {
  if (!passMsgEl) return;
  passMsgEl.textContent = text || '';
  passMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

async function reauth(currentPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Utente non autenticato.');
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  return user;
}

if (btnUpdateEmail) {
  btnUpdateEmail.addEventListener('click', async () => {
    setEmailMessage('');
    try {
      const newEmail = newEmailEl?.value.trim();
      const currentPwd = currentPwdEmailEl?.value || '';
      if (!newEmail) throw new Error('Inserisci la nuova email.');
      if (!currentPwd) throw new Error('Inserisci la password attuale.');

      const user = await reauth(currentPwd);
      await updateEmail(user, newEmail);
      setEmailMessage('Email aggiornata.');
    } catch (err) {
      console.error('[MusiMatch] Errore update email:', err);
      setEmailMessage(err.message || 'Errore nell’aggiornamento email.', true);
    }
  });
}

if (btnUpdatePass) {
  btnUpdatePass.addEventListener('click', async () => {
    setPassMessage('');
    try {
      const currentPwd = currentPwdPassEl?.value || '';
      const newPwd = newPassEl?.value || '';
      const confirm = newPassConfirmEl?.value || '';
      if (!currentPwd) throw new Error('Inserisci la password attuale.');
      if (!newPwd || newPwd.length < 6) throw new Error('La nuova password deve avere almeno 6 caratteri.');
      if (newPwd !== confirm) throw new Error('Le password non coincidono.');

      const user = await reauth(currentPwd);
      await updatePassword(user, newPwd);
      setPassMessage('Password aggiornata.');
    } catch (err) {
      console.error('[MusiMatch] Errore update password:', err);
      setPassMessage(err.message || 'Errore nell’aggiornamento password.', true);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html';
  }
});

async function loadUserDoc(uid) {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('authUid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

function setRatesFields(rates = {}) {
  if (rateRehearsal) rateRehearsal.value = rates.rehearsal ?? '';
  if (rateConcert) rateConcert.value = rates.concert_or_mass ?? '';
  if (rateService) rateService.value = rates.service_civil_religious ?? '';
  if (rateTrumpet) rateTrumpet.value = rates.service_civil_trumpet_full ?? '';
  if (rateSolo) rateSolo.value = rates.solo_performance ?? '';
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const docData = await loadUserDoc(user.uid);
    if (docData?.data) {
      if (bioEl) bioEl.value = docData.data.bio || '';
      if (cvEl) cvEl.value = docData.data.curriculum || '';
      setRatesFields(docData.data.rates || {});
    }
  } catch (err) {
    console.error('[MusiMatch] Errore caricamento dati profilo:', err);
  }
});

function parseRate(el) {
  if (!el || el.value === '') return null;
  const v = parseFloat(el.value);
  return Number.isNaN(v) ? null : v;
}

function setBioMessage(text, isError = false) {
  if (!bioMsgEl) return;
  bioMsgEl.textContent = text || '';
  bioMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function setRatesMessage(text, isError = false) {
  if (!ratesMsgEl) return;
  ratesMsgEl.textContent = text || '';
  ratesMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

if (btnUpdateBio) {
  btnUpdateBio.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    setBioMessage('');
    try {
      const docData = await loadUserDoc(auth.currentUser.uid);
      if (!docData) throw new Error('Profilo non trovato.');
      await updateDoc(doc(db, 'users', docData.id), {
        bio: bioEl?.value.trim() || null,
        curriculum: cvEl?.value.trim() || null,
        updatedAt: serverTimestamp()
      });
      setBioMessage('Bio e curriculum aggiornati.');
    } catch (err) {
      console.error('[MusiMatch] Errore update bio:', err);
      setBioMessage(err.message || 'Errore aggiornamento bio/curriculum.', true);
    }
  });
}

if (btnUpdateRates) {
  btnUpdateRates.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    setRatesMessage('');
    try {
      const docData = await loadUserDoc(auth.currentUser.uid);
      if (!docData) throw new Error('Profilo non trovato.');
      const rates = {};
      const r1 = parseRate(rateRehearsal); if (r1 != null) rates.rehearsal = r1;
      const r2 = parseRate(rateConcert); if (r2 != null) rates.concert_or_mass = r2;
      const r3 = parseRate(rateService); if (r3 != null) rates.service_civil_religious = r3;
      const r4 = parseRate(rateTrumpet); if (r4 != null) rates.service_civil_trumpet_full = r4;
      const r5 = parseRate(rateSolo); if (r5 != null) rates.solo_performance = r5;

      await updateDoc(doc(db, 'users', docData.id), {
        rates: rates,
        updatedAt: serverTimestamp()
      });
      setRatesMessage('Tariffe aggiornate.');
    } catch (err) {
      console.error('[MusiMatch] Errore update tariffe:', err);
      setRatesMessage(err.message || 'Errore aggiornamento tariffe.', true);
    }
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'login.html';
  });
}
