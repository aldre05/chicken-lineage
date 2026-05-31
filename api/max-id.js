const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Hardcoded floor — raised to cover all currently known chickens.
// The RPC/table query will supersede this once the cache is populated.
const FALLBACK_MAX_ID = 25000;
const SCAN_BUFFER = 1000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Strategy 1: Call the RPC function (SELECT MAX(id::integer) FROM chickens)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_max_chicken_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (r.ok) {
      const maxId = await r.json();
      if (maxId && maxId > 0) {
        const result = Math.max(parseInt(maxId, 10) + SCAN_BUFFER, FALLBACK_MAX_ID);
        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json({ maxId: result });
      }
    }
  } catch (_) {}

  // Strategy 2: Query the chickens table directly — no RPC needed.
  // Orders by id length DESC then value DESC so numeric ordering works on TEXT.
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/chickens?select=id&order=id.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (r.ok) {
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length > 0) {
        // rows[0].id is TEXT — find the actual numeric max across all returned rows
        const maxId = parseInt(rows[0].id, 10);
        if (!isNaN(maxId) && maxId > 0) {
          const result = Math.max(maxId + SCAN_BUFFER, FALLBACK_MAX_ID);
          res.setHeader('Cache-Control', 's-maxage=300');
          return res.status(200).json({ maxId: result });
        }
      }
    }
  } catch (_) {}

  // Strategy 3: Hardcoded floor — always safe to scan up to this point.
  return res.status(200).json({ maxId: FALLBACK_MAX_ID });
};
