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

/**
 * Trova musicisti/cantanti entro un raggio in km da un punto.
 *
 * @param {Object} options
 * @param {number} options.centerLat
 * @param {number} options.centerLng
 * @param {number} options.radiusKm
 * @param {string|null} options.instrument   es. "trumpet", "voice_soprano"
 * @returns {Promise<Array<{id: string, distanceKm: number, data: any}>>}
 */
export async function findMusiciansNearby({ centerLat, centerLng, radiusKm, instrument = null }) {
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

  if (instrument) {
    constraints.push(where('instruments', 'array-contains', instrument));
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
    const lat = loc.lat;
    const lng = loc.lng;

    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const distanceKm = haversineDistanceKm(centerLat, centerLng, lat, lng);

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
