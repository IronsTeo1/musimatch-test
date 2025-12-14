// public/js/register.js
import { db, auth, storage } from './firebase-config.js';
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
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

const form = document.getElementById('register-form');
const messageEl = document.getElementById('register-message');
const typeRadios = document.querySelectorAll('input[name="user-kind"]');
const musicianFields = document.getElementById('musician-fields');
const ensembleFields = document.getElementById('ensemble-fields');
const passwordFields = document.getElementById('password-fields');
const submitRow = document.getElementById('submit-row');
const pwdEl = document.getElementById('reg-password');
const pwdConfirmEl = document.getElementById('reg-password-confirm');
const mGenderEl = document.getElementById('m-gender');
const mGenderVisibleEl = document.getElementById('m-gender-visible');
const mNationalityEl = document.getElementById('m-nationality');
const mNationalityVisibleEl = document.getElementById('m-nationality-visible');

const mDisplayName = document.getElementById('m-displayName');
const mEmail = document.getElementById('m-email');
const instrumentBlock = document.getElementById('instrument-block');
const mInstruments = document.getElementById('m-instruments');
const mMainInstrument = document.getElementById('m-mainInstrument');
const mInstrumentsSuggestions = document.getElementById('m-instruments-suggestions');
const mMainInstrumentSuggestions = document.getElementById('m-mainInstrument-suggestions');
const mLabelInstruments = document.getElementById('label-instruments');
const mLabelMainInstrument = document.getElementById('label-mainInstrument');
const mCityInput = document.getElementById('m-city');
const mCitySuggestions = document.getElementById('m-city-suggestions');
const mMaxTravelKm = document.getElementById('m-maxTravelKm');
const mBio = document.getElementById('m-bio');
const mExperience = document.getElementById('m-experience');
const mWilling = document.getElementById('m-willing');
const mCv = document.getElementById('m-cv');
const mPhotoFile = document.getElementById('m-photoFile');
const rateRehearsal = document.getElementById('rate-rehearsal');
const rateConcert = document.getElementById('rate-concert');
const rateService = document.getElementById('rate-service');
const rateTrumpet = document.getElementById('rate-trumpet');
const rateTrumpetField = document.getElementById('rate-trumpet-field');
const rateSolo = document.getElementById('rate-solo');

const eName = document.getElementById('e-name');
const eEmail = document.getElementById('e-email');
const eDescription = document.getElementById('e-description');
const eMembers = document.getElementById('e-members');
const eWebsite = document.getElementById('e-website');
const ePhotoFile = document.getElementById('e-photoFile');
const eGenderEl = document.getElementById('e-gender');
const eGenderVisibleEl = document.getElementById('e-gender-visible');
const eNationalityEl = document.getElementById('e-nationality');
const eNationalityVisibleEl = document.getElementById('e-nationality-visible');
const eCityInput = document.getElementById('e-city');
const eCitySuggestions = document.getElementById('e-city-suggestions');
const eStreet = document.getElementById('e-street');
const eStreetNumber = document.getElementById('e-street-number');

const nationalitySuggestions = document.getElementById('nationality-suggestions');
const nationalitySuggestionsEnsemble = document.getElementById('nationality-suggestions-ensemble');
const nationalityToggleMusician = document.getElementById('m-nationality-toggle');
const nationalityToggleEnsemble = document.getElementById('e-nationality-toggle');
const voiceFields = document.getElementById('voice-fields');
const voiceTypeEl = document.getElementById('m-voiceType');

let cityList = [];
let countryList = [];

function setMessage(text, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text || '';
  messageEl.style.color = isError ? '#f87171' : 'var(--muted)';
}

function hasTrumpetSelected({ mainInstrument, instruments = [] }) {
  const target = 'Tromba';
  return mainInstrument === target || instruments.includes(target);
}

