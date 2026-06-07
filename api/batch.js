const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const FETCH_GROUP_SIZE = 50;
const FETCH_GROUP_DELAY_MS = 30;

async function dbGet(ids) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/chickens?id=in.(${ids.join(',')})&select=id,data`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return {};
  const rows = await res.json();
  const map = {};
  // null means we already know this ID doesn't exist — skip it.
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
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(entries),
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { parent, start, end } = req.query;
  if (!parent) return res.status(400).json({ error: 'Missing parent' });

  const parentId = String(parent);
  const startId  = parseInt(start, 10) || 1;
  const endId    = parseInt(end, 10) || (startId + 499);
  const ids      = Array.from({ length: endId - startId + 1 }, (_, i) => String(startId + i));

  // Step 1: Supabase cache — includes nulls (known non-existent IDs).
  const cached = await dbGet(ids).catch(() => ({}));

  // IDs not in Supabase at all (never fetched).
  const missing = ids.filter(id => !(id in cached));

  // Step 2: Fetch uncached IDs in polite groups.
  const fresh = {};
  const toStore = [];

  for (let i = 0; i < missing.length; i += FETCH_GROUP_SIZE) {
    const group = missing.slice(i, i + FETCH_GROUP_SIZE);
    const results = await Promise.allSettled(group.map(async (id) => {
      try {
        const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`);
        if (r.status === 404) {
          // Store null so we never request this ID again.
          return { id, data: null, exists: false };
        }
        if (!r.ok) return null;
        const data = await r.json();
        return { id, data, exists: true };
      } catch { return null; }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const { id, data, exists } = r.value;
        fresh[id] = data;
        toStore.push({
          id,
          data,
          updated_at: new Date().toISOString(),
        });
        // exists=false means null data — stored to prevent future re-requests.
        if (exists) {
          // Also track in fresh map for parent matching below.
        }
      }
    }

    if (i + FETCH_GROUP_SIZE < missing.length) {
      await sleep(FETCH_GROUP_DELAY_MS);
    }
  }

  // Step 3: Write to Supabase (including nulls for 404s).
  await dbSet(toStore).catch(() => {});

  // Step 4: Filter for children of this parent — return full raw payload.
  const children = [];
  for (const id of ids) {
    // Skip nulls (known non-existent) and IDs not found.
    const raw = (id in cached ? cached[id] : fresh[id]);
    if (!raw) continue;
    const data = raw.metadata || raw;
    const attrs = data.attributes || raw.attributes || [];
    const getA = name => String((attrs.find(a => a.trait_type === name) || {}).value || '0');
    if (getA('Parent 1') === parentId || getA('Parent 2') === parentId) {
      children.push(raw);
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    children,
    scanned: ids.length,
    fromCache: ids.length - missing.length,
    fromApi: missing.length,
  });
};
