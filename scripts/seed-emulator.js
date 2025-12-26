#!/usr/bin/env node
/**
 * Seed the Firebase emulator (Auth + Firestore) with test accounts and profiles.
 * Requires the emulators to be running (Auth + Firestore).
 *
 * All test users share the password: 123456
 */

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8084';
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  'musimatch-test';

const AUTH_BASE = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1`;
const FS_BASE = `http://${FS_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const DEFAULT_PASSWORD = '123456';
const ONE_MINUTE = 60 * 1000;

function slugifyInstrument(raw) {
  if (!raw) return null;
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || null;
}

function encodeValue(val) {
  if (val === null) return { nullValue: null };
  if (val === undefined) return null;
  if (val === true || val === false) return { booleanValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((v) => encodeValue(v)).filter(Boolean) } };
  }
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(val)
            .map(([k, v]) => [k, encodeValue(v)])
            .filter(([, v]) => v !== null)
        )
      }
    };
  }
  return { stringValue: String(val) };
}

function encodeFields(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => [k, encodeValue(v)])
      .filter(([, v]) => v !== null)
  );
}

async function signUpOrSignIn(email, password = DEFAULT_PASSWORD) {
  const payload = { email, password, returnSecureToken: true };
  const signUp = await fetch(`${AUTH_BASE}/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const signUpJson = await signUp.json();
  if (signUp.ok) return signUpJson.localId;

  if (signUpJson?.error?.message === 'EMAIL_EXISTS') {
    const signIn = await fetch(`${AUTH_BASE}/accounts:signInWithPassword?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const signInJson = await signIn.json();
    if (!signIn.ok) {
      throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(signInJson)}`);
    }
    return signInJson.localId;
  }

  throw new Error(`Sign-up failed for ${email}: ${JSON.stringify(signUpJson)}`);
}

async function upsertUserDoc(docId, data) {
  const body = JSON.stringify({ fields: encodeFields(data) });
  const patchUrl = `${FS_BASE}/users/${docId}`;
  let res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  if (res.ok) return;

  if (res.status === 404) {
    const createUrl = `${FS_BASE}/users?documentId=${encodeURIComponent(docId)}`;
    res = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    if (res.ok) return;
  }

  const errorText = await res.text();
  throw new Error(`Firestore upsert failed for ${docId}: ${res.status} ${errorText}`);
}

async function upsertPostDoc(docId, data) {
  const body = JSON.stringify({ fields: encodeFields(data) });
  const patchUrl = `${FS_BASE}/posts/${docId}`;
  let res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  if (res.ok) return;

  if (res.status === 404) {
    const createUrl = `${FS_BASE}/posts?documentId=${encodeURIComponent(docId)}`;
    res = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    if (res.ok) return;
  }

  const errorText = await res.text();
  throw new Error(`Firestore upsert failed for post ${docId}: ${res.status} ${errorText}`);
}

function prepareDoc(profile, uid, now) {
  const doc = {
    authUid: uid,
    email: profile.email,
    displayName: profile.displayName,
    createdAt: profile.createdAt || now,
    updatedAt: now,
    ...profile.data
  };

  if (!doc.userType && doc.role) doc.userType = 'musician';
  if (doc.userType === 'musician') {
    doc.role = doc.role || 'musician';
    doc.isActive = doc.isActive ?? true;
    doc.isPremium = doc.isPremium ?? false;
    if (doc.mainInstrument && !doc.mainInstrumentSlug) {
      doc.mainInstrumentSlug = slugifyInstrument(doc.mainInstrument);
    }
  }

  if (doc.userType === 'ensemble') {
    doc.ensembleMembers =
      doc.ensembleMembers !== undefined ? doc.ensembleMembers : doc.members ?? null;
  }

  return doc;
}

function normalizeLocation(loc = {}) {
  if (!loc || typeof loc !== 'object') return null;
  const { city, province, region, countryCode, lat, lng, street, streetNumber } = loc;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    city: city || '',
    province: province || '',
    region: region || '',
    countryCode: countryCode || '',
    lat,
    lng,
    street: street || null,
    streetNumber: streetNumber || null
  };
}

function cleanArray(arr) {
  if (!Array.isArray(arr)) return null;
  const filtered = arr.map((v) => (typeof v === 'string' ? v.trim() : v)).filter(Boolean);
  return filtered.length ? filtered : null;
}

function cleanObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && !v.trim()) return;
    if (Array.isArray(v)) {
      const cleaned = cleanArray(v);
      if (cleaned) out[k] = cleaned;
      return;
    }
    out[k] = v;
  });
  return Object.keys(out).length ? out : null;
}

function buildPostPayload(userEntry, def, createdAt) {
  const baseData = userEntry?.data || {};
  const authorName = baseData.displayName || baseData.name || 'Profilo';
  const authorLocation = normalizeLocation(baseData.location) || null;
  const postLocation = normalizeLocation(def.location || baseData.location) || authorLocation;
  const locationAlt = normalizeLocation(def.locationAlt);
  const authorAvatar =
    baseData.photoUrl ||
    baseData.photoURL ||
    baseData.avatarUrl ||
    (baseData.mainInstrumentSlug ? `/assets/img/avatars/avatar-${baseData.mainInstrumentSlug}-unknown.webp` : null) ||
    null;

  const instrumentsWanted = cleanArray(def.instrumentsWanted);
  const voicesWanted = cleanArray(def.voicesWanted);
  const offerDetails = cleanObject(def.offerDetails);

  return {
    authorUid: userEntry.uid,
    authorUserId: userEntry.docId,
    authorName,
    authorType: baseData.userType || 'musician',
    authorPhotoUrl: authorAvatar,
    authorAvatarUrl: authorAvatar,
    authorProfileData: cleanObject({
      userType: baseData.userType || 'musician',
      role: baseData.role || '',
      activityLevel: baseData.activityLevel || '',
      gender: baseData.gender || '',
      mainInstrument: baseData.mainInstrument || '',
      mainInstrumentSlug: baseData.mainInstrumentSlug || slugifyInstrument(baseData.mainInstrument || ''),
      instruments: cleanArray(baseData.instruments),
      voiceType: baseData.voiceType || '',
      voiceTypeSecondary: baseData.voiceTypeSecondary || '',
      ensembleType: baseData.ensembleType || '',
      photoUrl: baseData.photoUrl || '',
      photoURL: baseData.photoURL || '',
      avatarUrl: baseData.avatarUrl || ''
    }),
    body: def.body || '',
    postType: def.postType || 'seeking',
    offerDetails,
    instrumentsWanted,
    voicesWanted,
    ensembleWanted: def.ensembleWanted || null,
    radiusKm: typeof def.radiusKm === 'number' ? def.radiusKm : baseData.maxTravelKm || 50,
    authorLocation,
    location: postLocation,
    locationAlt: locationAlt || null,
    resolved: !!def.resolved,
    createdAt,
    updatedAt: createdAt
  };
}

const POST_DEFINITIONS = [
  {
    docId: 'user-giulia-verdi',
    posts: [
      {
        suffix: 'coro-lombardia',
        postType: 'seeking',
        body: 'Cerco coro da camera o ensemble vocale in Lombardia per programmi sacri/concertistici nel 2025.',
        voicesWanted: ['Soprano'],
        ensembleWanted: 'coro da camera',
        radiusKm: 80
      },
      {
        suffix: 'soprano-liturgia',
        postType: 'offering',
        body: 'Soprano lirico disponibile per matrimoni e liturgia (repertorio sacro e barocco).',
        offerDetails: {
          offerContext: 'Matrimoni e liturgia',
          offerRole: 'Soprano lirico',
          services: true,
          concerts: true,
          genre: 'sacro/barocco',
          rehearsal: '2 prove incluse',
          hourlyRate: 180
        },
        radiusKm: 100
      },
      {
        suffix: 'recital-piano',
        postType: 'seeking',
        body: 'Recital di arie da camera: cerco pianista accompagnatore disponibile a breve.',
        instrumentsWanted: ['Pianoforte'],
        resolved: true,
        radiusKm: 40
      }
    ]
  },
  {
    docId: 'user-luca-rossi',
    posts: [
      {
        suffix: 'cover-band',
        postType: 'seeking',
        body: 'Cerco batterista per cover band rock, prove serali in Torino.',
        instrumentsWanted: ['Batteria'],
        radiusKm: 20
      },
      {
        suffix: 'chitarra-gig',
        postType: 'offering',
        body: 'Chitarrista elettrico disponibile per live rock/indie, pedali e ampli propri.',
        offerDetails: {
          offerContext: 'Live e sostituzioni',
          offerRole: 'Chitarrista elettrico',
          concerts: true,
          genre: 'rock/indie',
          format: 'power trio / quartetto',
          hourlyRate: 30
        },
        radiusKm: 30
      },
      {
        suffix: 'acustico-duo',
        postType: 'seeking',
        body: 'Valuto cantante per duo acustico chitarra/voce su repertorio pop.',
        voicesWanted: ['Cantante'],
        ensembleWanted: 'duo acustico',
        resolved: false,
        radiusKm: 25
      }
    ]
  },
  {
    docId: 'user-francesca-rosa',
    posts: [
      {
        suffix: 'quartetto-archi',
        postType: 'offering',
        body: "Violino principale per quartetto d'archi, disponibile per cerimonie ed eventi.",
        offerDetails: {
          concerts: true,
          genre: 'classico',
          format: "quartetto d'archi",
          rehearsal: '1 prova inclusa',
          hourlyRate: 220
        },
        radiusKm: 70
      },
      {
        suffix: 'cerco-archi',
        postType: 'seeking',
        body: 'Cerco viola e violoncello per formare nuovo quartetto stabile a Verona.',
        instrumentsWanted: ['Viola', 'Violoncello'],
        ensembleWanted: 'quartetto',
        radiusKm: 50
      },
      {
        suffix: 'cerimonie-verona',
        postType: 'offering',
        body: 'Disponibile per cerimonie civili/religiose con repertorio classico e barocco.',
        offerDetails: {
          services: true,
          concerts: true,
          genre: 'classico/barocco',
          hourlyRate: 180
        },
        resolved: true,
        radiusKm: 60
      }
    ]
  },
  {
    docId: 'user-marco-bianchi',
    posts: [
      {
        suffix: 'servizi-civili',
        postType: 'offering',
        body: 'Trombettista per servizi civili e religiosi, squilli cerimoniali inclusi.',
        offerDetails: {
          offerContext: 'Servizi civili/religiosi',
          services: true,
          concerts: true,
          genre: 'cerimoniale',
          hourlyRate: 150
        },
        radiusKm: 120
      },
      {
        suffix: 'banda-stagione',
        postType: 'seeking',
        body: 'Cerco ingaggi come prima tromba in banda o orchestra di fiati, zona Campania/Lazio.',
        ensembleWanted: 'banda/orchestra di fiati',
        radiusKm: 150
      },
      {
        suffix: 'lezioni-tromba',
        postType: 'offering',
        body: 'Lezioni private di tromba per preparazione esami e bande giovanili.',
        offerDetails: {
          teachInstruments: true,
          instruments: ['Tromba'],
          hourlyRate: 35,
          rehearsal: 'Disponibile anche online'
        },
        resolved: false,
        radiusKm: 80
      }
    ]
  },
  {
    docId: 'user-roberto-viola',
    posts: [
      {
        suffix: 'spalla-viola',
        postType: 'offering',
        body: 'Viola di fila/spalla disponibile per produzioni sinfoniche e cameristiche.',
        offerDetails: {
          concerts: true,
          genre: 'sinfonico/cameristico',
          format: 'orchestra/ensemble',
          hourlyRate: 180
        },
        radiusKm: 60
      },
      {
        suffix: 'cerca-quartetto',
        postType: 'seeking',
        body: 'Cerco quartetto stabile in Toscana per repertorio classico e moderno.',
        ensembleWanted: "quartetto d'archi",
        radiusKm: 80
      },
      {
        suffix: 'sub-viola',
        postType: 'offering',
        body: 'Disponibile come sub a breve preavviso per orchestre e cori sinfonici.',
        offerDetails: {
          concerts: true,
          genre: 'sinfonico',
          format: 'orchestra',
          hourlyRate: 150
        },
        locationAlt: {
          city: 'Pisa',
          province: 'PI',
          region: 'Toscana',
          countryCode: 'IT',
          lat: 43.7167,
          lng: 10.4036
        },
        resolved: true,
        radiusKm: 90
      }
    ]
  },
  {
    docId: 'user-banda-san-carlo',
    posts: [
      {
        suffix: 'cerca-percussioni',
        postType: 'seeking',
        body: 'Cerchiamo percussionista per stagione estiva di parate e concerti.',
        instrumentsWanted: ['Percussioni'],
        radiusKm: 80
      },
      {
        suffix: 'band-eventi',
        postType: 'offering',
        body: 'Banda disponibile per feste patronali e cortei, repertorio tradizionale.',
        offerDetails: {
          concerts: true,
          services: true,
          genre: 'tradizionale',
          format: 'parata',
          hourlyRate: 400
        },
        radiusKm: 120
      },
      {
        suffix: 'cerca-fiati',
        postType: 'seeking',
        body: 'Inseriamo 1 cornetta e 1 sax contralto per rinforzo sezione fiati.',
        instrumentsWanted: ['Cornetta', 'Sax contralto'],
        resolved: false,
        locationAlt: {
          city: 'Reggio Emilia',
          province: 'RE',
          region: 'Emilia-Romagna',
          countryCode: 'IT',
          lat: 44.6983,
          lng: 10.6313
        },
        radiusKm: 100
      }
    ]
  },
  {
    docId: 'user-coro-santa-maria',
    posts: [
      {
        suffix: 'cerca-tenori-bassi',
        postType: 'seeking',
        body: 'Selezioniamo tenori e bassi per il programma polifonico di primavera.',
        voicesWanted: ['Tenore', 'Basso'],
        radiusKm: 60
      },
      {
        suffix: 'coro-matrimoni',
        postType: 'offering',
        body: 'Coro disponibile per matrimoni e liturgie, repertorio classico e gospel.',
        offerDetails: {
          services: true,
          concerts: true,
          genre: 'sacro/gospel',
          format: 'coro misto',
          hourlyRate: 250
        },
        radiusKm: 120
      },
      {
        suffix: 'progetto-natalizio',
        postType: 'seeking',
        body: 'Progetto natalizio: cerchiamo organista e baritono per concerto di dicembre.',
        instrumentsWanted: ['Organo'],
        voicesWanted: ['Baritono'],
        resolved: true,
        radiusKm: 80
      }
    ]
  },
  {
    docId: 'user-orchestra-filarmonica',
    posts: [
      {
        suffix: 'audizioni-bassi',
        postType: 'seeking',
        body: 'Audizioni straordinarie: contrabbasso e timpani per stagione sinfonica 2025.',
        instrumentsWanted: ['Contrabbasso', 'Timpani'],
        radiusKm: 150
      },
      {
        suffix: 'eventi-aziendali',
        postType: 'offering',
        body: 'Orchestra disponibile per eventi corporate con repertorio pop-sinfonico.',
        offerDetails: {
          concerts: true,
          genre: 'pop-sinfonico',
          format: 'orchestra',
          setupNotes: 'Richiesta pedana e service audio',
          hourlyRate: 1200
        },
        radiusKm: 200
      },
      {
        suffix: 'audizioni-archi',
        postType: 'seeking',
        body: 'Call archi aggiunti: violino II e viola, prove a Torino.',
        instrumentsWanted: ['Violino', 'Viola'],
        resolved: true,
        radiusKm: 120
      }
    ]
  },
  {
    docId: 'user-tenore-rossi',
    posts: [
      {
        suffix: 'tenore-pop',
        postType: 'offering',
        body: 'Tenore leggero disponibile per cori pop/liturgici e small ensemble.',
        offerDetails: {
          concerts: true,
          genre: 'pop/corale',
          format: 'coro pop',
          hourlyRate: 80
        },
        radiusKm: 50
      },
      {
        suffix: 'cerca-pianista',
        postType: 'seeking',
        body: 'Cerco pianista o chitarrista acustico per duo voce/strumento a Roma.',
        instrumentsWanted: ['Pianoforte', 'Chitarra acustica'],
        radiusKm: 40
      },
      {
        suffix: 'matrimoni-tenore',
        postType: 'offering',
        body: 'Disponibile per canti liturgici matrimonio (tenore) con brani pop/gospel.',
        offerDetails: {
          services: true,
          concerts: true,
          genre: 'gospel/pop',
          hourlyRate: 90
        },
        resolved: true,
        radiusKm: 60
      }
    ]
  },
  {
    docId: 'user-chiara-neri',
    posts: [
      {
        suffix: 'barocco-mezzo',
        postType: 'offering',
        body: 'Mezzosoprano per ensemble barocco, disponibile per cantate e oratori.',
        offerDetails: {
          concerts: true,
          genre: 'barocco',
          format: 'ensemble da camera',
          hourlyRate: 250
        },
        radiusKm: 120
      },
      {
        suffix: 'cerca-ensemble-barocco',
        postType: 'seeking',
        body: 'Cerco ensemble barocco/da camera in Puglia per collaborazione stabile.',
        ensembleWanted: 'ensemble barocco',
        radiusKm: 120
      },
      {
        suffix: 'lezioni-voce',
        postType: 'offering',
        body: 'Lezioni di tecnica vocale belcanto (mezzosoprano/contralto) anche online.',
        offerDetails: {
          teachSinging: true,
          offerContext: 'Lezioni private',
          genre: 'belcanto',
          hourlyRate: 40
        },
        resolved: false,
        radiusKm: 80
      }
    ]
  },
  {
    docId: 'user-antonio-falco',
    posts: [
      {
        suffix: 'basso-sinfonico',
        postType: 'offering',
        body: 'Basso profondo per cori sinfonici e liturgia solenne.',
        offerDetails: {
          concerts: true,
          services: true,
          genre: 'sinfonico/sacro',
          hourlyRate: 200
        },
        radiusKm: 80
      },
      {
        suffix: 'cerca-baritono',
        postType: 'seeking',
        body: 'Cerco baritono per duetti sacri/concertistici, preparazione rapido.',
        voicesWanted: ['Baritono'],
        radiusKm: 50
      },
      {
        suffix: 'rassegna-corale',
        postType: 'offering',
        body: 'Disponibile per rassegne corali come solista basso e sezioni gravi.',
        offerDetails: {
          concerts: true,
          genre: 'corale',
          format: 'coro misto',
          hourlyRate: 160
        },
        resolved: true,
        radiusKm: 70
      }
    ]
  },
  {
    docId: 'user-alessio-greco',
    posts: [
      {
        suffix: 'rock-cover',
        postType: 'offering',
        body: 'Batterista per cover rock/pop, disponibile per date weekend.',
        offerDetails: {
          concerts: true,
          genre: 'rock/pop',
          format: 'cover band',
          hourlyRate: 25
        },
        radiusKm: 25
      },
      {
        suffix: 'cerca-basso',
        postType: 'seeking',
        body: 'Cerco bassista e cantante per trio cover, prove a Cagliari.',
        instrumentsWanted: ['Basso elettrico'],
        voicesWanted: ['Cantante'],
        ensembleWanted: 'trio cover',
        radiusKm: 20
      },
      {
        suffix: 'lezioni-cajon',
        postType: 'offering',
        body: 'Mini-corso di cajon/percussioni leggere per principianti.',
        offerDetails: {
          teachInstruments: true,
          instruments: ['Cajon'],
          hourlyRate: 15,
          rehearsal: 'Lezioni serali'
        },
        resolved: true,
        radiusKm: 15
      }
    ]
  },
  {
    docId: 'user-ilaria-fontana',
    posts: [
      {
        suffix: 'organo-liturgia',
        postType: 'offering',
        body: 'Organista disponibile per liturgie e messe solenni, repertorio classico.',
        offerDetails: {
          services: true,
          concerts: true,
          genre: 'sacro',
          format: 'organo solo',
          hourlyRate: 200
        },
        radiusKm: 150
      },
      {
        suffix: 'accompagnamento-coro',
        postType: 'offering',
        body: 'Pianista/organista per accompagnamento cori e rassegne, anche trasporti rapidi.',
        offerDetails: {
          concerts: true,
          services: true,
          offerContext: 'Accompagnamento coro',
          genre: 'corale',
          hourlyRate: 180
        },
        radiusKm: 120
      },
      {
        suffix: 'cerco-solisti',
        postType: 'seeking',
        body: 'Cerco soprano e tenore per cantata con organo a Perugia.',
        voicesWanted: ['Soprano', 'Tenore'],
        radiusKm: 80
      }
    ]
  },
  {
    docId: 'user-nicole-mendes',
    posts: [
      {
        suffix: 'funk-jazz',
        postType: 'offering',
        body: 'Sassofonista (alto) per funk/jazz, disponibile per tour brevi e club.',
        offerDetails: {
          concerts: true,
          genre: 'funk/jazz',
          format: 'quartetto/quintetto',
          hourlyRate: 120
        },
        radiusKm: 90
      },
      {
        suffix: 'lezioni-sax',
        postType: 'offering',
        body: 'Lezioni di sax contralto e flauto, tecniche improv e lettura.',
        offerDetails: {
          teachInstruments: true,
          instruments: ['Sax contralto', 'Flauto'],
          hourlyRate: 35,
          offerContext: 'Didattica'
        },
        radiusKm: 60
      },
      {
        suffix: 'cerca-tastierista',
        postType: 'seeking',
        body: 'Cerco tastierista per progetto funk con sezione fiati a Genova.',
        instrumentsWanted: ['Tastiera'],
        locationAlt: {
          city: 'Savona',
          province: 'SV',
          region: 'Liguria',
          countryCode: 'IT',
          lat: 44.3091,
          lng: 8.4772
        },
        resolved: false,
        radiusKm: 70
      }
    ]
  },
  {
    docId: 'user-davide-marini',
    posts: [
      {
        suffix: 'sub-bass',
        postType: 'offering',
        body: 'Bassista elettrico disponibile come sub last-minute per date rock.',
        offerDetails: {
          concerts: true,
          genre: 'rock',
          format: 'cover band',
          hourlyRate: 40
        },
        radiusKm: 50
      },
      {
        suffix: 'cerca-sezione',
        postType: 'seeking',
        body: 'Cerco batterista e chitarrista elettrico per nuovo progetto alternative.',
        instrumentsWanted: ['Batteria', 'Chitarra elettrica'],
        radiusKm: 40
      },
      {
        suffix: 'trio-acustico',
        postType: 'seeking',
        body: 'Vorrei formare trio acustico basso/chitarra/voce per locali nelle Marche.',
        ensembleWanted: 'trio acustico',
        resolved: true,
        radiusKm: 60
      }
    ]
  },
  {
    docId: 'user-coro-gospel-milano',
    posts: [
      {
        suffix: 'cerca-voci',
        postType: 'seeking',
        body: 'Cerchiamo tenori e contralti per sezione coro gospel, prove a Monza.',
        voicesWanted: ['Tenore', 'Contralto'],
        radiusKm: 50
      },
      {
        suffix: 'gospel-matrimoni',
        postType: 'offering',
        body: 'Coro gospel con band interno disponibile per matrimoni ed eventi aziendali.',
        offerDetails: {
          services: true,
          concerts: true,
          genre: 'gospel',
          format: 'coro con band',
          hourlyRate: 500
        },
        radiusKm: 120
      },
      {
        suffix: 'cerca-chitarrista',
        postType: 'seeking',
        body: 'Inseriamo chitarrista elettrico per set gospel/pop.',
        instrumentsWanted: ['Chitarra elettrica'],
        resolved: true,
        radiusKm: 80
      }
    ]
  },
  {
    docId: 'user-quartetto-aurora',
    posts: [
      {
        suffix: 'quartetto-eventi',
        postType: 'offering',
        body: "Quartetto d'archi per cerimonie ed eventi corporate, repertorio classico e pop.",
        offerDetails: {
          concerts: true,
          genre: 'classico/pop',
          format: 'quartetto',
          setupNotes: 'Amplificazione non necessaria',
          hourlyRate: 300
        },
        radiusKm: 150
      },
      {
        suffix: 'cerca-cello',
        postType: 'seeking',
        body: 'Cerchiamo violoncello sub per data a Trento a fine mese.',
        instrumentsWanted: ['Violoncello'],
        radiusKm: 60
      },
      {
        suffix: 'tour-estivo',
        postType: 'offering',
        body: 'Disponibili per mini-tour estivo in Nord Italia, programmi crossover.',
        offerDetails: {
          concerts: true,
          genre: 'crossover',
          format: 'quartetto',
          hourlyRate: 350
        },
        resolved: true,
        radiusKm: 200
      }
    ]
  },
  {
    docId: 'user-banda-del-salento',
    posts: [
      {
        suffix: 'cerca-clarinetto',
        postType: 'seeking',
        body: 'Banda del Salento cerca clarinetto in Sib per stagione estiva.',
        instrumentsWanted: ['Clarinetto'],
        radiusKm: 120
      },
      {
        suffix: 'banda-parate',
        postType: 'offering',
        body: 'Disponibili per parate e feste patronali con repertorio tradizionale.',
        offerDetails: {
          concerts: true,
          services: true,
          genre: 'tradizionale',
          format: 'banda da giro',
          hourlyRate: 350
        },
        radiusKm: 180
      },
      {
        suffix: 'rinforzo-percussioni',
        postType: 'seeking',
        body: 'Cerchiamo rinforzo rullante/grancassa per processione a Lecce.',
        instrumentsWanted: ['Percussioni'],
        resolved: true,
        radiusKm: 80
      }
    ]
  }
];

const PROFILES = [
  {
    documentId: 'user-giulia-verdi',
    email: 'giulia.verdi@example.com',
    displayName: 'Giulia Verdi',
    data: {
      userType: 'musician',
      role: 'singer',
      mainInstrument: 'Soprano',
      instruments: ['Soprano', 'Pianoforte'],
      voiceType: 'Soprano',
      activityLevel: 'professional',
      experienceYears: 8,
      maxTravelKm: 30,
      willingToJoinForFree: true,
      bio: 'Soprano lirico, disponibile per cori e ensemble da camera.',
      curriculum: 'Conservatorio Milano, tournée cori sinfonici.',
      gender: 'female',
      genderVisible: true,
      nationality: 'IT',
      nationalityVisible: true,
      rates: {
        rehearsal: 40,
        concert_or_mass: 180,
        solo_performance: 250
      },
      isPremium: true,
      location: {
        city: 'Milano',
        province: 'MI',
        region: 'Lombardia',
        countryCode: 'IT',
        lat: 45.4642,
        lng: 9.19
      }
    }
  },
  {
    documentId: 'user-luca-rossi',
    email: 'luca.rossi@example.com',
    displayName: 'Luca Rossi',
    data: {
      userType: 'musician',
      role: 'musician',
      mainInstrument: 'Chitarra elettrica',
      instruments: ['Chitarra elettrica', 'Basso'],
      activityLevel: 'amateur',
      experienceYears: 3,
      maxTravelKm: 20,
      willingToJoinForFree: false,
      bio: 'Chitarrista rock, disponibile per prove serali.',
      gender: 'male',
      genderVisible: false,
      nationality: 'IT',
      nationalityVisible: false,
      rates: {
        rehearsal: 20
      },
      location: {
        city: 'Torino',
        province: 'TO',
        region: 'Piemonte',
        countryCode: 'IT',
        lat: 45.0703,
        lng: 7.6869
      }
    }
  },
  {
    documentId: 'user-francesca-rosa',
    email: 'francesca.rosa@exemple.com',
    displayName: 'Francesca Rosa',
    data: {
      userType: 'musician',
      role: 'musician',
      mainInstrument: 'Violino',
      instruments: ['Violino', 'Viola'],
      activityLevel: 'professional',
      experienceYears: 10,
      maxTravelKm: 50,
      willingToJoinForFree: false,
      bio: 'Violino spalla freelance, disponibile per orchestra e quartetti.',
      curriculum: 'Esperienza in orchestre sinfoniche italiane.',
      gender: 'female',
      genderVisible: true,
      nationality: 'IT',
      nationalityVisible: true,
      rates: {
        rehearsal: 60,
        concert_or_mass: 220
      },
      isPremium: false,
      location: {
        city: 'Verona',
        province: 'VR',
        region: 'Veneto',
        countryCode: 'IT',
        lat: 45.4384,
        lng: 10.9916
      }
    }
  },
  {
    documentId: 'user-marco-bianchi',
    email: 'marco.bianchi@example.com',
    displayName: 'Marco Bianchi',
    data: {
      userType: 'musician',
      role: 'musician',
      mainInstrument: 'Tromba',
      instruments: ['Tromba', 'Flicorno baritono'],
      activityLevel: 'professional',
      experienceYears: 12,
      maxTravelKm: 80,
      willingToJoinForFree: false,
      bio: 'Trombettista per cerimonie civili e religiose, disponibile anche per banda.',
      rates: {
        service_civil_trumpet_full: 150,
        concert_or_mass: 200
      },
      location: {
        city: 'Napoli',
        province: 'NA',
        region: 'Campania',
        countryCode: 'IT',
        lat: 40.8518,
        lng: 14.2681
      }
    }
  },
  {
    documentId: 'user-roberto-viola',
    email: 'roberto.viola@example.it',
    displayName: 'Roberto Viola',
    data: {
      userType: 'musician',
      role: 'musician',
      mainInstrument: 'Viola',
      instruments: ['Viola'],
      activityLevel: 'professional',
      experienceYears: 7,
      maxTravelKm: 25,
      willingToJoinForFree: false,
      bio: 'Viola per ensemble da camera e orchestre giovanili.',
      rates: {
        rehearsal: 35,
        concert_or_mass: 150
      },
      location: {
        city: 'Firenze',
        province: 'FI',
        region: 'Toscana',
        countryCode: 'IT',
        lat: 43.7696,
        lng: 11.2558
      }
    }
  },
  {
    documentId: 'user-banda-san-carlo',
    email: 'banda.sancarlo@example.com',
    displayName: 'Banda San Carlo',
    data: {
      userType: 'ensemble',
      ensembleType: 'band',
      description: 'Banda di paese con repertorio tradizionale e concerti estivi.',
      members: 35,
      website: 'https://sancarlo.example.com',
      rates: {
        rehearsal: 80,
        concert_or_mass: 400
      },
      gender: 'mixed',
      genderVisible: false,
      nationality: 'IT',
      nationalityVisible: false,
      location: {
        city: 'Parma',
        province: 'PR',
        region: 'Emilia-Romagna',
        countryCode: 'IT',
        lat: 44.8015,
        lng: 10.328
      }
    }
  },
  {
    documentId: 'user-coro-santa-maria',
    email: 'coro.santamaria@example.com',
    displayName: 'Coro Santa Maria',
    data: {
      userType: 'ensemble',
      ensembleType: 'choir',
      description: 'Coro polifonico con sezioni miste, cerca tenori e bassi.',
      members: 22,
      rates: {
        rehearsal: 50,
        concert_or_mass: 250
      },
      location: {
        city: 'Bologna',
        province: 'BO',
        region: 'Emilia-Romagna',
        countryCode: 'IT',
        lat: 44.4949,
        lng: 11.3426
      }
    }
  },
  {
    documentId: 'user-orchestra-filarmonica',
    email: 'orchestra.filarmonica@example.com',
    displayName: 'Orchestra Filarmonica Test',
    password: '123456',
    data: {
      userType: 'ensemble',
      ensembleType: 'orchestra',
      description: 'Orchestra sinfonica completa, prove serali e produzioni stagionali.',
      members: 80,
      website: 'https://orchestra.example.com',
      rates: {
        rehearsal: 180,
        concert_or_mass: 1200
      },
      location: {
        city: 'Torino',
        province: 'TO',
        region: 'Piemonte',
        countryCode: 'IT',
        lat: 45.0703,
        lng: 7.6869
      }
    }
  },
  {
    documentId: 'user-tenore-rossi',
    email: 'tenore.pop@example.com',
    displayName: 'Matteo Rossi',
    data: {
      userType: 'musician',
      role: 'singer',
      mainInstrument: 'Tenore',
      instruments: ['Tenore', 'Chitarra acustica'],
      voiceType: 'Tenore',
      activityLevel: 'amateur',
      experienceYears: 4,
      maxTravelKm: 40,
      willingToJoinForFree: true,
      bio: 'Tenore leggero, disponibile per cori pop e liturgici.',
      gender: 'male',
      genderVisible: true,
      nationality: 'IT',
      nationalityVisible: true,
      location: {
        city: 'Roma',
        province: 'RM',
        region: 'Lazio',
        countryCode: 'IT',
        lat: 41.9028,
        lng: 12.4964
      }
    }
  },
  {
    documentId: 'user-chiara-neri',
    email: 'chiara.neri@example.com',
    displayName: 'Chiara Neri',
    data: {
      userType: 'musician',
      role: 'singer',
      mainInstrument: 'Mezzosoprano',
      instruments: ['Mezzosoprano', 'Contralto'],
      voiceType: 'Mezzosoprano',
      voiceTypeSecondary: 'Contralto',
      activityLevel: 'professional',
      experienceYears: 6,
      maxTravelKm: 60,
      willingToJoinForFree: false,
      bio: 'Mezzosoprano lirico, repertorio sacro e barocco.',
      curriculum: 'Festival barocco, produzioni regionali.',
      gender: 'female',
      genderVisible: true,
      nationality: 'IT',
      nationalityVisible: true,
      rates: {
        rehearsal: 50,
        concert_or_mass: 220,
        solo_performance: 320
      },
      isPremium: false,
      location: {
        city: 'Bari',
        province: 'BA',
        region: 'Puglia',
        countryCode: 'IT',
        lat: 41.1171,
        lng: 16.8719
      }
    }
  },
  {
    documentId: 'user-antonio-falco',
    email: 'antonio.falco@example.com',
    displayName: 'Antonio Falco',
    data: {
      userType: 'musician',
      role: 'singer',
      mainInstrument: 'Basso',
      instruments: ['Basso', 'Baritono'],
      voiceType: 'Basso',
      voiceTypeSecondary: 'Baritono',
      activityLevel: 'professional',
      experienceYears: 15,
      maxTravelKm: 25,
      willingToJoinForFree: false,
      bio: 'Basso profondo per cori sinfonici e liturgia.',
      gender: 'male',
      genderVisible: true,
      nationality: 'IT',
      nationalityVisible: true,
      rates: {
        rehearsal: 55,
        concert_or_mass: 260
      },
      isPremium: false,
      location: {
        city: 'Palermo',
        province: 'PA',
        region: 'Sicilia',
        countryCode: 'IT',
        lat: 38.1157,
        lng: 13.3615
      }
    }
  },
  {
    documentId: 'user-alessio-greco',
    email: 'alessio.greco@example.com',
    displayName: 'Alessio Greco',
    data: {
      userType: 'musician',
      role: 'musician',
      mainInstrument: 'Batteria',
      instruments: ['Batteria', 'Percussioni', 'Cajon'],
      activityLevel: 'amateur',
      experienceYears: 2,
      maxTravelKm: 15,
      willingToJoinForFree: true,
      bio: 'Batterista per cover band e serate acustiche.',
      gender: 'male',
      genderVisible: false,
      nationality: 'IT',
      nationalityVisible: false,
      rates: {
        rehearsal: 25
      },
      location: {
        city: 'Cagliari',
        province: 'CA',
        region: 'Sardegna',
        countryCode: 'IT',
        lat: 39.2238,
        lng: 9.1217
      }
    }
  },
  {
    documentId: 'user-ilaria-fontana',
    email: 'ilaria.fontana@example.com',
    displayName: 'Ilaria Fontana',
    data: {
      userType: 'musician',
      role: 'musician',
      mainInstrument: 'Organo',
      instruments: ['Organo', 'Pianoforte'],
      activityLevel: 'professional',
      experienceYears: 11,
      maxTravelKm: 120,
      willingToJoinForFree: false,
      bio: 'Organista liturgica e pianista accompagnatrice.',
      curriculum: 'Conservatorio, organista stabile in cattedrale.',
      gender: 'female',
      genderVisible: true,
      nationality: 'IT',
      nationalityVisible: true,
      rates: {
        rehearsal: 90,
        concert_or_mass: 450,
        service_civil_religious: 250
      },
      isPremium: true,
      location: {
        city: 'Perugia',
        province: 'PG',
        region: 'Umbria',
        countryCode: 'IT',
        lat: 43.1107,
        lng: 12.3908
      }
    }
  },
  {
    documentId: 'user-nicole-mendes',
    email: 'nicole.mendes@example.com',
    displayName: 'Nicole Mendes',
    data: {
      userType: 'musician',
      role: 'musician',
      mainInstrument: 'Sax contralto',
      instruments: ['Sax contralto', 'Flauto'],
      activityLevel: 'professional',
      experienceYears: 5,
      maxTravelKm: 80,
      willingToJoinForFree: false,
      bio: 'Sassofonista per funk/jazz, disponibile per tour brevi.',
      gender: 'non_binary',
      genderVisible: true,
      nationality: 'PT',
      nationalityVisible: false,
      rates: {
        rehearsal: 70,
        concert_or_mass: 320,
        solo_performance: 420
      },
      isPremium: false,
      photoUrl: '/assets/img/avatars/avatar-sax-contralto-non_binary.webp',
      location: {
        city: 'Genova',
        province: 'GE',
        region: 'Liguria',
        countryCode: 'IT',
        lat: 44.4056,
        lng: 8.9463
      }
    }
  },
  {
    documentId: 'user-davide-marini',
    email: 'davide.marini@example.com',
    displayName: 'Davide Marini',
    data: {
      userType: 'musician',
      role: 'musician',
      mainInstrument: 'Basso elettrico',
      instruments: ['Basso elettrico', 'Contrabbasso'],
      activityLevel: 'amateur',
      experienceYears: 5,
      maxTravelKm: 35,
      willingToJoinForFree: false,
      bio: 'Bassista rock, disponibile per sostituzioni veloci.',
      gender: 'male',
      genderVisible: true,
      nationality: 'IT',
      nationalityVisible: true,
      isPremium: false,
      isActive: false,
      rates: {
        rehearsal: 30,
        concert_or_mass: 110
      },
      location: {
        city: 'Ancona',
        province: 'AN',
        region: 'Marche',
        countryCode: 'IT',
        lat: 43.6158,
        lng: 13.5189
      }
    }
  },
  {
    documentId: 'user-coro-gospel-milano',
    email: 'coro.gospel@example.com',
    displayName: 'Coro Gospel Milano',
    data: {
      userType: 'ensemble',
      ensembleType: 'choir',
      description: 'Coro gospel con sezione band interna, disponibile per eventi e matrimoni.',
      members: 18,
      website: 'https://gospelmilano.example.com',
      rates: {
        rehearsal: 70,
        concert_or_mass: 500
      },
      gender: 'mixed',
      genderVisible: false,
      nationality: 'IT',
      nationalityVisible: false,
      location: {
        city: 'Monza',
        province: 'MB',
        region: 'Lombardia',
        countryCode: 'IT',
        lat: 45.5845,
        lng: 9.2744
      }
    }
  },
  {
    documentId: 'user-quartetto-aurora',
    email: 'quartetto.aurora@example.com',
    displayName: 'Quartetto Aurora',
    data: {
      userType: 'ensemble',
      ensembleType: 'string_quartet',
      description: "Quartetto d'archi per cerimonie, eventi aziendali e rassegne.",
      members: 4,
      website: 'https://quartettoaurora.example.com',
      rates: {
        rehearsal: 150,
        concert_or_mass: 800,
        solo_performance: 1200
      },
      location: {
        city: 'Trento',
        province: 'TN',
        region: 'Trentino-Alto Adige',
        countryCode: 'IT',
        lat: 46.0701,
        lng: 11.119
      }
    }
  },
  {
    documentId: 'user-banda-del-salento',
    email: 'banda.salento@example.com',
    displayName: 'Banda del Salento',
    data: {
      userType: 'ensemble',
      ensembleType: 'band',
      description: 'Banda da giro con repertorio tradizionale salentino.',
      members: 28,
      rates: {
        rehearsal: 90,
        concert_or_mass: 350
      },
      location: {
        city: 'Lecce',
        province: 'LE',
        region: 'Puglia',
        countryCode: 'IT',
        lat: 40.3529,
        lng: 18.174
      }
    }
  }
];

async function main() {
  const now = new Date();
  console.log(`[seed] Using project ${PROJECT_ID} (Auth ${AUTH_HOST}, Firestore ${FS_HOST})`);

  const seededUsers = [];

  for (const profile of PROFILES) {
    const pwd = profile.password || DEFAULT_PASSWORD;
    const uid = await signUpOrSignIn(profile.email, pwd);
    const docId = profile.documentId || uid;
    const docData = prepareDoc(profile, uid, now);
    await upsertUserDoc(docId, docData);
    seededUsers.push({ docId, uid, data: docData });
    console.log(`[seed] Upserted ${profile.email} -> ${docId} (${uid})`);
  }

  await seedPosts(seededUsers);

  console.log('[seed] Done. Accounts password:', DEFAULT_PASSWORD);
}

async function seedPosts(seededUsers) {
  const mapByDocId = new Map(seededUsers.map((u) => [u.docId, u]));
  const start = Date.now();
  let counter = 0;

  for (const def of POST_DEFINITIONS) {
    const user = mapByDocId.get(def.docId);
    if (!user) {
      console.warn(`[seed][post] Skipping ${def.docId}: user not found`);
      continue;
    }
    for (const postDef of def.posts) {
      const createdAt = new Date(start - counter * ONE_MINUTE);
      const postId = `post-${def.docId}-${postDef.suffix || counter + 1}`;
      const payload = buildPostPayload(user, postDef, createdAt);
      await upsertPostDoc(postId, payload);
      console.log(`[seed][post] Upserted ${postId} (${user.docId})`);
      counter += 1;
    }
  }
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
