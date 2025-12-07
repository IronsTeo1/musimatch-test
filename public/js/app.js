// public/js/app.js

import { app } from './firebase-config.js';
import { findMusiciansNearby } from './search.js';
import { setupMusicianRegistrationForm } from './musicians.js';

console.log('[MusiMatch] Firebase inizializzato:', app);

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('firebase-status');
  const rootEl = document.documentElement;
  const themeToggleBtn = document.getElementById('theme-toggle');

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

  // ─────────────────────────────────────────
  // Tema chiaro/scuro
  // ─────────────────────────────────────────
  const THEME_KEY = 'musimatch-theme';

  const applyTheme = (theme) => {
    const normalized = theme === 'light' ? 'light' : 'dark';
    rootEl.setAttribute('data-theme', normalized);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = normalized === 'dark' ? '🌗 Tema scuro' : '🌞 Tema chiaro';
    }
    try {
      localStorage.setItem(THEME_KEY, normalized);
    } catch (err) {
      console.warn('[MusiMatch] Impossibile salvare tema in localStorage:', err);
    }
  };

  const storedTheme = (() => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (err) {
      return null;
    }
  })();

  applyTheme(storedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = rootEl.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // Inizializza il form di registrazione musicista/cantante
  setupMusicianRegistrationForm();

  // ─────────────────────────────────────────────
  // Gestione form di ricerca (test)
  // ─────────────────────────────────────────────
  const form = document.getElementById('search-form');
  const resultsList = document.getElementById('search-results');

  if (!form || !resultsList) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    resultsList.innerHTML = '<li>Ricerca in corso...</li>';

    const centerLat = parseFloat(document.getElementById('center-lat').value);
    const centerLng = parseFloat(document.getElementById('center-lng').value);
    const radiusKm = parseFloat(document.getElementById('radius-km').value);
    const instrumentRaw = document.getElementById('instrument').value.trim();
    const instrument = instrumentRaw !== '' ? instrumentRaw : null;

    try {
      const musicians = await findMusiciansNearby({
        centerLat,
        centerLng,
        radiusKm,
        instrument
      });

      if (musicians.length === 0) {
        resultsList.innerHTML = '<li>Nessun musicista disponibile in zona, prova ad allargare il raggio di ricerca.</li>';
        return;
      }

      resultsList.innerHTML = '';

      for (const m of musicians) {
        const li = document.createElement('li');
        const data = m.data;
        const loc = data.location || {};
        const instruments = Array.isArray(data.instruments)
          ? data.instruments.join(', ')
          : 'strumento non indicato';

        const rates = data.rates || {};
        const activityLevel = data.activityLevel || 'n.d.';
        const willingFree = data.willingToJoinForFree ? 'In cerca di un gruppo stabile' : '';

        const rateRehearsal = rates.rehearsal != null ? `${rates.rehearsal}€ prova` : '';
        const rateConcert = rates.concert_or_mass != null ? `${rates.concert_or_mass}€ concerto/messa` : '';
        const rateService = rates.service_civil_religious != null ? `${rates.service_civil_religious}€ serv. civile/religioso` : '';
        const rateTrumpet = rates.service_civil_trumpet_full != null ? `${rates.service_civil_trumpet_full}€ serv. civile (squilli+silenzio)` : '';

        const ratesParts = [
          rateRehearsal,
          rateConcert,
          rateService,
          rateTrumpet
        ].filter(Boolean);

        const ratesText = ratesParts.length > 0
          ? ' | Tariffe: ' + ratesParts.join(' – ')
          : '';

        const activityLabel =
          activityLevel === 'professional' ? 'Professionista' :
          activityLevel === 'amateur' ? 'Amatore' :
          activityLevel;

        li.textContent =
          `${data.displayName || 'Senza nome'} ` +
          `– ${instruments} ` +
          `– ${loc.city || '?'} (${loc.province || ''}) ` +
          `– ${activityLabel} ` +
          `– distanza: ${m.distanceKm.toFixed(1)} km` +
          ratesText +
          (willingFree ? ` | ${willingFree}` : '');

        resultsList.appendChild(li);
      }
    } catch (error) {
      console.error('[MusiMatch] Errore nella ricerca:', error);
      resultsList.innerHTML = '<li>Errore nella ricerca (vedi console).</li>';
    }
  });
});
