module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent, start, end } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const parentId = String(parent);
  const startId  = parseInt(start) || 1;
  const endId    = parseInt(end) || (startId + 29);
  const ids      = Array.from({ length: endId - startId + 1 }, (_, i) => startId + i);

  const debug = [];
  const children = [];

  for (const id of ids) {
    try {
      const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`); // no timeout
      const status = r.status;
      if (!r.ok) { debug.push({id, status, skip:'not ok'}); continue; }
      const data = await r.json();
      const attrs = data.attributes || [];
      const getA = name => String((attrs.find(a => a.trait_type === name) || {}).value || '0');
      const p1 = getA('Parent 1');
      const p2 = getA('Parent 2');
      const match = p1 === parentId || p2 === parentId;
      if (id === 15288) debug.push({id, status, p1, p2, parentId, match});
      if (match) children.push({ token_id: String(id), image: data.image || '', attributes: attrs });
    } catch(e) { 
      if (id === 15288) debug.push({id, error: e.message});
      continue; 
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ children, scanned: ids.length, debug });
}
