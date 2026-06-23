const { json, preflight, verifyToken, getValidSession, query, toCamelUser } = require('./_shared');

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  try {
    const token = verifyToken(event);
    await getValidSession(token.sessionId);
    const currentUserId = event.queryStringParameters?.userId || null;
    const users = await query`
      select id, name, profile_photo_url, is_visible, location_status, created_at, last_seen_at
      from users
      where session_id = ${token.sessionId}
      order by created_at asc
    `;
    const locations = await query`
      select distinct on (user_id) *
      from location_updates
      where session_id = ${token.sessionId}
      order by user_id, updated_at desc
    `;
    const latestByUser = new Map(locations.map((loc) => [loc.user_id, loc]));
    const safeUsers = users.map((u) => toCamelUser(u, latestByUser.get(u.id)));
    let signals = [];
    if (currentUserId) {
      signals = await query`
        select * from signals
        where session_id = ${token.sessionId}
          and to_user_id = ${currentUserId}
          and seen_at is null
          and expires_at > now()
        order by created_at desc
      `;
    }
    return json(200, { ok: true, users: safeUsers, signals });
  } catch (error) { return json(400, { ok: false, error: error.message }); }
};
