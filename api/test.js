module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { id = '2286' } = req.query;

  const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
  const API_KEY  = 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';

  try {
    const url = `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`;
    const r = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
    const raw = await r.text();
    return res.status(200).json({
      upstream_status: r.status,
      ok: r.ok,
      preview: raw.slice(0, 800),
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
