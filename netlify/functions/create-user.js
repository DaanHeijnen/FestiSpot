const { json, preflight, parseBody, verifyToken, getValidSession, query } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const token = verifyToken(event);
    await getValidSession(token.sessionId);
    const { name, profilePhotoUrl } = parseBody(event);
    if (!name || name.trim().length < 2) return json(400, { ok: false, error: 'Name is required' });
    const created = await query`
      insert into users (session_id, name, profile_photo_url, is_visible, location_status)
      values (${token.sessionId}, ${name.trim()}, ${profilePhotoUrl || null}, false, 'hidden')
      returning *
    `;
    return json(200, { ok: true, user: created[0] });
  } catch (error) { return json(400, { ok: false, error: error.message }); }
};
