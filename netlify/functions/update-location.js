const { json, preflight, parseBody, verifyToken, getValidSession, query, newId } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const token = verifyToken(event); await getValidSession(token.sessionId);
    const body = parseBody(event);
    if (!body.userId || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') return json(400, { ok: false, error: 'Missing location data' });
    const now = new Date().toISOString();
    const location = await query`
      insert into location_updates (id, user_id, session_id, latitude, longitude, accuracy, source, location_photo_url, stage_marker, updated_at)
      values (${newId()}, ${body.userId}, ${token.sessionId}, ${body.latitude}, ${body.longitude}, ${body.accuracy || null}, 'gps', ${body.locationPhotoUrl || null}, ${body.stageMarker ? JSON.stringify(body.stageMarker) : null}::jsonb, ${now})
      returning *
    `;
    await query`
      update users
      set is_visible = true, location_status = 'locked', last_seen_at = ${now}
      where id = ${body.userId} and session_id = ${token.sessionId}
      returning id
    `;
    return json(200, { ok: true, location: location[0] });
  } catch (error) { return json(400, { ok: false, error: error.message }); }
};
