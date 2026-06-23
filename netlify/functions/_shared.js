const crypto = require('crypto');

const SECRET = process.env.SESSION_JWT_SECRET || 'local-dev-secret-change-me';
let dbPromise;

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

function rows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

async function query(strings, ...values) {
  const db = await getDb();
  return rows(await db.sql(strings, ...values));
}

async function getValidSession(sessionId) {
  const result = await query`select id, name, passcode_hash, expires_at from sessions where id = ${sessionId} limit 1`;
  const session = result[0];
  if (!session) throw new Error('Session not found');
  if (new Date(session.expires_at).getTime() < Date.now()) throw new Error('Session expired');
  return session;
}

function tokenForSession(sessionId) {
  return signPayload({ sessionId, exp: Date.now() + 1000 * 60 * 60 * 12 });
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

module.exports = { json, preflight, parseBody, sha256, verifyToken, query, getValidSession, tokenForSession, toCamelUser };
