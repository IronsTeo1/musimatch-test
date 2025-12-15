// public/js/settings.js
import { auth, db, storage } from './firebase-config.js';
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
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js';
import {
  loadCityList,
  filterCities,
  findCityByName,
  geocodeCityName
} from './search.js';

const newEmailEl = document.getElementById('new-email');
const currentPwdEmailEl = document.getElementById('current-pwd-email');
const btnUpdateEmail = document.getElementById('btn-update-email');
const emailMsgEl = document.getElementById('email-message');
function clearInitialEmailFocus() {
  if (newEmailEl && document.activeElement === newEmailEl) {
    newEmailEl.blur();
  }
}

const currentPwdPassEl = document.getElementById('current-pwd-pass');
const newPassEl = document.getElementById('new-pass');
const newPassConfirmEl = document.getElementById('new-pass-confirm');
const btnUpdatePass = document.getElementById('btn-update-pass');
const passMsgEl = document.getElementById('pass-message');

const bioEl = document.getElementById('set-bio');
const cvEl = document.getElementById('set-cv');
const btnUpdateBio = document.getElementById('btn-update-bio');
const bioMsgEl = document.getElementById('bio-message');
const personalDataFields = document.getElementById('personal-data-fields');
const genderEl = document.getElementById('set-gender');
const genderVisibleEl = document.getElementById('set-gender-visible');
const nationalityEl = document.getElementById('set-nationality');
const nationalityVisibleEl = document.getElementById('set-nationality-visible');
const nationalityToggle = document.getElementById('set-nationality-toggle');
const nationalitySuggestionsEl = document.getElementById('set-nationality-suggestions');

const rateRehearsal = document.getElementById('set-rate-rehearsal');
const rateConcert = document.getElementById('set-rate-concert');
const rateService = document.getElementById('set-rate-service');
const rateTrumpet = document.getElementById('set-rate-trumpet');
const rateSolo = document.getElementById('set-rate-solo');
const btnUpdateRates = document.getElementById('btn-update-rates');
const ratesMsgEl = document.getElementById('rates-message');
const willingEl = document.getElementById('set-willing');

const setLocationCityEl = document.getElementById('set-location-city');
const setLocationSuggestionsEl = document.getElementById('set-location-suggestions');
const setLocationStreetEl = document.getElementById('set-location-street');
const setLocationStreetNumberEl = document.getElementById('set-location-streetNumber');
const btnUpdateLocation = document.getElementById('btn-update-location');
const locationMsgEl = document.getElementById('location-message');
const ensembleLocationCard = document.getElementById('ensemble-location-card');

const setCityEl = document.getElementById('set-city');
const setCitySuggestionsEl = document.getElementById('set-city-suggestions');
const setTravelKmEl = document.getElementById('set-travel-km');
const btnUpdateTravel = document.getElementById('btn-update-travel');
const travelMsgEl = document.getElementById('travel-message');

const btnLogout = document.getElementById('btn-logout');

let currentUserType = null;
let cityList = [];
const AVATAR_ROOT = '/assets/img/avatars';
const AVATAR_VERSION = Date.now().toString();

window.addEventListener('load', () => {
  clearInitialEmailFocus();
  // doppio blur async per alcuni browser/password manager
  setTimeout(clearInitialEmailFocus, 50);
});

function buildDefaultAvatarPath(gender = 'unknown') {
  const g = ['male', 'female', 'non_binary'].includes(gender) ? gender : 'unknown';
  return `${AVATAR_ROOT}/avatar-default/avatar-default-${g}.png?v=${AVATAR_VERSION}`;
}

function normalizeGenderSlug(raw) {
  const g = (raw || '').toString().toLowerCase();
  if (g === 'male' || g === 'female' || g === 'non_binary') return g;
  return 'unknown';
}

function buildAvatarPath({ nameParts = [] }) {
  const name = ['avatar', ...nameParts.filter(Boolean)].join('-');
  return `${AVATAR_ROOT}/${name}.png?v=${AVATAR_VERSION}`;
}

