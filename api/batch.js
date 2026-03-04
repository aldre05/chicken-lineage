// Batch fetch - scan a range of IDs for children of a parent
// Uses smaller chunks to stay within Vercel's timeout
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { start, end, parent } = req.query;
  if (!start || !end || !parent) return res.status(400).json({ error: 'Missing params' });

  const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
  const API_KEY  = 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';
  const startId  = parseInt(start);
  const endId    = Math.min(parseInt(end), startId + 300); // smaller chunk = faster
  const parentId = String(parent);

  const ids = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);

  const fetchOne = async (id) => {
    try {
      const url = `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`;
      const r = await fetch(url, {
        headers: { 'X-API-Key': API_KEY },
        signal: AbortSignal.timeout(4000) // 4s per request
      });
      if (!r.ok) return null;
      const json = await r.json();
      const item = json?.result?.token ?? json?.result ?? json;
      const meta = item?.metadata ?? item;
      const attrs = meta?.attributes || [];
      const getAttr = name => (attrs.find(a => a.trait_type === name) || {}).value || '0';
      const p1 = String(getAttr('Parent 1'));
      const p2 = String(getAttr('Parent 2'));
      if (p1 !== parentId && p2 !== parentId) return null;
      return { token_id: String(id), image: meta?.image || '', attributes: attrs };
    } catch { return null; }
  };

  // Run in parallel batches of 30
  const children = [];
  for (let b = 0; b < ids.length; b += 30) {
    const batch = ids.slice(b, b + 30);
    const results = await Promise.all(batch.map(fetchOne));
    results.forEach(r => r && children.push(r));
    if (children.length >= 3) break; // max 3 kids per chicken
  }

  res.setHeader('Cache-Control', 's-maxage=120');
  return res.status(200).json({ children, scanned: ids.length });
}
