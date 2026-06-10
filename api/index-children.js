// POST /api/index-children
// Body: { parentId: string, children: RawChickenData[] }
//
// Called once after a full scan completes — writes the complete child list
// for a parent into parent_index. Never called with partial data, so the
// index is always either absent or complete.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { parentId, children } = req.body || {};
  if (!parentId) return res.status(400).json({ error: 'Missing parentId' });
  if (!Array.isArray(children)) return res.status(400).json({ error: 'children must be an array' });

  try {
    // First delete any stale rows for this parent so we always have a clean write.
    await fetch(
      `${SUPABASE_URL}/rest/v1/parent_index?parent_id=eq.${encodeURIComponent(parentId)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    // If the parent genuinely has no children, mark it as indexed-but-empty
    // using a sentinel row so future lookups don't fall back to a scan.
    if (children.length === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/parent_index`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          parent_id: parentId,
          child_id: '__none__',
          child_data: {},
          indexed_at: new Date().toISOString(),
        }]),
      });
      return res.status(200).json({ indexed: 0 });
    }

    // Write all children in one upsert.
    const rows = children.map((child) => {
      const src = child.metadata || child;
      const childId = String(src.token_id || src.id || child.token_id);
      return {
        parent_id: parentId,
        child_id: childId,
        child_data: child,   // full raw payload preserved
        indexed_at: new Date().toISOString(),
      };
    });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/parent_index`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: err });
    }

    return res.status(200).json({ indexed: rows.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
