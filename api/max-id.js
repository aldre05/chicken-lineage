const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Fetch all IDs from Supabase and find numeric max
    // (can't use order=id.desc because id is text - sorts alphabetically)
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/chickens?select=id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows.length > 0) {
        const maxId = Math.max(...rows.map(row => parseInt(row.id)));
        res.setHeader('Cache-Control', 's-maxage=300'); // cache 5 min
        return res.status(200).json({ maxId: maxId + 500 });
      }
    }
  } catch {}

  return res.status(200).json({ maxId: 17500 });
}
