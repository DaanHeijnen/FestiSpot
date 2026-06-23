const { json, preflight, parseBody, verifyToken, getValidSession, query } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const token = verifyToken(event); await getValidSession(token.sessionId);
    const { fromUserId, toUserId, type } = parseBody(event);
    if (!fromUserId || !toUserId) return json(400, { ok: false, error: 'Missing signal data' });
    const created = await query`
      insert into signals (session_id, from_user_id, to_user_id, type, expires_at)
      values (${token.sessionId}, ${fromUserId}, ${toUserId}, ${type || 'im_here'}, now() + interval '5 minutes')
      returning *
    `;
    return json(200, { ok: true, signal: created[0] });
  } catch (error) { return json(400, { ok: false, error: error.message }); }
};
