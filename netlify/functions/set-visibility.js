const { json, preflight, parseBody, verifyToken, getValidSession, query } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const token = verifyToken(event); await getValidSession(token.sessionId);
    const { userId, isVisible, locationStatus } = parseBody(event);
    if (!userId) return json(400, { ok: false, error: 'Missing userId' });
    const status = locationStatus || (isVisible ? 'locked' : 'hidden');
    if (!['locked', 'moving', 'hidden'].includes(status)) return json(400, { ok: false, error: 'Invalid status' });
    const updated = await query`
      update users
      set is_visible = ${status !== 'hidden'}, location_status = ${status}, last_seen_at = now()
      where id = ${userId} and session_id = ${token.sessionId}
      returning *
    `;
    return json(200, { ok: true, user: updated[0] });
  } catch (error) { return json(400, { ok: false, error: error.message }); }
};
