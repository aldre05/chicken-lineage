const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// A stored record is considered stale/incomplete if it has no attributes
// (old stripped format from the previous chicken.js version).
function isComplete(data) {
  if (!data) return false;
  const src = data.metadata || data;
  const attrs = src.attributes || data.attributes || [];
  return attrs.length > 0;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  // 1. Check Supabase cache — only use it if the data looks complete.
  try {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chickens?id=eq.${encodeURIComponent(id)}&select=data&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (dbRes.ok) {
      const rows = await dbRes.json();
      if (Array.isArray(rows) && rows.length > 0 && isComplete(rows[0].data)) {
        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json(rows[0].data);
      }
    }
  } catch (_) {}

  // 2. Fetch from upstream (stale, missing, or Supabase unreachable).
  try {
    const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`);
    if (!r.ok) return res.status(r.status).json({ error: 'Not found' });
    const data = await r.json();

    // 3. Write complete data back to Supabase so future hits skip upstream.
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/chickens`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify([{ id: String(id), data, updated_at: new Date().toISOString() }]),
      });
    } catch (_) {}

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
