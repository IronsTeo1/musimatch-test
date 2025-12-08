// public/js/register.js
import { db, auth } from './firebase-config.js';
import {
  addDoc,
  collection,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {
  loadCityList,
  filterCities,
  findCityByName,
  geocodeCityName
} from './search.js';

const form = document.getElementById('register-form');
const messageEl = document.getElementById('register-message');
const typeRadios = document.querySelectorAll('input[name="user-kind"]');
const musicianFields = document.getElementById('musician-fields');
const ensembleFields = document.getElementById('ensemble-fields');
const locationFields = document.getElementById('location-fields');
const passwordFields = document.getElementById('password-fields');
const submitRow = document.getElementById('submit-row');
const pwdEl = document.getElementById('reg-password');
const pwdConfirmEl = document.getElementById('reg-password-confirm');

const mDisplayName = document.getElementById('m-displayName');
const mEmail = document.getElementById('m-email');
const mInstruments = document.getElementById('m-instruments');
const mMainInstrument = document.getElementById('m-mainInstrument');
const mMaxTravelKm = document.getElementById('m-maxTravelKm');
const mBio = document.getElementById('m-bio');
const mExperience = document.getElementById('m-experience');
const mWilling = document.getElementById('m-willing');
const mCv = document.getElementById('m-cv');
const mPhotoUrl = document.getElementById('m-photoUrl');
const rateRehearsal = document.getElementById('rate-rehearsal');
const rateConcert = document.getElementById('rate-concert');
const rateService = document.getElementById('rate-service');
const rateTrumpet = document.getElementById('rate-trumpet');
const rateSolo = document.getElementById('rate-solo');

const eName = document.getElementById('e-name');
const eEmail = document.getElementById('e-email');
const eDescription = document.getElementById('e-description');
const eMembers = document.getElementById('e-members');
const eWebsite = document.getElementById('e-website');
const ePhotoUrl = document.getElementById('e-photoUrl');

const cityInput = document.getElementById('reg-city');
const citySuggestions = document.getElementById('reg-city-suggestions');

let cityList = [];

function setMessage(text, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text || '';
  messageEl.style.color = isError ? '#f87171' : 'var(--muted)';
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

function toggleSections(kind) {
  if (!musicianFields || !ensembleFields || !locationFields) return;
  const isMusician = kind === 'musician' || kind === 'singer';
  musicianFields.style.display = isMusician ? 'flex' : 'none';
  ensembleFields.style.display = isMusician ? 'none' : 'flex';
  locationFields.style.display = kind ? 'flex' : 'none';
  if (passwordFields) passwordFields.style.display = kind ? 'grid' : 'none';
  if (submitRow) submitRow.style.display = kind ? 'flex' : 'none';
}

typeRadios.forEach((radio) => {
  radio.addEventListener('change', () => toggleSections(radio.value));
});

// Città autocomplete
loadCityList()
  .then((list) => {
    cityList = list;
  })
  .catch((err) => console.error('[MusiMatch] Errore caricamento città:', err));

function renderCitySuggestions(term) {
  if (!citySuggestions) return;
  citySuggestions.innerHTML = '';

  if (!term) {
    citySuggestions.hidden = true;
    return;
  }

  const matches = filterCities(cityList, term, 8);
  if (matches.length === 0) {
    citySuggestions.hidden = true;
    return;
  }

  matches.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.tabIndex = 0;
    item.innerHTML = `
      <span>${c.name}</span>
      <small>${c.province || ''} ${c.region || ''}</small>
    `;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (cityInput) cityInput.value = c.name;
      citySuggestions.hidden = true;
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (cityInput) {
          cityInput.value = c.name;
          cityInput.focus();
        }
        citySuggestions.hidden = true;
      }
    });
    citySuggestions.appendChild(item);
  });

  citySuggestions.hidden = false;
}

if (cityInput) {
  cityInput.addEventListener('input', (e) => {
    renderCitySuggestions(e.target.value);
  });
  cityInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (citySuggestions) citySuggestions.hidden = true;
    }, 150);
  });
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

