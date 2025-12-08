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

console.log('[MusiMatch] Firebase inizializzato:', app);

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('firebase-status');

  const isLocalhost =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';

  if (statusEl) {
    let text = `Firebase inizializzato. Project ID: ${app.options.projectId}`;
    text += isLocalhost
      ? ' (EMULATORI attivi)'
      : ' (progetto remoto)';
    statusEl.textContent = text;
  }

  // ─────────────────────────────────────────────
  // Gestione form di ricerca (test)
  // ─────────────────────────────────────────────
  const form = document.getElementById('search-form');
  const resultsList = document.getElementById('search-results');
  const cityInput = document.getElementById('center-city');
  const citySuggestionBox = document.getElementById('city-suggestions');
  const instrumentField = document.getElementById('instrument-field');
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
          instrument
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

        const subtitle = document.createElement('div');
        subtitle.className = 'muted';
        if (searchTarget === 'ensembles') {
          subtitle.textContent = `${ensembleLabel} · ${loc.city || '?'} ${loc.province ? '(' + loc.province + ')' : ''}`;
        } else {
          subtitle.textContent = `${instruments || 'strumento non indicato'} · ${activityLevel || ''} · ${loc.city || '?'} ${loc.province ? '(' + loc.province + ')' : ''}`;
        }

        const meta = document.createElement('div');
        meta.className = 'muted small';
        meta.textContent = `Distanza: ${r.distanceKm.toFixed(1)} km`;

        const thumb = document.createElement('div');
        thumb.className = 'avatar-placeholder';

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
