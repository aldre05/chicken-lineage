const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function dbGet(ids) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/chickens?id=in.(${ids.join(',')})&select=id,data`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return {};
  const rows = await res.json();
  const map = {};
  for (const row of rows) map[row.id] = row.data;
  return map;
}

async function dbSet(entries) {
  if (!entries.length) return { ok: true };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/chickens`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(entries.map(e => ({
      id: e.id,
      data: e.data,
      updated_at: new Date().toISOString()
    })))
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 300) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent, start, end } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const parentId = String(parent);
  const startId  = parseInt(start) || 1;
  const endId    = parseInt(end) || (startId + 499);
  // Test with just 5 IDs around 15288 for diagnosis
  const ids = ['15285','15286','15287','15288','15289'];

  // Step 1: Check cache
  const cached = await dbGet(ids).catch(e => ({ _error: e.message }));

  // Step 2: Fetch missing from API
  const missing = ids.filter(id => !cached[id]);
  const toStore = [];
  const fresh = {};
  for (const id of missing) {
    try {
      const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`);
      if (!r.ok) continue;
      const data = await r.json();
      fresh[id] = data;
      toStore.push({ id, data });
    } catch {}
  }

  // Step 3: Save to Supabase (await this time for diagnosis)
  const saveResult = await dbSet(toStore).catch(e => ({ error: e.message }));

  return res.status(200).json({
    supabaseUrl: SUPABASE_URL ? 'set' : 'MISSING',
    supabaseKey: SUPABASE_KEY ? 'set' : 'MISSING',
    cachedCount: Object.keys(cached).length,
    cachedError: cached._error || null,
    missingCount: missing.length,
    fetchedCount: toStore.length,
    saveResult
  });
}
