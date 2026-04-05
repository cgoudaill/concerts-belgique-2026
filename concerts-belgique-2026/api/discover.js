const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `Tu es un assistant agenda concerts en Belgique. Recherche sur le web des concerts à venir en Belgique. Retourne UNIQUEMENT un tableau JSON brut sans markdown. Format: [{"date":"YYYY-MM-DD","artist":"Nom","venue":"Salle","city":"Ville","genre":"Rock|Folk / Alt|Classique|Opéra"}]. Genres autorisés: Rock, Folk / Alt, Classique, Opéra.`,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return res.status(200).json({ concerts: [] });

    const concerts = JSON.parse(match[0]);
    return res.status(200).json({ concerts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
