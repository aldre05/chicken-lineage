module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
  const API_KEY  = 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';
  const parentId = String(parent);

  const fetchOne = async (id) => {
    try {
      const url = `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`;
      const r = await fetch(url, { headers: { 'X-API-Key': API_KEY }, signal: AbortSignal.timeout(5000) });
      if (!r.ok) return null;
      const json = await r.json();
      const item = json?.result?.token ?? json?.result ?? json;
      const meta = item?.metadata ?? item;
      const attrs = meta?.attributes || [];
      const getA = name => String((attrs.find(a => a.trait_type === name) || {}).value || '0');
      if (getA('Parent 1') !== parentId && getA('Parent 2') !== parentId) return null;
      return { token_id: String(id), image: meta?.image || '', attributes: attrs };
    } catch { return null; }
  };

  // Scan a specific range passed from client
  const start = parseInt(req.query.start) || 1;
  const end   = Math.min(parseInt(req.query.end) || start + 299, start + 299); // max 300 per call

  const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const children = [];

  // Run all IDs in parallel (server has no browser limits)
  const results = await Promise.allSettled(ids.map(fetchOne));
  results.forEach(r => r.status === 'fulfilled' && r.value && children.push(r.value));

  res.setHeader('Cache-Control', 's-maxage=300');
  return res.status(200).json({ children, scanned: ids.length });
}