function pickPreferredAvatarUrl(data = {}) {
  const gender = normalizeGenderSlug(data.gender);
  const instrumentSlug =
    data.mainInstrumentSlug ||
    slugifyInstrument(data.mainInstrument || '') ||
    (Array.isArray(data.instruments) && data.instruments.length ? slugifyInstrument(data.instruments[0]) : '');
  const role = data.role || data.userType || '';
  const urls = [];
  if (data.photoUrl) urls.push(data.photoUrl);
  if (data.photoURL) urls.push(data.photoURL);
  if (data.avatarUrl) urls.push(data.avatarUrl);
  const aliases = { voce: 'cantante', vocalist: 'cantante', flauto: 'flute', corno: 'corno-francese', 'corno-francese': 'corno-francese' };
  let variant = aliases[instrumentSlug] || instrumentSlug;
  if ((role === 'singer' || role === 'cantante') && data.voiceType) {
    variant = 'cantante';
  }
  if (role === 'ensemble' && data.ensembleType) {
    urls.push(`${AVATAR_ROOT}/avatar-ensemble/avatar-${slugifyInstrument(data.ensembleType) || 'ensemble'}.png?v=${AVATAR_VERSION}`);
  }
  if (variant) urls.push(buildAvatarPath({ nameParts: [variant, gender] }));
  urls.push(buildDefaultAvatarPath(gender));
  urls.push(buildDefaultAvatarPath('unknown'));
  return urls.find(Boolean) || null;
}

function applyEnsembleVisibility() {
  const isEnsemble = currentUserType === 'ensemble';
  if (personalDataFields) personalDataFields.style.display = isEnsemble ? 'none' : '';
  if (ensembleLocationCard) ensembleLocationCard.style.display = isEnsemble ? '' : 'none';
  if (travelCard) travelCard.style.display = isEnsemble ? 'none' : '';
  if (settingsInstrumentsField) settingsInstrumentsField.style.display = isEnsemble ? 'none' : '';
  if (settingsMainInstrumentField) settingsMainInstrumentField.style.display = isEnsemble ? 'none' : '';
  if (stableGroupField) stableGroupField.style.display = isEnsemble ? 'none' : '';
  if (ratesTitle) ratesTitle.textContent = isEnsemble ? 'Tariffe offerte' : 'Tariffe';
  if (settingsEnsembleMembersField) settingsEnsembleMembersField.style.display = isEnsemble ? '' : 'none';
  if (isEnsemble) {
    if (genderEl) genderEl.value = '';
    if (genderVisibleEl) genderVisibleEl.checked = false;
    if (nationalityEl) nationalityEl.value = '';
    if (nationalityVisibleEl) nationalityVisibleEl.checked = false;
  }
}

function applyRoleLabels(role) {
  if (currentUserType === 'ensemble') {
    if (settingsInstrumentsField) settingsInstrumentsField.style.display = 'none';
    if (settingsMainInstrumentField) settingsMainInstrumentField.style.display = 'none';
    if (settingsLabelInstruments) settingsLabelInstruments.textContent = '';
    if (settingsLabelMainInstrument) settingsLabelMainInstrument.textContent = '';
    if (settingsEnsembleMembersField) settingsEnsembleMembersField.style.display = '';
    return;
  }

  if (role === 'singer') {
    if (settingsLabelInstruments) settingsLabelInstruments.textContent = 'Capacità vocale';
    if (settingsLabelMainInstrument) settingsLabelMainInstrument.textContent = 'Voce principale';
    if (settingsMainInstrumentField) settingsMainInstrumentField.style.display = 'none';
    if (settingsInstrumentsField) settingsInstrumentsField.style.display = '';
  } else {
    if (settingsLabelInstruments) settingsLabelInstruments.textContent = 'Altri strumenti suonati';
    if (settingsLabelMainInstrument) settingsLabelMainInstrument.textContent = 'Strumento principale';
    if (settingsMainInstrumentField) settingsMainInstrumentField.style.display = '';
    if (settingsInstrumentsField) settingsInstrumentsField.style.display = '';
  }
}

const avatarPreview = document.getElementById('settings-avatar');
const avatarFileInput = document.getElementById('settings-avatar-file');
const avatarRemoveBtn = document.getElementById('settings-avatar-remove');
const avatarMsgEl = document.getElementById('avatar-message');

