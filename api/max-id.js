const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Get the highest ID stored in Supabase
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/chickens?select=id&order=id.desc&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows.length > 0) {
        const maxId = Math.max(...rows.map(row => parseInt(row.id)));
        // Add a buffer of 500 to catch any newly minted chickens not yet cached
        res.setHeader('Cache-Control', 's-maxage=300'); // cache for 5 min
        return res.status(200).json({ maxId: maxId + 500 });
      }
    }
  } catch {}

  // Fallback to a safe default
  return res.status(200).json({ maxId: 17500 });
}
