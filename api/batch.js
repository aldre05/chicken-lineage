module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent, start, end, concurrency } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const parentId = String(parent);
  const startId  = parseInt(start) || 1;
  const endId    = Math.min(parseInt(end) || startId + 29, startId + 29);
  const CONC     = parseInt(concurrency) || 10; // test different values
  const ids      = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);

  const children = [];
  for (let i = 0; i < ids.length; i += CONC) {
    const batch = ids.slice(i, i + CONC);
    const results = await Promise.allSettled(batch.map(async (id) => {
      try {
        const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`, {
          signal: AbortSignal.timeout(6000)
        });
        if (!r.ok) return null;
        const data = await r.json();
        const attrs = data.attributes || [];
        const getA = name => String((attrs.find(a => a.trait_type === name) || {}).value || '0');
        if (getA('Parent 1') !== parentId && getA('Parent 2') !== parentId) return null;
        return { token_id: String(id), image: data.image || '', attributes: attrs };
      } catch { return null; }
    }));
    results.forEach(r => r.status === 'fulfilled' && r.value && children.push(r.value));
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ children, scanned: ids.length, concurrency: CONC });
}
