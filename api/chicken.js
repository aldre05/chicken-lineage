module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  // Use Chicken Saga proxy server-side (no CORS issues from server)
  try {
    const r = await fetch(`https://app.chickensaga.com/api/proxy?tokenId=${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://app.chickensaga.com/',
        'Origin': 'https://app.chickensaga.com'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) {
      const d = await r.json();
      if (d && d.attributes) {
        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json({
          token_id: String(id),
          image: d.image || '',
          attributes: d.attributes
        });
      }
    }
  } catch {}

  // Fallback: Sky Mavis API
  try {
    const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
    const API_KEY  = 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';
    const r = await fetch(
      `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`,
      { headers: { 'X-API-Key': API_KEY }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return res.status(r.status).json({ error: 'Not found' });
    const json = await r.json();
    const item = json?.result?.token ?? json?.result ?? json;
    const meta = item?.metadata ?? item;
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({
      token_id: String(id),
      image: meta?.image || '',
      attributes: meta?.attributes || []
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
