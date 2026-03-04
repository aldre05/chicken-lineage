module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
  const API_KEY  = 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';

  try {
    const url = `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': API_KEY }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `API error: ${response.status}` });
    }

    const json = await response.json();
    // Normalize to expected shape: { token_id, image, attributes[] }
    const item = json?.result?.token ?? json?.result ?? json;
    const metadata = item?.metadata ?? item;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json({
      token_id: String(id),
      image: metadata?.image || '',
      attributes: metadata?.attributes || []
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
