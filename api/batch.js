module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent, start, end } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const parentId = String(parent);
  const startId  = parseInt(start) || 1;
  const endId    = parseInt(end) || (startId + 29);
  const ids      = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);

  const children = [];
  for (const id of ids) {
    try {
      const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`);
      if (!r.ok) continue;
      const data = await r.json();
      const attrs = data.attributes || [];
      const getA = name => String((attrs.find(a => a.trait_type === name) || {}).value || '0');
      if (getA('Parent 1') === parentId || getA('Parent 2') === parentId) {
        children.push({ token_id: String(id), image: data.image || '', attributes: attrs });
      }
    } catch { continue; }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ children, scanned: ids.length });
}