const setInstrumentsEl = document.getElementById('set-instruments');
const setMainInstrumentEl = document.getElementById('set-mainInstrument');
const instrumentsSuggestionsEl = document.getElementById('set-instruments-suggestions');
const mainInstrumentSuggestionsEl = document.getElementById('set-mainInstrument-suggestions');
const settingsInstrumentsField = document.getElementById('settings-instruments-field');
const settingsMainInstrumentField = document.getElementById('settings-mainInstrument-field');
const settingsLabelInstruments = document.getElementById('settings-label-instruments');
const settingsLabelMainInstrument = document.getElementById('settings-label-mainInstrument');
const settingsEnsembleMembersField = document.getElementById('settings-ensemble-members-field');
const setEnsembleMembersEl = document.getElementById('set-ensemble-members');
const clearInstrumentsBtn = document.getElementById('clear-instruments');
const clearMainInstrumentBtn = document.getElementById('clear-mainInstrument');
const voiceSettingsFields = document.getElementById('voice-settings-fields');
const voiceTypeSelect = document.getElementById('set-voiceType');
const travelCard = document.getElementById('travel-card');
const stableGroupField = document.getElementById('stable-group-field');
const ratesTitle = document.getElementById('rates-title');

const countryList = [
  'Italia', 'Francia', 'Germania', 'Spagna', 'Portogallo', 'Regno Unito', 'Irlanda',
  'Stati Uniti', 'Canada', 'Messico', 'Brasile', 'Argentina', 'Cina', 'Giappone',
  'India', 'Australia', 'Nuova Zelanda', 'Sudafrica', 'Egitto', 'Marocco', 'Tunisia',
  'Grecia', 'Turchia', 'Svizzera', 'Austria', 'Belgio', 'Paesi Bassi', 'Svezia',
  'Norvegia', 'Danimarca', 'Finlandia', 'Polonia', 'Repubblica Ceca', 'Ungheria',
  'Romania', 'Bulgaria', 'Croazia', 'Slovenia', 'Serbia'
];

const instrumentSuggestions = [
  'Arpa',
  'Batteria',
  'Basso elettrico',
  'Cajon',
  'Cantante',
  'Chitarra',
  'Chitarra acustica',
  'Chitarra classica',
  'Chitarra elettrica',
  'Clarinetto',
  'Clarinetto basso',
  'Clavicembalo',
  'Contrabbasso',
  'Cornetta',
  'Corno francese',
  'Corno inglese',
  'Euphonium',
  'Fagotto',
  'Fisarmonica',
  'Flauto',
  'Flute',
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
  'Sousafono',
  'Tastiera',
  'Tenore',
  'Timpani',
  'Tromba',
  'Trombone',
  'Tuba',
  'Ukulele',
  'Vibrafono',
  'Viola',
  'Violino',
  'Violoncello',
  'Voce',
  'Xilofono',
  'Soprano',
  'Mezzosoprano',
  'Contralto',
  'Baritono',
  'Basso'
];

function setLocationMessage(text, isError = false) {
  if (!locationMsgEl) return;
  locationMsgEl.textContent = text || '';
  locationMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

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

function normalizeInstrumentName(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizeInstrumentsString(raw) {
  if (!raw) return '';
  const tokens = raw
    .split(',')
    .map((t) => normalizeInstrumentName(t))
    .filter(Boolean);
  return tokens.join(', ');
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

function renderLocationSuggestions(term) {
  if (!setLocationSuggestionsEl) return;
  setLocationSuggestionsEl.innerHTML = '';
  if (!term) {
    setLocationSuggestionsEl.hidden = true;
    return;
  }
  const matches = filterCities(cityList, term, 6);
  if (matches.length === 0) {
    setLocationSuggestionsEl.hidden = true;
    return;
  }
  matches.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.textContent = `${c.name}${c.province ? ' (' + c.province + ')' : ''}`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (setLocationCityEl) setLocationCityEl.value = c.name;
      setLocationSuggestionsEl.hidden = true;
    });
    setLocationSuggestionsEl.appendChild(item);
  });
  setLocationSuggestionsEl.hidden = false;
}

function renderUserCitySuggestions(term) {
  if (!setCitySuggestionsEl) return;
  setCitySuggestionsEl.innerHTML = '';
  if (!term) {
    setCitySuggestionsEl.hidden = true;
    return;
  }
  const matches = filterCities(cityList, term, 6);
  if (matches.length === 0) {
    setCitySuggestionsEl.hidden = true;
    return;
  }
  matches.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.textContent = `${c.name}${c.province ? ' (' + c.province + ')' : ''}`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (setCityEl) setCityEl.value = c.name;
      setCitySuggestionsEl.hidden = true;
    });
    setCitySuggestionsEl.appendChild(item);
  });
  setCitySuggestionsEl.hidden = false;
}

