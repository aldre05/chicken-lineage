const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Supabase REST: order by id cast to int descending, limit 1
    // We need to use a raw SQL approach via the rpc endpoint
    // But simplest: just check what the total count is, then paginate to find max
    
    // Get count first
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chickens?select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'count=exact',
          'Range': '0-0'
        }
      }
    );
    
    if (countRes.ok) {
      const contentRange = countRes.headers.get('content-range');
      // content-range format: "0-0/13947"
      const total = parseInt(contentRange?.split('/')[1] || '0', 10);
      
      if (total > 0) {
        // Fetch last page to get highest IDs
        const pageSize = 1000;
        const lastPageStart = Math.max(0, total - pageSize);
        
        const pageRes = await fetch(
          `${SUPABASE_URL}/rest/v1/chickens?select=id`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Range': `${lastPageStart}-${total}`
            }
          }
        );
        
        if (pageRes.ok) {
          const rows = await pageRes.json();
          const maxId = Math.max(...rows.map(row => parseInt(row.id, 10)));
          res.setHeader('Cache-Control', 's-maxage=300');
          return res.status(200).json({ maxId: maxId + 500, total, debug: `last page from ${lastPageStart}` });
        }
      }
    }
  } catch (e) {
    return res.status(200).json({ maxId: 17500, error: e.message });
  }

  return res.status(200).json({ maxId: 17500 });
}
