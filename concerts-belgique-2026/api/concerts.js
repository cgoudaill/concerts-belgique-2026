const { put, list, del } = require('@vercel/blob');

const BLOB_NAME = 'concerts-belgique-2026.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function readConcerts() {
  const { blobs } = await list({ prefix: 'concerts-belgique-2026' });
  if (!blobs.length) return [];
  const res = await fetch(blobs[0].url + '?t=' + Date.now());
  return res.json();
}

async function writeConcerts(concerts) {
  const { blobs } = await list({ prefix: 'concerts-belgique-2026' });
  for (const b of blobs) await del(b.url);
  await put(BLOB_NAME, JSON.stringify(concerts), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const concerts = await readConcerts();
      return res.status(200).json(concerts);
    }

    if (req.method === 'POST') {
      const { concerts } = req.body;
      if (!Array.isArray(concerts))
        return res.status(400).json({ error: 'concerts must be an array' });
      await writeConcerts(concerts);
      return res.status(200).json({ ok: true, count: concerts.length });
    }

    res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