loadCityList()
  .then((list) => { cityList = list; })
  .catch((err) => console.error('[MusiMatch] Errore caricamento lista città:', err));

function renderInstrumentSuggestions(term, targetEl, inputEl, { mode = 'multi' } = {}) {
  if (!targetEl) return;
  targetEl.innerHTML = '';
  if (!term) {
    targetEl.hidden = true;
    return;
  }
  const matches = instrumentSuggestions
    .filter((c) => c.toLowerCase().includes(term.toLowerCase()))
    .slice(0, 8);
  if (matches.length === 0) {
    targetEl.hidden = true;
    return;
  }
  matches.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.textContent = c;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (!inputEl) return;
      if (mode === 'single') {
        inputEl.value = c;
        inputEl.readOnly = true;
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const parts = inputEl.value.split(',');
        parts[parts.length - 1] = c;
        const cleaned = parts
          .map((t) => normalizeInstrumentName(t))
          .filter(Boolean);
        inputEl.value = cleaned.length ? `${cleaned.join(', ')}` : '';
      }
      targetEl.hidden = true;
    });
    targetEl.appendChild(item);
  });
  targetEl.hidden = false;
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
      const docData = await loadUserDoc(user.uid);
      if (docData) {
        await updateDoc(doc(db, 'users', docData.id), {
          email: newEmail,
          updatedAt: serverTimestamp()
        });
      }
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

function renderNationality(term) {
  if (!nationalitySuggestionsEl) return;
  nationalitySuggestionsEl.innerHTML = '';
  // mostra solo se digitato o se aperto da toggle
  if (!term && document.activeElement !== nationalityToggle) {
    nationalitySuggestionsEl.hidden = true;
    return;
  }
  const matches = countryList
    .filter((c) => c.toLowerCase().includes(term.toLowerCase()))
    .slice(0, 8);
  if (matches.length === 0) {
    nationalitySuggestionsEl.hidden = true;
    return;
  }
  matches.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.textContent = c;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (nationalityEl) nationalityEl.value = c;
      nationalitySuggestionsEl.hidden = true;
    });
    nationalitySuggestionsEl.appendChild(item);
  });
  nationalitySuggestionsEl.hidden = false;
}

if (nationalityEl) {
  nationalityEl.addEventListener('input', (e) => {
    renderNationality(e.target.value);
  });
  nationalityEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (nationalitySuggestionsEl) nationalitySuggestionsEl.hidden = true;
    }, 150);
  });
}

if (nationalityToggle) {
  nationalityToggle.addEventListener('click', () => {
    if (!nationalitySuggestionsEl || !nationalityEl) return;
    const hidden = nationalitySuggestionsEl.hidden;
    if (hidden) {
      renderNationality(nationalityEl.value || ' ');
    } else {
      nationalitySuggestionsEl.hidden = true;
    }
  });
}

if (setInstrumentsEl) {
  setInstrumentsEl.addEventListener('input', (e) => {
    if (e.data === ',' && setInstrumentsEl.value.trim().slice(-1) === ',') {
      setInstrumentsEl.value = `${setInstrumentsEl.value} `;
    }
    renderInstrumentSuggestions(e.target.value.split(',').pop().trim(), instrumentsSuggestionsEl, setInstrumentsEl);
  });
  setInstrumentsEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (instrumentsSuggestionsEl) instrumentsSuggestionsEl.hidden = true;
    }, 150);
  });
}

if (setMainInstrumentEl) {
  setMainInstrumentEl.addEventListener('input', (e) => {
    const cleanValue = e.target.value.replace(/,/g, ' ').replace(/\s{2,}/g, ' ');
    if (cleanValue !== e.target.value) {
      setMainInstrumentEl.value = cleanValue;
    }
    renderInstrumentSuggestions(setMainInstrumentEl.value.trim(), mainInstrumentSuggestionsEl, setMainInstrumentEl, { mode: 'single' });
  });
  setMainInstrumentEl.addEventListener('change', () => {
    if (setMainInstrumentEl.value) {
      setMainInstrumentEl.readOnly = true;
    }
  });
  setMainInstrumentEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (mainInstrumentSuggestionsEl) mainInstrumentSuggestionsEl.hidden = true;
    }, 150);
  });
}

