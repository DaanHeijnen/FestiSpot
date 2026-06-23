const { json, preflight, parseBody, verifyToken, getValidSession, requireAdmin, query } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const token = verifyToken(event);
    requireAdmin(token);
    await getValidSession(token.sessionId);
    const { userId } = parseBody(event);
    if (!userId) return json(400, { ok: false, error: 'Missing userId' });
    const deleted = await query`
      delete from users
      where id = ${userId} and session_id = ${token.sessionId}
      returning id, name
    `;
    if (!deleted[0]) return json(404, { ok: false, error: 'User not found' });
    return json(200, { ok: true, user: deleted[0] });
  } catch (error) {
    return json(400, { ok: false, error: error.message });
  }
};
