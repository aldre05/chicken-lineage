const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Call Supabase RPC function: SELECT MAX(id::integer) FROM chickens
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_max_chicken_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    if (r.ok) {
      const maxId = await r.json(); // returns a single integer
      if (maxId && maxId > 0) {
        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json({ maxId: parseInt(maxId, 10) + 500 });
      }
    }
  } catch (e) {
    return res.status(200).json({ maxId: 17500, error: e.message });
  }

  return res.status(200).json({ maxId: 17500 });
}
