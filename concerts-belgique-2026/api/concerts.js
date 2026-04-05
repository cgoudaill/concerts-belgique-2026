const { kv } = require('@vercel/kv');

const KV_KEY = 'concerts-belgique-2026';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    /* ── GET : return all concerts ── */
    if (req.method === 'GET') {
      const data = await kv.get(KV_KEY);
      return res.status(200).json(data || []);
    }

    /* ── POST : overwrite concert list ── */
    if (req.method === 'POST') {
      const { concerts } = req.body;
      if (!Array.isArray(concerts)) {
        return res.status(400).json({ error: 'concerts must be an array' });
      }
      await kv.set(KV_KEY, concerts);
      return res.status(200).json({ ok: true, count: concerts.length });
    }

    res.status(405).end();
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('KV_REST_API')) {
      return res.status(503).json({
        error: 'Vercel KV non configuré.',
        setup: 'Allez dans Dashboard Vercel → Storage → Create Database → KV (Redis) → Connect to project.',
      });
    }
    return res.status(500).json({ error: err.message });
  }
};
