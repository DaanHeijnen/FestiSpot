async function getBlobStore(event) {
  const mod = await import('@netlify/blobs');
  if (typeof mod.connectLambda === 'function') mod.connectLambda(event);
  return mod.getStore('festradar-images');
}

exports.handler = async (event) => {
  try {
    const key = event.queryStringParameters?.key;
    if (!key || key.includes('..')) return { statusCode: 400, body: 'Missing key' };
    const store = await getBlobStore(event);
    const blob = await store.get(key, { type: 'arrayBuffer' });
    if (!blob) return { statusCode: 404, body: 'Not found' };
    let contentType = 'image/jpeg';
    try {
      const meta = await store.get(`${key}.meta`, { type: 'json' });
      if (meta?.contentType) contentType = meta.contentType;
    } catch {}
    return {
      statusCode: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=31536000, immutable'
      },
      isBase64Encoded: true,
      body: Buffer.from(blob).toString('base64')
    };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
