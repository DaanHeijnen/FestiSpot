const { json, preflight, parseBody, verifyToken, getValidSession, query } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const token = verifyToken(event); await getValidSession(token.sessionId);
    const { signalId } = parseBody(event);
    if (!signalId) return json(400, { ok: false, error: 'Missing signalId' });
    const updated = await query`
      update signals
      set seen_at = now()
      where id = ${signalId} and session_id = ${token.sessionId}
      returning *
    `;
    return json(200, { ok: true, signal: updated[0] });
  } catch (error) { return json(400, { ok: false, error: error.message }); }
};
