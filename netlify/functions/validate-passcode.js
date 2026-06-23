const { json, preflight, parseBody, sha256, getValidSession, tokenForSession, DEFAULT_SESSION_ID, NORMAL_PASSCODE_HASH, ADMIN_PASSCODE_HASH } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const { passcode } = parseBody(event);
    if (!passcode) return json(400, { ok: false, error: 'Missing passcode' });

    const hash = sha256(String(passcode).trim());
    const isAdmin = hash === ADMIN_PASSCODE_HASH;
    const isNormalUser = hash === NORMAL_PASSCODE_HASH;

    if (!isAdmin && !isNormalUser) {
      return json(401, { ok: false, error: 'Invalid passcode' });
    }

    const session = await getValidSession(DEFAULT_SESSION_ID);
    const role = isAdmin ? 'admin' : 'user';
    return json(200, { ok: true, role, sessionToken: tokenForSession(session.id, role), session: { id: session.id, name: session.name } });
  } catch (error) {
    return json(500, { ok: false, error: `Login service error: ${error.message}` });
  }
};
