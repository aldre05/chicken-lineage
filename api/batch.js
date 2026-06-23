const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
const SKYMAVIS_KEY = process.env.SKYMAVIS_API_KEY || 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';

const FETCH_GROUP_SIZE = 50;
const FETCH_GROUP_DELAY_MS = 30;

async function fetchFromSkyMavis(id) {
  try {
    const r = await fetch(
      `https://api-gateway.skymavis.com/skynet/ronin/web3/v2/collections/${CONTRACT}/tokens/${id}`,
      { headers: { 'X-API-Key': SKYMAVIS_KEY } }
    );
    if (!r.ok) return null;
    const json = await r.json();
    const item = json?.result?.token ?? json?.result ?? json;
    return item?.metadata ?? item ?? null;
  } catch {
    return null;
  }
}

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
  const endId    = parseInt(end, 10) || (startId + 99);
  const ids      = Array.from({ length: endId - startId + 1 }, (_, i) => String(startId + i));

  // Step 1: Supabase cache
  const cached = await dbGet(ids).catch(() => ({}));
  const missing = ids.filter(id => !(id in cached));

  // Step 2: Fetch missing IDs in polite groups — Sky Mavis fallback for rate limits
  const fresh = {};
  const toStore = [];

  for (let i = 0; i < missing.length; i += FETCH_GROUP_SIZE) {
    const group = missing.slice(i, i + FETCH_GROUP_SIZE);
    const results = await Promise.allSettled(group.map(async (id) => {
      try {
        const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`);
        if (r.status === 404) return null;
        if (r.ok) {
          const data = await r.json();
          return { id, data };
        }
        // Rate limited or server error — try Sky Mavis directly
        const skyData = await fetchFromSkyMavis(id);
        if (skyData) return { id, data: skyData };
        return null;
      } catch {
        return null;
      }
    }));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const { id, data } = r.value;
        fresh[id] = data;
        toStore.push({ id, data, updated_at: new Date().toISOString() });
      }
    }

    if (i + FETCH_GROUP_SIZE < missing.length) {
      await sleep(FETCH_GROUP_DELAY_MS);
    }
  }

  // Step 3: Save to Supabase
  await dbSet(toStore).catch(() => {});

  // Step 4: Parent match — return full raw payload
  const children = [];
  for (const id of ids) {
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
  return res.status(200).json({ children, scanned: ids.length });
};
