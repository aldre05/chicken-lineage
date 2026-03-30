// GET /api/children?parent=<id>
// Returns all known children of a parent from the parent_index table.
// Falls back to an empty list (not an error) if the table doesn't exist yet
// or Supabase is unreachable — the caller can degrade to the scan path.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/parent_index?parent_id=eq.${encodeURIComponent(parent)}&select=child_id,child_data`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!r.ok) {
      return res.status(200).json({ children: [], indexed: false });
    }

    const rows = await r.json();

    // If no rows exist yet this parent hasn't been indexed — tell the client
    // so it can fall back to the full scan and populate the index.
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ children: [], indexed: false });
    }

    const children = rows.map((row) => row.child_data);

    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ children, indexed: true });
  } catch (e) {
    // Never block the UI — degrade gracefully to scan path.
    return res.status(200).json({ children: [], indexed: false, error: e.message });
  }
};