function updateTrumpetFieldVisibility(kind) {
  if (!rateTrumpetField || !rateTrumpet) return;
  if (kind === 'singer') {
    rateTrumpetField.style.display = 'none';
    rateTrumpet.value = '';
    return;
  }
  const instruments = normalizeInstrumentsString(mInstruments?.value || '')
    .split(',')
    .map((t) => normalizeInstrumentName(t))
    .filter(Boolean);
  const mainInstrument = normalizeInstrumentName(mMainInstrument?.value || '');
  const show = hasTrumpetSelected({ mainInstrument, instruments });
  rateTrumpetField.style.display = show ? '' : 'none';
  if (!show) rateTrumpet.value = '';
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

function slugifyInstrument(raw) {
  if (!raw) return null;
  const clean = raw
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || null;
}

function normalizeInstrumentsString(raw) {
  if (!raw) return '';
  const tokens = raw
    .split(',')
    .map((t) => normalizeInstrumentName(t))
    .filter(Boolean);
  return tokens.join(', ');
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

// Country list (abbreviated; estendibile)
countryList = [
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

function toggleSections(kind) {
  if (!musicianFields || !ensembleFields) return;
  const isMusician = kind === 'musician' || kind === 'singer';
  musicianFields.style.display = isMusician ? 'flex' : 'none';
  ensembleFields.style.display = isMusician ? 'none' : 'flex';
  if (passwordFields) passwordFields.style.display = kind ? 'grid' : 'none';
  if (submitRow) submitRow.style.display = kind ? 'flex' : 'none';
  if (voiceFields) voiceFields.style.display = kind === 'singer' ? 'flex' : 'none';
  if (mMainInstrument) mMainInstrument.placeholder = kind === 'singer' ? 'Seleziona il registro vocale' : 'Tromba';
  if (kind !== 'singer' && voiceTypeEl) voiceTypeEl.value = '';
  if (instrumentBlock) instrumentBlock.style.display = kind === 'singer' ? 'none' : 'grid';
  if (mLabelInstruments) mLabelInstruments.textContent = kind === 'singer' ? 'Voci' : 'Strumenti';
  if (mLabelMainInstrument) mLabelMainInstrument.textContent = kind === 'singer' ? 'Voce principale' : 'Strumento principale';
  updateTrumpetFieldVisibility(kind);
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

function renderNationalitySuggestions(term, targetEl, inputEl) {
  if (!targetEl) return;
  targetEl.innerHTML = '';
  if (!term) {
    targetEl.hidden = true;
    return;
  }
  const matches = countryList
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
      if (inputEl) inputEl.value = c;
      targetEl.hidden = true;
    });
    targetEl.appendChild(item);
  });
  targetEl.hidden = false;
}

function renderCitySuggestions(term, targetEl, inputEl) {
  if (!targetEl) return;
  targetEl.innerHTML = '';

  if (!term) {
    targetEl.hidden = true;
    return;
  }

  const matches = filterCities(cityList, term, 8);
  if (matches.length === 0) {
    targetEl.hidden = true;
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
      if (inputEl) inputEl.value = c.name;
      targetEl.hidden = true;
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (inputEl) {
          inputEl.value = c.name;
          inputEl.focus();
        }
        targetEl.hidden = true;
      }
    });
    targetEl.appendChild(item);
  });

  targetEl.hidden = false;
}

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

const cityInputs = [
  { input: mCityInput, suggestions: mCitySuggestions },
  { input: eCityInput, suggestions: eCitySuggestions }
];

cityInputs.forEach(({ input, suggestions }) => {
  if (!input) return;
  input.addEventListener('input', (e) => {
    renderCitySuggestions(e.target.value, suggestions, input);
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (suggestions) suggestions.hidden = true;
    }, 150);
  });
});

if (mInstruments) {
  mInstruments.addEventListener('input', (e) => {
    if (e.data === ',' && mInstruments.value.trim().slice(-1) === ',') {
      mInstruments.value = `${mInstruments.value} `;
    }
    const term = mInstruments.value.split(',').pop().trim();
    renderInstrumentSuggestions(term, mInstrumentsSuggestions, mInstruments, { mode: 'multi' });
    updateTrumpetFieldVisibility(document.querySelector('input[name="user-kind"]:checked')?.value || '');
  });
  mInstruments.addEventListener('blur', () => {
    setTimeout(() => {
      if (mInstrumentsSuggestions) mInstrumentsSuggestions.hidden = true;
    }, 150);
  });
}

