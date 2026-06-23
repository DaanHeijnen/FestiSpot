const crypto = require('crypto');
const { json, preflight, parseBody, verifyToken, getValidSession } = require('./_shared');

async function getBlobStore(event) {
  const mod = await import('@netlify/blobs');
  if (typeof mod.connectLambda === 'function') mod.connectLambda(event);
  return mod.getStore('festradar-images');
}

function safeExt(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'jpg';
}

exports.handler = async (event) => {
  const pf = preflight(event); if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  try {
    const token = verifyToken(event); await getValidSession(token.sessionId);
    const { folder, contentType, data } = parseBody(event);
    if (!data || typeof data !== 'string') return json(400, { ok: false, error: 'Missing image data' });
    const type = String(contentType || 'image/jpeg').toLowerCase();
    if (!type.startsWith('image/')) return json(400, { ok: false, error: 'Only images are allowed' });
    const base64 = data.includes(',') ? data.split(',').pop() : data;
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) return json(400, { ok: false, error: 'Empty image' });
    if (buffer.length > 4 * 1024 * 1024) return json(413, { ok: false, error: 'Image is too large. Use a smaller photo.' });
    const cleanFolder = ['profiles', 'locations'].includes(folder) ? folder : 'uploads';
    const key = `${token.sessionId}/${cleanFolder}/${crypto.randomUUID()}.${safeExt(type)}`;
    const store = await getBlobStore(event);
    await store.set(key, buffer);
    await store.set(`${key}.meta`, JSON.stringify({ contentType: type, createdAt: new Date().toISOString() }));
    return json(200, { ok: true, url: `/.netlify/functions/image?key=${encodeURIComponent(key)}`, key });
  } catch (error) { return json(400, { ok: false, error: error.message }); }
};
