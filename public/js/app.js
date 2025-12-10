// public/js/app.js

import { app } from './firebase-config.js';
import {
  findMusiciansNearby,
  findEnsemblesNearby,
  loadCityList,
  filterCities,
  findCityByName,
  geocodeCityName
} from './search.js';

const LAST_PROFILE_NAME_KEY = 'musimatch-last-profile-name';

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

function normalizeGenderSlug(raw) {
  const g = (raw || '').toString().toLowerCase();
  if (g === 'male' || g === 'female' || g === 'non_binary') return g;
  return 'unknown';
}

function setLastProfileName(name) {
  try {
    sessionStorage.setItem(LAST_PROFILE_NAME_KEY, name || '');
  } catch (e) {
    // ignore
  }
}

// Bust cache degli avatar locali automaticamente (una volta al giorno)
const AVATAR_VERSION = (() => {
  const key = 'musimatch-avatar-version';
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    sessionStorage.setItem(key, today);
    return today;
  } catch (e) {
    return today;
  }
})();

function buildAvatarCandidates(data, searchTarget) {
  const base = 'assets/img/avatars';
  const gender = normalizeGenderSlug(data?.gender);
  const candidates = [];

  if (data?.photoUrl) candidates.push(data.photoUrl);

  if (searchTarget === 'ensembles') {
    const ensembleSlug = (data?.ensembleType || '').toString().toLowerCase();
    if (ensembleSlug) candidates.push(`${base}/avatar-ensemble/avatar-${ensembleSlug}.png?v=${AVATAR_VERSION}`);
    candidates.push(`${base}/avatar-ensemble/avatar-ensemble.png?v=${AVATAR_VERSION}`);
  } else {
    if (data?.role === 'singer') {
      candidates.push(`${base}/avatar-cantante-${gender}.png?v=${AVATAR_VERSION}`);
      candidates.push(`${base}/avatar-cantante-unknown.png?v=${AVATAR_VERSION}`);
    } else {
      const instrumentSlug = data?.mainInstrumentSlug || slugifyInstrument(data?.mainInstrument || '');
      if (instrumentSlug) candidates.push(`${base}/avatar-${instrumentSlug}-${gender}.png?v=${AVATAR_VERSION}`);
    }
  }

  candidates.push(`${base}/avatar-default/avatar-default-${gender}.png?v=${AVATAR_VERSION}`);
  candidates.push(`${base}/avatar-default/avatar-default-unknown.png?v=${AVATAR_VERSION}`);
  return candidates;
}