if (clearInstrumentsBtn) {
  clearInstrumentsBtn.addEventListener('click', () => {
    if (setInstrumentsEl) setInstrumentsEl.value = '';
    if (instrumentsSuggestionsEl) instrumentsSuggestionsEl.hidden = true;
  });
}

if (clearMainInstrumentBtn) {
  clearMainInstrumentBtn.addEventListener('click', () => {
    if (setMainInstrumentEl) setMainInstrumentEl.value = '';
    if (mainInstrumentSuggestionsEl) mainInstrumentSuggestionsEl.hidden = true;
    if (setMainInstrumentEl) setMainInstrumentEl.readOnly = false;
  });
}

if (setLocationCityEl) {
  setLocationCityEl.addEventListener('input', (e) => {
    renderLocationSuggestions(e.target.value);
  });
  setLocationCityEl.addEventListener('focus', (e) => {
    renderLocationSuggestions(e.target.value);
  });
  setLocationCityEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (setLocationSuggestionsEl) setLocationSuggestionsEl.hidden = true;
    }, 120);
  });
}

async function loadUserDoc(uid) {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('authUid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

async function geocodeCity(cityName) {
  const city = findCityByName(cityList, cityName);
  if (!city) throw new Error('Seleziona una città valida.');
  const coords = await geocodeCityName(cityName);
  return {
    ...city,
    lat: coords.lat,
    lng: coords.lng
  };
}

function setRatesFields(rates = {}) {
  if (rateRehearsal) rateRehearsal.value = rates.rehearsal ?? '';
  if (rateConcert) rateConcert.value = rates.concert_or_mass ?? '';
  if (rateService) rateService.value = rates.service_civil_religious ?? '';
  if (rateTrumpet) rateTrumpet.value = rates.service_civil_trumpet_full ?? '';
  if (rateSolo) rateSolo.value = rates.solo_performance ?? '';
  if (willingEl) willingEl.checked = !!rates.willingToJoinForFree || false;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  // evita focus automatico sul primo campo
  clearInitialEmailFocus();
  try {
    const docData = await loadUserDoc(user.uid);
    if (docData?.data) {
      currentUserType = docData.data.userType || null;
      applyEnsembleVisibility();
      applyRoleLabels(docData.data.role);
      if (bioEl) bioEl.value = docData.data.bio || '';
      if (cvEl) cvEl.value = docData.data.curriculum || '';
      if (setEnsembleMembersEl) setEnsembleMembersEl.value = docData.data.ensembleMembers ?? '';
      setRatesFields(docData.data.rates || {});
      if (genderEl) genderEl.value = docData.data.gender || '';
      if (genderVisibleEl) genderVisibleEl.checked = !!docData.data.genderVisible;
      if (nationalityEl) nationalityEl.value = docData.data.nationality || '';
      if (nationalityVisibleEl) nationalityVisibleEl.checked = !!docData.data.nationalityVisible;
      if (willingEl) willingEl.checked = !!docData.data.willingToJoinForFree;
      const avatarUrl =
        docData.data.photoUrl ||
        docData.data.photoURL ||
        docData.data.avatarUrl ||
        pickPreferredAvatarUrl(docData.data);
      if (avatarUrl) setAvatarPreview(avatarUrl);
      if (setInstrumentsEl && Array.isArray(docData.data.instruments)) {
        setInstrumentsEl.value = docData.data.instruments.join(', ');
      }
      if (setMainInstrumentEl) {
        setMainInstrumentEl.value = docData.data.mainInstrument || '';
        setMainInstrumentEl.readOnly = docData.data.role === 'singer';
      }
      if (voiceTypeSelect) {
        voiceTypeSelect.value = docData.data.voiceType || '';
      }
      if (voiceSettingsFields) {
        voiceSettingsFields.style.display = docData.data.role === 'singer' ? 'flex' : 'none';
      }
      const loc = docData.data.location || {};
      if (setCityEl) setCityEl.value = loc.city || '';
      if (setTravelKmEl) setTravelKmEl.value = docData.data.maxTravelKm ?? '';
      if (currentUserType === 'ensemble') {
        if (setLocationCityEl) setLocationCityEl.value = loc.city || '';
        if (setLocationStreetEl) setLocationStreetEl.value = loc.street || '';
        if (setLocationStreetNumberEl) setLocationStreetNumberEl.value = loc.streetNumber || '';
      }
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

function setTravelMessage(text, isError = false) {
  if (!travelMsgEl) return;
  travelMsgEl.textContent = text || '';
  travelMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function setAvatarPreview(url) {
  if (!avatarPreview) return;
  let img = avatarPreview.querySelector('img');
  const fallback = avatarPreview.querySelector('.avatar-fallback');
  if (img) {
    img.onload = null;
    img.onerror = null;
  }
  if (!url) {
    if (img) img.remove();
    if (fallback) fallback.style.display = 'flex';
    return;
  }
  if (!img) {
    img = document.createElement('img');
    avatarPreview.prepend(img);
  }
  img.onload = () => {
    if (fallback) fallback.style.display = 'none';
  };
  img.onerror = () => {
    const def = buildDefaultAvatarPath();
    if (img.src === def) {
      if (fallback) fallback.style.display = 'flex';
      return;
    }
    img.src = def;
  };
  img.src = url;
}

async function uploadAvatar(file, uid) {
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) throw new Error('L’immagine è troppo pesante (max 5MB).');
  const cleanName = file.name ? file.name.replace(/\s+/g, '-').toLowerCase() : 'avatar';
  const avatarRef = ref(storage, `avatars/${uid}/${Date.now()}-${cleanName}`);
  const metadata = file.type ? { contentType: file.type } : undefined;
  const snapshot = await uploadBytes(avatarRef, file, metadata);
  return getDownloadURL(snapshot.ref);
}

function setAvatarMessage(text, isError = false) {
  if (!avatarMsgEl) return;
  avatarMsgEl.textContent = text || '';
  avatarMsgEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

if (btnUpdateLocation) {
  btnUpdateLocation.addEventListener('click', async () => {
    setLocationMessage('');
    if (!auth.currentUser) return;
    try {
      if (currentUserType !== 'ensemble') {
        setLocationMessage('Solo gli ensemble possono aggiornare la sede.', true);
        return;
      }
      const docData = await loadUserDoc(auth.currentUser.uid);
      if (!docData) throw new Error('Profilo non trovato.');
      if (!setLocationCityEl || !setLocationCityEl.value.trim()) {
        throw new Error('Inserisci la città/paese.');
      }
      const cityInfo = await geocodeCity(setLocationCityEl.value.trim());
      await updateDoc(doc(db, 'users', docData.id), {
        location: {
          city: cityInfo.name,
          province: cityInfo.province || '',
          region: cityInfo.region || '',
          countryCode: 'IT',
          lat: cityInfo.lat,
          lng: cityInfo.lng,
          street: setLocationStreetEl?.value.trim() || null,
          streetNumber: setLocationStreetNumberEl?.value.trim() || null
        },
        updatedAt: serverTimestamp()
      });
      setLocationMessage('Sede aggiornata.');
    } catch (err) {
      console.error('[MusiMatch] Errore update sede ensemble:', err);
      setLocationMessage(err.message || 'Errore aggiornamento sede.', true);
    }
  });
}

if (setCityEl) {
  setCityEl.addEventListener('input', (e) => {
    renderUserCitySuggestions(e.target.value);
  });
  setCityEl.addEventListener('focus', (e) => {
    renderUserCitySuggestions(e.target.value);
  });
  setCityEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (setCitySuggestionsEl) setCitySuggestionsEl.hidden = true;
    }, 120);
  });
}

if (btnUpdateBio) {
  btnUpdateBio.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    setBioMessage('');
    try {
      const docData = await loadUserDoc(auth.currentUser.uid);
      if (!docData) throw new Error('Profilo non trovato.');
      const instrumentsStr = normalizeInstrumentsString(setInstrumentsEl?.value || '');
      const instruments = instrumentsStr
        .split(',')
        .map((t) => normalizeInstrumentName(t))
        .filter(Boolean);
      let mainInstrument = normalizeInstrumentName(setMainInstrumentEl?.value || '');
      const voiceType = normalizeInstrumentName(voiceTypeSelect?.value || '');
      const membersRaw = setEnsembleMembersEl?.value ?? '';
      const membersVal = membersRaw === '' ? null : parseInt(membersRaw, 10);
      const ensembleMembers = Number.isFinite(membersVal) ? membersVal : null;
      if (voiceType) {
        mainInstrument = voiceType;
        if (!instruments.includes(voiceType)) instruments.unshift(voiceType);
      }
      const mainInstrumentSlug = slugifyInstrument(mainInstrument);
      const isEnsemble = currentUserType === 'ensemble';
      await updateDoc(doc(db, 'users', docData.id), {
        bio: bioEl?.value.trim() || null,
        curriculum: cvEl?.value.trim() || null,
        gender: isEnsemble ? null : (genderEl?.value || null),
        genderVisible: isEnsemble ? false : !!genderVisibleEl?.checked,
        nationality: isEnsemble ? null : (nationalityEl?.value.trim() || null),
        nationalityVisible: isEnsemble ? false : !!nationalityVisibleEl?.checked,
        ensembleMembers: isEnsemble ? ensembleMembers : null,
        instruments: instruments.length > 0 ? instruments : null,
        mainInstrument: mainInstrument || null,
        mainInstrumentSlug: mainInstrumentSlug || null,
        voiceType: voiceType || null,
        updatedAt: serverTimestamp()
      });
      setBioMessage('Bio e curriculum aggiornati.');
    } catch (err) {
      console.error('[MusiMatch] Errore update bio:', err);
      setBioMessage(err.message || 'Errore aggiornamento bio/curriculum.', true);
    }
  });
}

