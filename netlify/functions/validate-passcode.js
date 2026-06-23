const { json, preflight, parseBody, sha256, getValidSession, tokenForSession, DEFAULT_SESSION_ID, ADMIN_PASSCODE_HASH } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const { sessionId, passcode } = parseBody(event);
    const cleanSessionId = sessionId || DEFAULT_SESSION_ID;
    if (!passcode) return json(400, { ok: false, error: 'Missing passcode' });
    const session = await getValidSession(cleanSessionId);
    const hash = sha256(passcode);
    const isAdmin = hash === ADMIN_PASSCODE_HASH;
    const ok = isAdmin || session.passcode_hash === hash || session.passcode_hash === passcode;
    if (!ok) return json(401, { ok: false, error: 'Invalid passcode' });
    const role = isAdmin ? 'admin' : 'user';
    return json(200, { ok: true, role, sessionToken: tokenForSession(session.id, role), session: { id: session.id, name: session.name } });
  } catch (error) {
    return json(400, { ok: false, error: error.message });
  }
};
