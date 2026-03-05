module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent, start, end } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
  const API_KEY  = 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';
  const parentId = String(parent);
  const startId  = parseInt(start) || 1;
  const endId    = Math.min(parseInt(end) || startId + 99, startId + 99); // 100 IDs max

  const ids = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);

  // All IDs fully parallel - 100 concurrent requests, each with 4s timeout
  // At ~200ms avg per request, completes in ~200ms total (parallel)
  const results = await Promise.allSettled(ids.map(async (id) => {
    try {
      const r = await fetch(
        `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`,
        { headers: { 'X-API-Key': API_KEY }, signal: AbortSignal.timeout(4000) }
      );
      if (!r.ok) return null;
      const json = await r.json();
      const item = json?.result?.token ?? json?.result ?? json;
      const meta = item?.metadata ?? item;
      const attrs = meta?.attributes || [];
      const getA = name => String((attrs.find(a => a.trait_type === name) || {}).value || '0');
      if (getA('Parent 1') !== parentId && getA('Parent 2') !== parentId) return null;
      return { token_id: String(id), image: meta?.image || '', attributes: attrs };
    } catch { return null; }
  }));

  const children = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
  res.setHeader('Cache-Control', 's-maxage=600');
  return res.status(200).json({ children, scanned: ids.length });
}
