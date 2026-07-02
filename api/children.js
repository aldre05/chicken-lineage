// GET /api/children?parent=<id>
// Returns all known children of a parent from the parent_index table.
// Returns indexed:false if not scanned yet so caller falls back to scan.

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

    if (!r.ok) return res.status(200).json({ children: [], indexed: false });

    const rows = await r.json();

    // No rows at all — not indexed yet, tell client to scan.
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ children: [], indexed: false });
    }

    // __none__ sentinel rows are legacy — treat as not indexed so a fresh scan runs.
    if (rows.length === 1 && rows[0].child_id === '__none__') {
      return res.status(200).json({ children: [], indexed: false });
    }

    // Filter out any sentinel rows and return full raw child data.
    const children = rows
      .filter((row) => row.child_id !== '__none__' && row.child_data)
      .map((row) => row.child_data);

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({ children, indexed: true });
  } catch (e) {
    return res.status(200).json({ children: [], indexed: false, error: e.message });
  }
};
