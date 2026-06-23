const { json, preflight, parseBody, sha256, getValidSession, tokenForSession, DEFAULT_SESSION_ID } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const { sessionId, passcode } = parseBody(event);
    const cleanSessionId = sessionId || DEFAULT_SESSION_ID;
    if (!passcode) return json(400, { ok: false, error: 'Missing passcode' });
    const session = await getValidSession(cleanSessionId);
    const hash = sha256(passcode);
    const ok = session.passcode_hash === hash || session.passcode_hash === passcode;
    if (!ok) return json(401, { ok: false, error: 'Invalid passcode' });
    return json(200, { ok: true, sessionToken: tokenForSession(session.id), session: { id: session.id, name: session.name } });
  } catch (error) {
    return json(400, { ok: false, error: error.message });
  }
};
