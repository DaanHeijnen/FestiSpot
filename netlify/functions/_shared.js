const crypto = require('crypto');

const SECRET = process.env.SESSION_JWT_SECRET || 'local-dev-secret-change-me';
const DEFAULT_SESSION_ID = '11111111-1111-4111-8111-111111111111';
const DEFAULT_SESSION_PASSCODE_HASH = '926c7551fea60fd3b11ff8f1693384f69d342f54b02288755411fd8c721b56fa';
const ADMIN_PASSCODE_HASH = '8672a05a37da52552dc658cd5d2292fc665722ae8bca0eb6549d9995e5dfd429';
let dbPromise;
let initPromise;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function preflight(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  return null;
}

function parseBody(event) {
  try { return event.body ? JSON.parse(event.body) : {}; } catch { return {}; }
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function base64url(input) {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

function signPayload(payload) {
  const encoded = base64url(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!token || !token.includes('.')) throw new Error('Missing session token');
  const [encoded, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  const sigBuffer = Buffer.from(sig || '');
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) throw new Error('Invalid session token');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload.exp || Date.now() > payload.exp) throw new Error('Expired session token');
  return payload;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = import('@netlify/database').then(({ getDatabase }) => getDatabase());
  }
  return dbPromise;
}

async function rawSql(strings, ...values) {
  const db = await getDb();
  return db.sql(strings, ...values);
}

async function ensureDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      await rawSql`create extension if not exists pgcrypto`;
      await rawSql`create table if not exists sessions (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        passcode_hash text not null,
        created_at timestamptz default now(),
        expires_at timestamptz not null
      )`;
      await rawSql`create table if not exists users (
        id uuid primary key default gen_random_uuid(),
        session_id uuid references sessions(id) on delete cascade,
        name text not null,
        profile_photo_url text,
        is_visible boolean default false,
        location_status text not null default 'hidden' check (location_status in ('locked', 'moving', 'hidden')),
        created_at timestamptz default now(),
        last_seen_at timestamptz
      )`;
      await rawSql`create table if not exists location_updates (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references users(id) on delete cascade,
        session_id uuid references sessions(id) on delete cascade,
        latitude double precision not null,
        longitude double precision not null,
        accuracy double precision,
        source text not null default 'gps',
        location_photo_url text,
        stage_marker jsonb,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )`;
      await rawSql`create table if not exists signals (
        id uuid primary key default gen_random_uuid(),
        session_id uuid references sessions(id) on delete cascade,
        from_user_id uuid references users(id) on delete cascade,
        to_user_id uuid references users(id) on delete cascade,
        type text not null,
        created_at timestamptz default now(),
        expires_at timestamptz not null,
        seen_at timestamptz
      )`;
      await rawSql`create index if not exists idx_users_session_id on users(session_id)`;
      await rawSql`create index if not exists idx_locations_session_updated on location_updates(session_id, updated_at desc)`;
      await rawSql`create index if not exists idx_signals_receiver on signals(session_id, to_user_id, seen_at, expires_at)`;
      await rawSql`insert into sessions (id, name, passcode_hash, expires_at)
        values (${DEFAULT_SESSION_ID}, 'FestiSpot Demo', ${DEFAULT_SESSION_PASSCODE_HASH}, now() + interval '30 days')
        on conflict (id) do update set
          name = excluded.name,
          passcode_hash = excluded.passcode_hash,
          expires_at = greatest(sessions.expires_at, now() + interval '30 days')`;
    })();
  }
  return initPromise;
}

function rows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

async function query(strings, ...values) {
  await ensureDatabase();
  return rows(await rawSql(strings, ...values));
}

async function getValidSession(sessionId) {
  const cleanSessionId = sessionId || DEFAULT_SESSION_ID;
  const result = await query`select id, name, passcode_hash, expires_at from sessions where id = ${cleanSessionId} limit 1`;
  const session = result[0];
  if (!session) throw new Error('Session not found');
  if (new Date(session.expires_at).getTime() < Date.now()) throw new Error('Session expired');
  return session;
}

function tokenForSession(sessionId, role = 'user') {
  return signPayload({ sessionId, role, exp: Date.now() + 1000 * 60 * 60 * 12 });
}

function requireAdmin(token) {
  if (!token || token.role !== 'admin') throw new Error('Admin access required');
}

function toCamelUser(row, location) {
  const status = row.location_status || (row.is_visible ? 'locked' : 'hidden');
  const user = {
    id: row.id,
    name: row.name,
    profilePhotoUrl: row.profile_photo_url,
    isVisible: row.is_visible,
    locationStatus: status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  };
  if (location && status !== 'hidden') {
    user.location = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      source: location.source,
      locationPhotoUrl: location.location_photo_url,
      stageMarker: location.stage_marker,
      createdAt: location.created_at,
      updatedAt: location.updated_at
    };
  }
  return user;
}

module.exports = { json, preflight, parseBody, sha256, verifyToken, query, getValidSession, tokenForSession, requireAdmin, toCamelUser, ensureDatabase, DEFAULT_SESSION_ID, ADMIN_PASSCODE_HASH };