if (mMainInstrument) {
  mMainInstrument.addEventListener('input', (e) => {
    const cleaned = mMainInstrument.value.replace(/,/g, ' ').replace(/\s{2,}/g, ' ');
    if (cleaned !== mMainInstrument.value) {
      mMainInstrument.value = cleaned;
    }
    renderInstrumentSuggestions(mMainInstrument.value.trim(), mMainInstrumentSuggestions, mMainInstrument, { mode: 'single' });
    updateTrumpetFieldVisibility(document.querySelector('input[name="user-kind"]:checked')?.value || '');
  });
  mMainInstrument.addEventListener('blur', () => {
    setTimeout(() => {
      if (mMainInstrumentSuggestions) mMainInstrumentSuggestions.hidden = true;
    }, 150);
  });
}

const nationalityInputs = [
  { input: mNationalityEl, box: nationalitySuggestions },
  { input: eNationalityEl, box: nationalitySuggestionsEnsemble }
];

nationalityInputs.forEach(({ input, box }) => {
  if (!input) return;
  input.addEventListener('input', (e) => {
    renderNationalitySuggestions(e.target.value, box, input);
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (box) box.hidden = true;
    }, 150);
  });
});

const toggleNationalityBox = (box, input) => {
  if (!box || !input) return;
  const isHidden = box.hidden;
  if (isHidden) {
    renderNationalitySuggestions(input.value || ' ', box, input);
  } else {
    box.hidden = true;
  }
};

if (nationalityToggleMusician) {
  nationalityToggleMusician.addEventListener('click', () => {
    toggleNationalityBox(nationalitySuggestions, mNationalityEl);
  });
}

