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
  }
];

async function main() {
  const now = new Date();
  console.log(`[seed] Using project ${PROJECT_ID} (Auth ${AUTH_HOST}, Firestore ${FS_HOST})`);

  for (const profile of PROFILES) {
    const pwd = profile.password || DEFAULT_PASSWORD;
    const uid = await signUpOrSignIn(profile.email, pwd);
    const docId = profile.documentId || uid;
    const docData = prepareDoc(profile, uid, now);
    await upsertUserDoc(docId, docData);
    console.log(`[seed] Upserted ${profile.email} -> ${docId} (${uid})`);
  }

  console.log('[seed] Done. Accounts password:', DEFAULT_PASSWORD);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
