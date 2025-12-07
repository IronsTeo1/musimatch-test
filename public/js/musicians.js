// public/js/musicians.js

import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

/**
 * Normalizza un singolo nome di strumento/voce:
 * - toglie spazi ai lati
 * - mette la prima lettera di ogni parola maiuscola
 */
function normalizeInstrumentName(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalizza una stringa con strumenti separati da virgole.
 * Ritorna una stringa del tipo: "Tromba, Clarinetto, Soprano"
 */
function normalizeInstrumentsString(raw) {
  if (!raw) return '';
  const tokens = raw
    .split(',')
    .map((t) => normalizeInstrumentName(t))
    .filter(Boolean);
  return tokens.join(', ');
}

/**
 * Mostra/nasconde il bottone X in base al contenuto del campo.
 */
function setupClearButton(inputEl, clearBtn) {
  if (!inputEl || !clearBtn) return;

  const updateVisibility = () => {
    if (inputEl.value.trim().length > 0) {
      clearBtn.style.display = 'flex';
    } else {
      clearBtn.style.display = 'none';
    }
  };

  inputEl.addEventListener('input', updateVisibility);

  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    updateVisibility();
    inputEl.focus();
  });

  // inizializza
  updateVisibility();
}

/**
 * Inizializza il form di registrazione musicista/cantante.
 */
