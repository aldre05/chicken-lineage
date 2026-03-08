module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`);
    if (!r.ok) return res.status(r.status).json({ error: 'Not found' });
    const d = await r.json();
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({
      token_id: String(id),
      image: d.image || '',
      attributes: d.attributes || []
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
