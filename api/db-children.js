// GET /api/db-children?parent=<id>
// Queries the Supabase chickens table directly for known children of this parent.
// Fast first-pass that avoids range scanning for already-cached data.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { parent } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_chickens_by_parent`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_parent_id: String(parent) }),
    });
    if (!r.ok) return res.status(200).json({ children: [] });
    const rows = await r.json();
    const children = Array.isArray(rows)
      ? rows.map((row) => row.data ? { ...row.data, token_id: String(row.id) } : null).filter(Boolean)
      : [];
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ children });
  } catch (e) {
    return res.status(200).json({ children: [], error: e.message });
  }
};
