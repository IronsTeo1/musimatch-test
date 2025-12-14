// public/js/search.js

import { db } from './firebase-config.js';
import {
  collection,
  query,
  where,
  getDocs
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';

const EARTH_RADIUS_KM = 6371;

function degToRad(deg) {
  return deg * Math.PI / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = degToRad(lat2 - lat1);
  const dLng = degToRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
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

function normalizeInstrumentForMatch(raw) {
  return (raw || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function normalizeCity(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

let cityListPromise = null;

/**
 * Carica il dataset completo dei comuni italiani (nome, sigla provincia, regione).
 * Ritorna una promessa con un array di oggetti { name, province, region }.
 */
export function loadCityList() {
  if (!cityListPromise) {
    cityListPromise = fetch('/data/italian-cities.json')
      .then((res) => {
        if (!res.ok) throw new Error('Impossibile caricare la lista città');
        return res.json();
      })
      .then((arr) =>
        (arr || []).map((c) => ({
          name: c.nome,
          province: c.sigla || '',
          region: c.regione?.nome || ''
        }))
      );
  }
  return cityListPromise;
}

export function filterCities(list, term, limit = 15) {
  const normalizedTerm = normalizeCity(term);
  if (!normalizedTerm) return [];

  const scored = list
    .map((c) => {
      const nameNorm = normalizeCity(c.name);
      if (!nameNorm.includes(normalizedTerm)) return null;
      const starts = nameNorm.startsWith(normalizedTerm) ? 0 : 1;
      const exact = nameNorm === normalizedTerm ? -1 : starts;
      return { city: c, score: exact };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.city.name.localeCompare(b.city.name, 'it'));

  return scored.slice(0, limit).map((s) => s.city);
}

export function findCityByName(list, name) {
  const target = normalizeCity(name);
  if (!target) return null;
  const exact = list.find((c) => normalizeCity(c.name) === target);
  if (exact) return exact;
  return list.find((c) => normalizeCity(c.name).startsWith(target)) || null;
}

/**
 * Geocoda una città italiana usando Nominatim (ritorna { lat, lng }).
 * Si affida al nome città scritto nel campo.
 */
export async function geocodeCityName(cityName) {
  const trimmed = (cityName || '').trim();
  if (!trimmed) throw new Error('Inserisci una città');

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'it');
  url.searchParams.set('q', trimmed);

  const res = await fetch(url.toString(), {
    headers: {
      'Accept-Language': 'it'
    }
  });

  if (!res.ok) {
    throw new Error('Errore nel geocoding della città');
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Città non trovata, controlla il nome');
  }

  const first = data[0];
  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error('Coordinate non disponibili per questa città');
  }

  return { lat, lng };
}

/**
 * Trova musicisti/cantanti entro un raggio in km da un punto.
 *
 * @param {Object} options
 * @param {number} options.centerLat
 * @param {number} options.centerLng
 * @param {number} options.radiusKm
 * @param {string|null} options.instrument   es. "trumpet", "soprano"
 * @param {Array<string>} [activityLevels] Opzionale: filtra per livello (professional|amateur)
 * @returns {Promise<Array<{id: string, distanceKm: number, data: any}>>}
 */
export async function findMusiciansNearby({
  centerLat,
  centerLng,
  radiusKm,
  instrument = null,
  activityLevels = [],
  includeSecondary = false
}) {
  const normalizedInstrument = normalizeInstrumentName(instrument) || '';
  const normalizedInstrumentLower = normalizeInstrumentForMatch(normalizedInstrument);
  const singerKeywords = ['cantante', 'voce', 'vocalist'];
  const voiceVariants = [
    'Soprano', 'Mezzosoprano', 'Contralto',
    'Tenore', 'Baritono', 'Basso'
  ];
  const isSingerSearch = normalizedInstrumentLower && singerKeywords.includes(normalizedInstrumentLower);
  const voiceFilters = isSingerSearch ? voiceVariants : [];
  const levelFilters = Array.isArray(activityLevels)
    ? activityLevels
        .map((l) => (l || '').toString().toLowerCase())
        .filter((l) => l === 'professional' || l === 'amateur')
    : [];

  if (Number.isNaN(centerLat) || Number.isNaN(centerLng) || Number.isNaN(radiusKm)) {
    throw new Error('Parametri geografici non validi');
  }

  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(degToRad(centerLat)));

  const minLat = centerLat - latDelta;
  const maxLat = centerLat + latDelta;
  const minLng = centerLng - lngDelta;
  const maxLng = centerLng + lngDelta;

  const usersRef = collection(db, 'users');

  const constraints = [
    where('userType', '==', 'musician'),
    where('location.lat', '>=', minLat),
    where('location.lat', '<=', maxLat),
    where('location.lng', '>=', minLng),
    where('location.lng', '<=', maxLng)
  ];

  // Filtri Firestore solo per voci, altrimenti filtriamo lato client (parziali/case-insensitive)
  if (voiceFilters.length === 1) {
    constraints.push(where('instruments', 'array-contains', voiceFilters[0]));
  } else if (voiceFilters.length > 1) {
    constraints.push(where('instruments', 'array-contains-any', voiceFilters));
  }

  const q = query(usersRef, ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err) {
    console.error('[MusiMatch] Errore Firestore nella query:', err);
    throw err;
  }

  const results = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const loc = data.location || {};
    const docLat = loc.lat;
    const docLng = loc.lng;

    if (typeof docLat !== 'number' || typeof docLng !== 'number') return;

    const distanceKm = haversineDistanceKm(centerLat, centerLng, docLat, docLng);

    if (distanceKm > radiusKm) return;

    // Filtro lato client per strumento parziale/case-insensitive (solo se richiesto)
    if (normalizedInstrument) {
    const allInstruments = Array.isArray(data.instruments) ? data.instruments : [];
    const main = data.mainInstrument ? [data.mainInstrument] : [];
    const haystackSource = includeSecondary ? [...allInstruments, ...main] : main;
    const haystack = haystackSource.map((s) => normalizeInstrumentForMatch(s));

    const matches = haystack.some((s) => s.includes(normalizedInstrumentLower));
    if (!matches) return;
  }

    // filtro livello opzionale
    if (levelFilters.length && !levelFilters.includes((data.activityLevel || '').toLowerCase())) return;

    results.push({
      id: doc.id,
      distanceKm,
      data
    });
  });

  results.sort((a, b) => a.distanceKm - b.distanceKm);

  return results;
}

/**
 * Trova ensemble entro un raggio in km da un punto, filtrando per tipo.
 */
export async function findEnsemblesNearby({ centerLat, centerLng, radiusKm, ensembleType = null }) {
  if (Number.isNaN(centerLat) || Number.isNaN(centerLng) || Number.isNaN(radiusKm)) {
    throw new Error('Parametri geografici non validi');
  }

  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(degToRad(centerLat)));

  const minLat = centerLat - latDelta;
  const maxLat = centerLat + latDelta;
  const minLng = centerLng - lngDelta;
  const maxLng = centerLng + lngDelta;

  const usersRef = collection(db, 'users');

  const constraints = [
    where('userType', '==', 'ensemble'),
    where('location.lat', '>=', minLat),
    where('location.lat', '<=', maxLat),
    where('location.lng', '>=', minLng),
    where('location.lng', '<=', maxLng)
  ];

  if (ensembleType) {
    constraints.push(where('ensembleType', '==', ensembleType));
  }

  const q = query(usersRef, ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err) {
    console.error('[MusiMatch] Errore Firestore nella query ensemble:', err);
    throw err;
  }

  const results = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const loc = data.location || {};
    const docLat = loc.lat;
    const docLng = loc.lng;

    if (typeof docLat !== 'number' || typeof docLng !== 'number') return;

    const distanceKm = haversineDistanceKm(centerLat, centerLng, docLat, docLng);

    if (distanceKm <= radiusKm) {
      results.push({
        id: doc.id,
        distanceKm,
        data
      });
    }
  });

  results.sort((a, b) => a.distanceKm - b.distanceKm);

  return results;
}