if (btnUpdateTravel) {
  btnUpdateTravel.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    setTravelMessage('');
    try {
      const docData = await loadUserDoc(auth.currentUser.uid);
      if (!docData) throw new Error('Profilo non trovato.');
      if (!setCityEl || !setCityEl.value.trim()) {
        throw new Error('Inserisci la città/paese.');
      }
      const cityInfo = await geocodeCity(setCityEl.value.trim());
      const kmValRaw = setTravelKmEl?.value || '';
      const kmVal = kmValRaw === '' ? null : parseFloat(kmValRaw);
      const travelKm = Number.isFinite(kmVal) ? kmVal : null;
      const prevLoc = docData.data.location || {};
      await updateDoc(doc(db, 'users', docData.id), {
        location: {
          ...prevLoc,
          city: cityInfo.name,
          province: cityInfo.province || '',
          region: cityInfo.region || '',
          countryCode: 'IT',
          lat: cityInfo.lat,
          lng: cityInfo.lng,
          street: prevLoc.street || null,
          streetNumber: prevLoc.streetNumber || null
        },
        maxTravelKm: travelKm,
        updatedAt: serverTimestamp()
      });
      setTravelMessage('Città e distanza aggiornate.');
    } catch (err) {
      console.error('[MusiMatch] Errore update città/distanza:', err);
      setTravelMessage(err.message || 'Errore aggiornamento città/distanza.', true);
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
        rates: { ...rates },
        willingToJoinForFree: !!willingEl?.checked,
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

// Avatar upload/remove
if (avatarFileInput) {
  avatarFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMessage('Caricamento foto...');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Non autenticato.');
      const docData = await loadUserDoc(user.uid);
      if (!docData) throw new Error('Profilo non trovato.');

      const downloadUrl = await uploadAvatar(file, user.uid);
      await updateDoc(doc(db, 'users', docData.id), {
        photoUrl: downloadUrl,
        updatedAt: serverTimestamp()
      });
      setAvatarPreview(downloadUrl);
      setAvatarMessage('Foto aggiornata.');
    } catch (err) {
      console.error('[MusiMatch] Errore upload avatar:', err);
      setAvatarMessage(err.message || 'Errore aggiornamento foto.', true);
    } finally {
      avatarFileInput.value = '';
    }
  });
}

if (avatarRemoveBtn) {
  avatarRemoveBtn.addEventListener('click', async () => {
    setAvatarMessage('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Non autenticato.');
      const docData = await loadUserDoc(user.uid);
      if (!docData) throw new Error('Profilo non trovato.');
      await updateDoc(doc(db, 'users', docData.id), {
        photoUrl: null,
        updatedAt: serverTimestamp()
      });
      setAvatarPreview(null);
      setAvatarMessage('Foto rimossa. Verrà usato l’avatar predefinito.');
    } catch (err) {
      console.error('[MusiMatch] Errore rimozione avatar:', err);
      setAvatarMessage(err.message || 'Errore rimozione foto.', true);
    }
  });
}
