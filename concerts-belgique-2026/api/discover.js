const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/* ── Agendas à scraper directement ── */
const VENUE_URLS = [
  { url: 'https://www.abconcerts.be/fr/agenda',         venue: 'Ancienne Belgique', city: 'Bruxelles' },
  { url: 'https://www.forest-national.be/calendrier',   venue: 'Forest National',   city: 'Bruxelles' },
  { url: 'https://www.bozar.be/fr/agenda',              venue: 'Bozar',             city: 'Bruxelles' },
  { url: 'https://grandmanege.be/fr/agenda',            venue: 'Grand Manège',      city: 'Namur'     },
  { url: 'https://www.rockerill.com/agenda',            venue: 'Rockerill',         city: 'Charleroi' },
  { url: 'https://www.lebrass.be/agenda',               venue: 'Le BRASS',          city: 'Forest'    },
  { url: 'https://www.muziekpublique.be/agenda',        venue: 'Muziek Publique',   city: 'Bruxelles' },
  { url: 'https://www.oprl.be/fr/concerts',             venue: 'Salle Philharmonique', city: 'Liège'  },
  { url: 'https://volta.brussels/agenda',               venue: 'Volta',             city: 'Bruxelles' },
  { url: 'https://www.lazone.be/agenda',                venue: 'La Zone',           city: 'Liège'     },
  { url: 'https://www.ccverviers.be/agenda',            venue: 'Centre Culturel de Verviers', city: 'Verviers' },
  { url: 'https://chiroux.be/agenda',                   venue: 'Les Chiroux',       city: 'Liège'     },
];

/* ── Requêtes web_search de secours ── */
const SEARCH_QUERIES = [
  'prochains concerts rock Belgique Ancienne Belgique Forest National Trix agenda',
  'prochains concerts folk alternatif Belgique Botanique Cirque Royal Flagey agenda',
  'prochains concerts opéra Belgique La Monnaie De Munt agenda',
  'prochains concerts classique Belgique Bozar Belgian National Orchestra Brussels Philharmonic',
  'festivals rock métal Belgique Graspop Alcatraz Rock Werchter prochains',
  'concerts Liège Namur Mons Charleroi agenda prochains rock folk classique',
  'concerts Anvers Gand Bruges Belgique agenda prochains rock alternatif',
  'prochains concerts opéra classique Liège Namur Bruxelles agenda',
];

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { query, venueIndex } = req.body;
  if (query === undefined && venueIndex === undefined) {
    return res.status(400).json({ error: 'query or venueIndex required' });
  }

  try {
    let userMessage;

    if (venueIndex !== undefined) {
      /* Mode scraping direct d'un agenda de salle */
      const venue = VENUE_URLS[venueIndex % VENUE_URLS.length];
      userMessage = `Visite la page ${venue.url} et extrait tous les concerts à venir. `
        + `Pour chaque concert, détermine le genre parmi : Rock, Folk / Alt, Classique, Opéra. `
        + `La salle est "${venue.venue}", la ville est "${venue.city}". `
        + `Retourne UNIQUEMENT un tableau JSON brut sans markdown. `
        + `Format: [{"date":"YYYY-MM-DD","artist":"Nom","venue":"${venue.venue}","city":"${venue.city}","genre":"Rock|Folk / Alt|Classique|Opéra"}].`;
    } else {
      /* Mode recherche web générale */
      const q = query || SEARCH_QUERIES[0];
      userMessage = `${q}. `
        + `Extrait les concerts à venir en Belgique depuis les sites officiels des salles. `
        + `Retourne UNIQUEMENT un tableau JSON brut sans markdown. `
        + `Format: [{"date":"YYYY-MM-DD","artist":"Nom","venue":"Salle","city":"Ville","genre":"Rock|Folk / Alt|Classique|Opéra"}]. `
        + `Genres autorisés: Rock, Folk / Alt, Classique, Opéra.`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `Tu es un assistant agenda concerts en Belgique. Tu consultes les agendas officiels des salles de concert belges. Retourne UNIQUEMENT un tableau JSON brut sans markdown, sans texte avant ni après. Format strict: [{"date":"YYYY-MM-DD","artist":"Nom","venue":"Salle","city":"Ville","genre":"Rock|Folk / Alt|Classique|Opéra","ticketUrl":"https://..."}]. Genres autorisés exactement: Rock, Folk / Alt, Classique, Opéra. Pour ticketUrl, mets l'URL directe de réservation/billetterie si disponible, sinon null. Si aucun concert trouvé, retourne [].`,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || 30;
        return res.status(429).json({
          error: `Limite API atteinte. Veuillez attendre ${retryAfter} secondes avant de réessayer.`,
          retryAfter: parseInt(retryAfter),
        });
      }
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(200).json({ concerts: [], venueCount: VENUE_URLS.length });

    const concerts = JSON.parse(match[0]);
    return res.status(200).json({ concerts, venueCount: VENUE_URLS.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
