// Batch fetch multiple chicken IDs in parallel server-side
// Much faster than individual client fetches due to no browser request limits
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { start, end, parent } = req.query;
  if (!start || !end || !parent) {
    return res.status(400).json({ error: 'Missing start, end, or parent' });
  }

  const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
  const API_KEY  = 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';
  const startId  = parseInt(start);
  const endId    = Math.min(parseInt(end), startId + 800); // cap at 800
  const parentId = String(parent);

  const ids = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);

  // Fetch all in parallel (server has no browser concurrency limits)
  const results = await Promise.allSettled(
    ids.map(async id => {
      const url = `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`;
      const r = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
      if (!r.ok) return null;
      const json = await r.json();
      const item = json?.result?.token ?? json?.result ?? json;
      const meta = item?.metadata ?? item;
      const attrs = meta?.attributes || [];

      const getAttr = name => (attrs.find(a => a.trait_type === name) || {}).value || '0';
      const p1 = String(getAttr('Parent 1'));
      const p2 = String(getAttr('Parent 2'));

      if (p1 !== parentId && p2 !== parentId) return null;

      return {
        token_id: String(id),
        image: meta?.image || '',
        attributes: attrs
      };
    })
  );

  const children = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  res.setHeader('Cache-Control', 's-maxage=60');
  return res.status(200).json({ children, scanned: ids.length });
}
