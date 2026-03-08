const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Use Supabase's count endpoint to get total rows,
    // then fetch with a high limit to find max numeric ID
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/chickens?select=id&limit=100000`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Range-Unit': 'items',
          'Range': '0-99999'
        }
      }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows.length > 0) {
        const maxId = Math.max(...rows.map(row => parseInt(row.id, 10)));
        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json({ maxId: maxId + 500 });
      }
    }
  } catch {}

  return res.status(200).json({ maxId: 17500 });
}
