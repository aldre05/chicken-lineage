module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent, start, end } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const parentId = String(parent);
  const startId  = parseInt(start) || 1;
  const endId    = Math.min(parseInt(end) || startId + 29, startId + 29);

  // Fetch ONLY 15288 to isolate the bug
  const r = await fetch(`https://chicken-api-ivory.vercel.app/api/15288`, {
    signal: AbortSignal.timeout(6000)
  });
  const data = await r.json();
  const attrs = data.attributes || [];
  const getA = name => String((attrs.find(a => a.trait_type === name) || {}).value || '0');
  const p1 = getA('Parent 1');
  const p2 = getA('Parent 2');
  const match = p1 === parentId || p2 === parentId;

  return res.status(200).json({ 
    parentId, parentIdType: typeof parentId,
    p1, p1Type: typeof p1,
    match,
    startId, endId,
    rangeIncludes15288: startId <= 15288 && endId >= 15288
  });
}
