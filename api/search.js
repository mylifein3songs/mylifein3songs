export default async function handler(req, res) {
  // Allow cross-origin requests from your own domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const url = 'https://itunes.apple.com/search?media=music&entity=song&limit=10&term=' + encodeURIComponent(q.trim());
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({ error: 'iTunes API error' });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (e) {
    console.error('iTunes proxy error:', e);
    return res.status(500).json({ error: 'Search unavailable' });
  }
}