document.addEventListener('DOMContentLoaded', () => {
  // ─────────────────────────────────────────────
  // Gestione form di ricerca (test)
  // ─────────────────────────────────────────────
  const form = document.getElementById('search-form');
  const resultsList = document.getElementById('search-results');
  const cityInput = document.getElementById('center-city');
  const citySuggestionBox = document.getElementById('city-suggestions');
  const instrumentField = document.getElementById('instrument-field');
  const levelFiltersBox = document.getElementById('level-filters');
  const levelFilterPro = document.getElementById('filter-level-pro');
  const levelFilterAma = document.getElementById('filter-level-ama');
  const includeSecondaryEl = document.getElementById('filter-include-secondary');
  const ensembleFilter = document.getElementById('ensemble-filter');
  const ensembleTypeSelect = document.getElementById('ensemble-type');
  const searchTargetRadios = document.querySelectorAll('input[name="search-target"]');
  let cityList = [];

  if (!form || !resultsList) return;

  // Carica il dataset dei comuni italiani per i suggerimenti
  loadCityList()
    .then((list) => {
      cityList = list;
    })
    .catch((err) => {
      console.error('[MusiMatch] Errore caricamento lista città:', err);
    });

  // ─────────────────────────────────────────
  // Autocomplete città (apre solo mentre digiti)
  // ─────────────────────────────────────────
  const renderCitySuggestions = (term) => {
    if (!citySuggestionBox) return;
    citySuggestionBox.innerHTML = '';

    if (!term) {
      citySuggestionBox.hidden = true;
      return;
    }

    const matches = filterCities(cityList, term, 8);
    if (matches.length === 0) {
      citySuggestionBox.hidden = true;
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
        e.preventDefault(); // evita blur immediato
        if (cityInput) {
          cityInput.value = c.name;
          cityInput.dataset.selectedCity = c.name;
        }
        citySuggestionBox.hidden = true;
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (cityInput) {
            cityInput.value = c.name;
            cityInput.dataset.selectedCity = c.name;
            cityInput.focus();
          }
          citySuggestionBox.hidden = true;
        }
      });
      citySuggestionBox.appendChild(item);
    });

    citySuggestionBox.hidden = false;
  };

  if (cityInput) {
    cityInput.addEventListener('input', (e) => {
      cityInput.dataset.selectedCity = '';
      renderCitySuggestions(e.target.value);
    });

    cityInput.addEventListener('blur', () => {
      // ritardo per permettere click su suggerimento
      setTimeout(() => {
        if (citySuggestionBox) citySuggestionBox.hidden = true;
      }, 150);
    });
  }

  const syncFieldsVisibility = () => {
    const target = document.querySelector('input[name="search-target"]:checked')?.value || 'musicians';
    if (instrumentField) instrumentField.style.display = target === 'musicians' ? 'block' : 'none';
    if (ensembleFilter) ensembleFilter.style.display = target === 'ensembles' ? 'block' : 'none';
  };
  searchTargetRadios.forEach((r) => r.addEventListener('change', syncFieldsVisibility));
  syncFieldsVisibility();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    resultsList.innerHTML = '<div class="result-card muted">Ricerca in corso...</div>';

    const cityName = cityInput ? cityInput.value.trim() : '';
    const radiusKm = parseFloat(document.getElementById('radius-km').value);
    const instrumentRaw = document.getElementById('instrument').value.trim();
    const instrument = instrumentRaw !== '' ? instrumentRaw : null;
    const searchTarget = document.querySelector('input[name="search-target"]:checked')?.value || 'musicians';
    const ensembleType = ensembleTypeSelect ? ensembleTypeSelect.value : '';
    const activityLevels = [];
    if (levelFilterPro?.checked) activityLevels.push('professional');
    if (levelFilterAma?.checked) activityLevels.push('amateur');
    const includeSecondary = !!includeSecondaryEl?.checked;

    try {
      const chosenCity = findCityByName(cityList, cityName);
      if (!chosenCity) {
        throw new Error('Seleziona una città valida digitando e scegliendo un suggerimento.');
      }

      const coords = await geocodeCityName(cityName);

      let results = [];
      if (searchTarget === 'ensembles') {
        results = await findEnsemblesNearby({
          centerLat: coords.lat,
          centerLng: coords.lng,
          radiusKm,
          ensembleType: ensembleType || null
        });
      } else {
        results = await findMusiciansNearby({
          centerLat: coords.lat,
          centerLng: coords.lng,
          radiusKm,
          instrument,
          activityLevels,
          includeSecondary
        });
      }

      if (results.length === 0) {
        resultsList.innerHTML = '<div class="result-card muted">Nessun risultato, prova ad allargare il raggio o cambiare filtri.</div>';
        return;
      }

      resultsList.innerHTML = '';

      for (const r of results) {
        const card = document.createElement('article');
        card.className = 'result-card';

        const data = r.data;
        const loc = data.location || {};
        const profileUrl = `profile.html?id=${r.id}`;

        const instruments = Array.isArray(data.instruments)
          ? data.instruments.join(', ')
          : null;
        const mainInstr = data.mainInstrument || '';
        const activityLevel = data.activityLevel === 'professional'
          ? 'Professionista'
          : data.activityLevel === 'amateur'
            ? 'Amatore'
            : '';

        const ensembleLabel = data.ensembleType === 'choir'
          ? 'Coro'
          : data.ensembleType === 'band'
            ? 'Banda'
            : data.ensembleType === 'orchestra'
              ? 'Orchestra'
              : 'Ensemble';

        const title = document.createElement('a');
        title.href = profileUrl;
        title.textContent = data.displayName || 'Senza nome';
        title.className = 'result-title';
        title.addEventListener('click', () => setLastProfileName(data.displayName || ''));
        card.addEventListener('click', () => setLastProfileName(data.displayName || ''));

        const subtitle = document.createElement('div');
        subtitle.className = 'muted';
        if (searchTarget === 'ensembles') {
          subtitle.textContent = `${ensembleLabel} · ${loc.city || '?'} ${loc.province ? '(' + loc.province + ')' : ''}`;
        } else {
          const secondary = Array.isArray(data.instruments)
            ? data.instruments.filter((inst) => inst && inst !== mainInstr)
            : [];
          const secondaryText = secondary.length ? secondary.join(', ') : '—';
          subtitle.innerHTML = `
            <div><strong>${mainInstr || 'Strumento non indicato'}</strong> · ${activityLevel || '—'}</div>
            <div>Altri: ${secondaryText}</div>
            <div>Residente in: ${loc.city || '?'} ${loc.province ? '(' + loc.province + ')' : ''}</div>
          `;
        }

        const meta = document.createElement('div');
        meta.className = 'muted small';
        meta.textContent = `Distanza: ${r.distanceKm.toFixed(1)} km`;

        const thumb = document.createElement('div');
        thumb.className = 'avatar-placeholder';
        const img = document.createElement('img');
        img.alt = data.displayName || 'Avatar';
        const avatarQueue = buildAvatarCandidates(data, searchTarget);
        const applyNext = () => {
          const next = avatarQueue.shift();
          if (!next) {
            img.remove();
            thumb.textContent = '👤';
            return;
          }
          img.onerror = applyNext;
          img.src = next;
          thumb.appendChild(img);
        };
        applyNext();

        const body = document.createElement('div');
        body.className = 'result-body';
        body.appendChild(title);
        body.appendChild(subtitle);
        body.appendChild(meta);

        card.appendChild(thumb);
        card.appendChild(body);
        resultsList.appendChild(card);
      }
    } catch (error) {
      console.error('[MusiMatch] Errore nella ricerca:', error);
      resultsList.innerHTML = `<div class="result-card muted">${error.message || 'Errore nella ricerca (vedi console).'}</div>`;
    }
  });
});