export function setupMusicianRegistrationForm() {
  const form = document.getElementById('musician-form');
  const messageEl = document.getElementById('musician-form-message');

  if (!form) {
    console.warn('[MusiMatch] Form musicista non trovato nella pagina.');
    return;
  }

  const instrumentsInput = document.getElementById('musician-instruments');
  const instrumentsClearBtn = document.getElementById('musician-instruments-clear');

  const mainInstrInput = document.getElementById('musician-mainInstrument');
  const mainInstrClearBtn = document.getElementById('musician-mainInstrument-clear');

  // X che compare appena inizi a scrivere
  setupClearButton(instrumentsInput, instrumentsClearBtn);
  setupClearButton(mainInstrInput, mainInstrClearBtn);

  // ─────────────────────────────────────────
  // Comportamento campo "Strumenti / voci"
  // ─────────────────────────────────────────
  if (instrumentsInput) {
    instrumentsInput.addEventListener('keydown', (event) => {
      // quando premi virgola o Invio → normalizza e aggiunge ", "
      if (event.key === ',' || event.key === 'Enter') {
        event.preventDefault();
        const normalized = normalizeInstrumentsString(instrumentsInput.value);
        instrumentsInput.value = normalized ? normalized + ', ' : '';
      }
    });

    instrumentsInput.addEventListener('blur', () => {
      // quando esci dal campo → normalizza tutta la stringa (senza virgola finale)
      const normalized = normalizeInstrumentsString(instrumentsInput.value);
      instrumentsInput.value = normalized;
    });
  }

  // ─────────────────────────────────────────
  // Comportamento campo "Strumento / voce principale"
  // ─────────────────────────────────────────
  if (mainInstrInput) {
    // Evita che Invio invii il form
    mainInstrInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        mainInstrInput.blur();
      }
    });

    mainInstrInput.addEventListener('blur', () => {
      const normalized = normalizeInstrumentName(mainInstrInput.value);
      mainInstrInput.value = normalized || '';
    });
  }

  // ─────────────────────────────────────────
  // SUBMIT DEL FORM
  // ─────────────────────────────────────────
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (messageEl) {
      messageEl.textContent = 'Salvataggio in corso...';
      messageEl.style.color = '#e5e7eb';
    }

    try {
      // Normalizziamo gli strumenti prima di leggere i valori finali
      if (instrumentsInput) {
        instrumentsInput.value = normalizeInstrumentsString(instrumentsInput.value);
      }
      if (mainInstrInput) {
        mainInstrInput.value = normalizeInstrumentName(mainInstrInput.value) || '';
      }

      const displayName = document.getElementById('musician-displayName').value.trim();
      const email = document.getElementById('musician-email').value.trim();

      const activityLevelInput = form.querySelector('input[name="musician-activityLevel"]:checked');
      const activityLevel = activityLevelInput ? activityLevelInput.value : null;

      const willingToJoinForFree = document.getElementById('musician-willingFree').checked;

      const experienceYears = parseInt(document.getElementById('musician-experienceYears').value || '0', 10);
      const maxTravelKm = parseInt(document.getElementById('musician-maxTravelKm').value || '0', 10);

      const city = document.getElementById('musician-city').value.trim();
      const province = document.getElementById('musician-province').value.trim();
      const region = document.getElementById('musician-region').value.trim();
      const countryCode = document.getElementById('musician-countryCode').value.trim() || 'IT';

      const lat = parseFloat(document.getElementById('musician-lat').value);
      const lng = parseFloat(document.getElementById('musician-lng').value);

      const rateRehearsal = document.getElementById('musician-rate-rehearsal').value;
      const rateConcert = document.getElementById('musician-rate-concert').value;
      const rateSolo = document.getElementById('musician-rate-solo').value;
      const rateService = document.getElementById('musician-rate-service').value;
      const rateTrumpetService = document.getElementById('musician-rate-trumpetService').value;

      const photoUrl = document.getElementById('musician-photoUrl').value.trim();
      const bio = document.getElementById('musician-bio').value.trim();
      const curriculum = document.getElementById('musician-cv').value.trim();

      // Campi strumenti
      const instrumentsStr = instrumentsInput ? instrumentsInput.value : '';
      const instruments = instrumentsStr
        .split(',')
        .map((t) => normalizeInstrumentName(t))
        .filter(Boolean);

      const mainInstrument = mainInstrInput
        ? normalizeInstrumentName(mainInstrInput.value)
        : null;

      // ── Validazioni minime ──
      if (!displayName || !email || !activityLevel || Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error('Compila tutti i campi obbligatori (nome, email, livello, posizione).');
      }

      if (!instruments || instruments.length === 0) {
        throw new Error('Inserisci almeno uno strumento/voce.');
      }

      if (!mainInstrument) {
        throw new Error('Inserisci lo strumento/voce principale.');
      }

      // Tariffe
      const rates = {};

      if (rateRehearsal !== '') {
        const v = parseFloat(rateRehearsal);
        if (!Number.isNaN(v)) rates.rehearsal = v;
      }

      if (rateConcert !== '') {
        const v = parseFloat(rateConcert);
        if (!Number.isNaN(v)) rates.concert_or_mass = v;
      }

      if (rateSolo !== '') {
        const v = parseFloat(rateSolo);
        if (!Number.isNaN(v)) rates.solo_performance = v;
      }

      if (rateService !== '') {
        const v = parseFloat(rateService);
        if (!Number.isNaN(v)) rates.service_civil_religious = v;
      }

      if (rateTrumpetService !== '') {
        const v = parseFloat(rateTrumpetService);
        if (!Number.isNaN(v)) rates.service_civil_trumpet_full = v;
      }

      // Documento da salvare
      const userDoc = {
        userType: 'musician',
        displayName,
        email,
        instruments,
        mainInstrument,
        activityLevel,          // "professional" | "amateur"
        willingToJoinForFree,   // boolean
        experienceYears: Number.isNaN(experienceYears) ? 0 : experienceYears,
        maxTravelKm: Number.isNaN(maxTravelKm) ? 0 : maxTravelKm,
        location: {
          city,
          province,
          region,
          countryCode,
          lat,
          lng
        },
        rates: Object.keys(rates).length > 0 ? rates : undefined,
        photoUrl: photoUrl || null,
        bio: bio || null,
        curriculum: curriculum || null,
        isActive: true,
        isPremium: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const usersCol = collection(db, 'users');
      const docRef = await addDoc(usersCol, userDoc);

      console.log('[MusiMatch] Profilo musicista creato con ID:', docRef.id);

      if (messageEl) {
        messageEl.textContent = 'Profilo salvato con successo.';
        messageEl.style.color = '#4ade80';
      }

      form.reset();

      // reset X / normalizzazione visuale
      if (instrumentsInput) instrumentsInput.value = '';
      if (mainInstrInput) mainInstrInput.value = '';
      if (instrumentsClearBtn) instrumentsClearBtn.style.display = 'none';
      if (mainInstrClearBtn) mainInstrClearBtn.style.display = 'none';
    } catch (err) {
      console.error('[MusiMatch] Errore salvataggio profilo:', err);
      if (messageEl) {
        messageEl.textContent = err.message || 'Errore durante il salvataggio del profilo.';
        messageEl.style.color = '#f97373';
      }
    }
  });
}
