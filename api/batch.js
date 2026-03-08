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
  if (!entries.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/chickens`, {
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
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent, start, end } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const parentId = String(parent);
  const startId  = parseInt(start) || 1;
  const endId    = parseInt(end) || (startId + 499);
  const ids      = Array.from({ length: endId - startId + 1 }, (_, i) => String(startId + i));

  // Step 1: Check Supabase cache for all IDs at once
  const cached = await dbGet(ids).catch(() => ({}));
  const missing = ids.filter(id => !cached[id]);

  // Step 2: Fetch only uncached IDs from chicken-api-ivory
  const fresh = {};
  const toStore = [];
  if (missing.length > 0) {
    const results = await Promise.allSettled(missing.map(async (id) => {
      try {
        const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`);
        if (!r.ok) return null;
        const data = await r.json();
        return { id, data };
      } catch { return null; }
    }));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        fresh[r.value.id] = r.value.data;
        toStore.push(r.value);
      }
    }
    // Step 3: Save to Supabase - awaited so Vercel doesn't kill it early
    await dbSet(toStore).catch(() => {});
  }

  // Step 4: Check all IDs for parent match
  // chicken-api-ivory may wrap data inside a 'metadata' key
  const children = [];
  for (const id of ids) {
    const raw = cached[id] || fresh[id];
    if (!raw) continue;
    const data = raw.metadata || raw;
    const attrs = data.attributes || raw.attributes || [];
    const image = data.image || raw.image || '';
    const getA = name => String((attrs.find(a => a.trait_type === name) || {}).value || '0');
    if (getA('Parent 1') === parentId || getA('Parent 2') === parentId) {
      children.push({ token_id: id, image, attributes: attrs });
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    children,
    scanned: ids.length,
    fromCache: ids.length - missing.length,
    fromApi: missing.length
  });
}
