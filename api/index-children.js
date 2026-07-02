// POST /api/index-children
// Body: { parentId: string, children: RawChickenData[] }
//
// Called after a full scan completes — writes found children to parent_index.
// If children is empty, does nothing (no sentinel written). This means
// childless chickens are re-scanned on every search, which is intentional —
// they may get offspring at any time from breeding.

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

  // Nothing to write — don't mark as childless, just return.
  // Next search will re-scan and may find newly bred offspring.
  if (children.length === 0) {
    return res.status(200).json({ indexed: 0 });
  }

  try {
    // Delete stale rows for this parent first so we always have a clean write.
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

    // Write all children in one upsert.
    const rows = children.map((child) => {
      const src = child.metadata || child;
      const childId = String(src.token_id || src.id || child.token_id);
      return {
        parent_id: parentId,
        child_id: childId,
        child_data: child,
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