async function submitForm(event) {
  event.preventDefault();
  const selected = Array.from(typeRadios).find((r) => r.checked);
  if (!selected) {
    setMessage('Seleziona chi sei per continuare.', true);
    return;
  }
  const kind = selected.value;
  if (!cityInput || !cityInput.value.trim()) {
    setMessage('Inserisci la città/paese.', true);
    return;
  }

  setMessage('Salvataggio in corso...');
  try {
    const cityInfo = await geocodeCity(cityInput.value.trim());
    const password = pwdEl?.value || '';
    const passwordConfirm = pwdConfirmEl?.value || '';
    if (!password || password.length < 6) {
      throw new Error('Inserisci una password di almeno 6 caratteri.');
    }
    if (password !== passwordConfirm) {
      throw new Error('Le password non coincidono.');
    }

    let authUid = null;
    let emailForAuth = '';
    if (kind === 'musician' || kind === 'singer') {
      const displayName = mDisplayName?.value.trim();
      const email = mEmail?.value.trim();
      const instrumentsStr = normalizeInstrumentsString(mInstruments?.value || '');
      const instruments = instrumentsStr
        .split(',')
        .map((t) => normalizeInstrumentName(t))
        .filter(Boolean);
      const mainInstrument = normalizeInstrumentName(mMainInstrument?.value || '');
      const activityLevelInput = document.querySelector('input[name="m-activityLevel"]:checked');
      const activityLevel = activityLevelInput ? activityLevelInput.value : null;
      const maxTravelKm = parseInt(mMaxTravelKm?.value || '0', 10);
      const bio = mBio?.value.trim();
      const experienceYears = parseInt(mExperience?.value || '0', 10);
      const willingToJoinForFree = mWilling?.checked || false;
      const curriculum = mCv?.value.trim();
      const photoUrl = mPhotoUrl?.value.trim();

      const rates = {};
      const rateParse = (el) => {
        if (!el || el.value === '') return null;
        const v = parseFloat(el.value);
        return Number.isNaN(v) ? null : v;
      };
      const rRehearsal = rateParse(rateRehearsal);
      if (rRehearsal != null) rates.rehearsal = rRehearsal;
      const rConcert = rateParse(rateConcert);
      if (rConcert != null) rates.concert_or_mass = rConcert;
      const rService = rateParse(rateService);
      if (rService != null) rates.service_civil_religious = rService;
      const rTrumpet = rateParse(rateTrumpet);
      if (rTrumpet != null) rates.service_civil_trumpet_full = rTrumpet;
      const rSolo = rateParse(rateSolo);
      if (rSolo != null) rates.solo_performance = rSolo;

      if (!displayName || !email || instruments.length === 0 || !mainInstrument || !activityLevel) {
        throw new Error('Compila nome, email, strumenti, strumento principale e livello.');
      }

      emailForAuth = email;

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      authUid = cred.user.uid;

      const docData = {
        userType: 'musician',
        role: kind, // musician | singer
        authUid,
        displayName,
        email,
        instruments,
        mainInstrument,
        activityLevel,
        experienceYears: Number.isNaN(experienceYears) ? 0 : experienceYears,
        maxTravelKm: Number.isNaN(maxTravelKm) ? 0 : maxTravelKm,
        willingToJoinForFree,
        location: {
          city: cityInfo.name,
          province: cityInfo.province || '',
          region: cityInfo.region || '',
          countryCode: 'IT',
          lat: cityInfo.lat,
          lng: cityInfo.lng
        },
        bio: bio || null,
        curriculum: curriculum || null,
        photoUrl: photoUrl || null,
        rates: Object.keys(rates).length > 0 ? rates : undefined,
        isActive: true,
        isPremium: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'users'), docData);
    } else {
      const displayName = eName?.value.trim();
      const email = eEmail?.value.trim();
      const description = eDescription?.value.trim();
      const ensembleType = kind; // choir | orchestra | band
      const members = eMembers?.value ? parseInt(eMembers.value, 10) : null;
      const website = eWebsite?.value.trim();
      const photoUrl = ePhotoUrl?.value.trim();

      if (!displayName || !email) {
        throw new Error('Compila nome ensemble ed email.');
      }

      emailForAuth = email;
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      authUid = cred.user.uid;

      const docData = {
        userType: 'ensemble',
        ensembleType,
        authUid,
        displayName,
        email,
        description: description || null,
        members: Number.isNaN(members) ? null : members,
        website: website || null,
        photoUrl: photoUrl || null,
        location: {
          city: cityInfo.name,
          province: cityInfo.province || '',
          region: cityInfo.region || '',
          countryCode: 'IT',
          lat: cityInfo.lat,
          lng: cityInfo.lng
        },
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'users'), docData);
    }

    setMessage('Registrazione salvata con successo.');
    form.reset();
    toggleSections('');
  } catch (err) {
    console.error('[MusiMatch] Errore registrazione:', err);
    setMessage(err.message || 'Errore durante la registrazione.', true);
  }
}

if (form) {
  form.addEventListener('submit', submitForm);
}