if (nationalityToggleEnsemble) {
  nationalityToggleEnsemble.addEventListener('click', () => {
    toggleNationalityBox(nationalitySuggestionsEnsemble, eNationalityEl);
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

async function findUserDocByUid(uid) {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('authUid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, data: docSnap.data() };
}

async function submitForm(event) {
  event.preventDefault();
  const selected = Array.from(typeRadios).find((r) => r.checked);
  if (!selected) {
    setMessage('Seleziona chi sei per continuare.', true);
    return;
  }
  const kind = selected.value;
  const currentCityInput = kind === 'musician' || kind === 'singer' ? mCityInput : eCityInput;
  if (!currentCityInput || !currentCityInput.value.trim()) {
    setMessage('Inserisci la città/paese.', true);
    return;
  }

  setMessage('Salvataggio in corso...');
  try {
    const cityInfo = await geocodeCity(currentCityInput.value.trim());
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
      let instruments = instrumentsStr
        .split(',')
        .map((t) => normalizeInstrumentName(t))
        .filter(Boolean);
      let mainInstrument = normalizeInstrumentName(mMainInstrument?.value || '');
      let voiceType = null;
      if (kind === 'singer') {
        voiceType = normalizeInstrumentName(voiceTypeEl?.value || '');
        if (voiceType) {
          mainInstrument = voiceType;
          instruments = [voiceType];
        } else {
          instruments = [];
          mainInstrument = '';
        }
      } else if (voiceTypeEl) {
        voiceType = normalizeInstrumentName(voiceTypeEl.value || '');
        if (voiceType && !instruments.includes(voiceType)) instruments.unshift(voiceType);
      }
      const activityLevelInput = document.querySelector('input[name="m-activityLevel"]:checked');
      const activityLevel = activityLevelInput ? activityLevelInput.value : null;
      const maxTravelKm = parseInt(mMaxTravelKm?.value || '0', 10);
      const bio = mBio?.value.trim();
      const experienceYears = parseInt(mExperience?.value || '0', 10);
      const willingToJoinForFree = mWilling?.checked || false;
      const curriculum = mCv?.value.trim();
      const gender = mGenderEl?.value || '';
      const nationality = mNationalityEl?.value.trim() || '';
      const genderVisible = !!mGenderVisibleEl?.checked;
      const nationalityVisible = !!mNationalityVisibleEl?.checked;
      let photoUrl = null;

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        authUid = cred.user.uid;
      } catch (err) {
        if (err?.code === 'auth/email-already-in-use') {
          const existingCred = await signInWithEmailAndPassword(auth, email, password);
          authUid = existingCred.user.uid;
          setMessage('Email già registrata: abbiamo riutilizzato il tuo account.', false);
        } else {
          throw err;
        }
      }

      if (mPhotoFile?.files?.[0]) {
        photoUrl = await uploadAvatar(mPhotoFile.files[0], authUid);
      }

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
      const hasTrumpet = hasTrumpetSelected({ mainInstrument, instruments });
      if (rTrumpet != null && hasTrumpet) rates.service_civil_trumpet_full = rTrumpet;
      const rSolo = rateParse(rateSolo);
      if (rSolo != null) rates.solo_performance = rSolo;

      if (kind === 'singer' && !voiceType) {
        throw new Error('Seleziona il registro vocale.');
      }

      if (!displayName || !email || !mainInstrument || !activityLevel) {
        throw new Error('Compila nome, email, strumento/voce principale e livello.');
      }

      emailForAuth = email;
      const mainInstrumentSlug = slugifyInstrument(mainInstrument);

      const docData = {
        userType: 'musician',
        role: kind, // musician | singer
        authUid,
        displayName,
        email,
        instruments,
        mainInstrument,
        voiceType: voiceType || null,
        mainInstrumentSlug: mainInstrumentSlug || null,
        activityLevel,
        experienceYears: Number.isNaN(experienceYears) ? 0 : experienceYears,
        maxTravelKm: Number.isNaN(maxTravelKm) ? 0 : maxTravelKm,
        willingToJoinForFree,
        gender: gender || null,
        genderVisible,
        nationality: nationality || null,
        nationalityVisible,
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
        rates: Object.keys(rates).length > 0 ? rates : null,
        isActive: true,
        isPremium: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const existingDoc = await findUserDocByUid(authUid);
      if (existingDoc) {
        const { createdAt: _keepCreated, ...rest } = docData;
        await updateDoc(doc(db, 'users', existingDoc.id), {
          ...rest,
          createdAt: existingDoc.data.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'users'), docData);
      }
    } else {
      const displayName = eName?.value.trim();
      const email = eEmail?.value.trim();
      const description = eDescription?.value.trim();
      const ensembleType = kind; // choir | orchestra | band
      const members = eMembers?.value ? parseInt(eMembers.value, 10) : null;
      const website = eWebsite?.value.trim();
      let photoUrl = null;
      const gender = eGenderEl?.value || '';
      const nationality = eNationalityEl?.value.trim() || '';
      const genderVisible = !!eGenderVisibleEl?.checked;
      const nationalityVisible = !!eNationalityVisibleEl?.checked;

      if (!displayName || !email) {
        throw new Error('Compila nome ensemble ed email.');
      }

      emailForAuth = email;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        authUid = cred.user.uid;
      } catch (err) {
        if (err?.code === 'auth/email-already-in-use') {
          const existingCred = await signInWithEmailAndPassword(auth, email, password);
          authUid = existingCred.user.uid;
          setMessage('Email già registrata: abbiamo riutilizzato il tuo account.', false);
        } else {
          throw err;
        }
      }

      if (ePhotoFile?.files?.[0]) {
        photoUrl = await uploadAvatar(ePhotoFile.files[0], authUid);
      }

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
        gender: gender || null,
        genderVisible,
        nationality: nationality || null,
        nationalityVisible,
        location: {
          city: cityInfo.name,
          province: cityInfo.province || '',
          region: cityInfo.region || '',
          countryCode: 'IT',
          lat: cityInfo.lat,
          lng: cityInfo.lng,
          street: eStreet?.value.trim() || null,
          streetNumber: eStreetNumber?.value.trim() || null
        },
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const existingDoc = await findUserDocByUid(authUid);
      if (existingDoc) {
        const { createdAt: _keepCreated, ...rest } = docData;
        await updateDoc(doc(db, 'users', existingDoc.id), {
          ...rest,
          createdAt: existingDoc.data.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'users'), docData);
      }
    }

    setMessage('Registrazione salvata con successo.');
    form.reset();
    toggleSections('');
    window.location.href = 'profile.html';
  } catch (err) {
    console.error('[MusiMatch] Errore registrazione:', err);
    setMessage(err.message || 'Errore durante la registrazione.', true);
  }
}

if (form) {
  form.addEventListener('submit', submitForm);
}
