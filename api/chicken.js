const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Sky Mavis contract + API key (already in codebase via debug.js/test.js)
const CONTRACT = '0x322b3d98ddbd589dc2e8dd83659bb069828231e0';
const SKYMAVIS_KEY = process.env.SKYMAVIS_API_KEY || 'l62lam6Dt5AyU7zO6H7fK0Czz58bcPYq';

function getAttrs(data) {
  const src = data.metadata || data;
  return src.attributes || data.attributes || [];
}

function hasInnateStats(data) {
  return getAttrs(data).some(
    (a) => typeof a.trait_type === 'string' && a.trait_type.toLowerCase().startsWith('innate')
  );
}

// Complete = has image URL + non-empty attributes (old stripped format had image="" attributes=[])
function isComplete(data) {
  if (!data) return false;
  const src = data.metadata || data;
  const image = src.image || data.image || '';
  const attrs = getAttrs(data);
  return image.length > 0 && attrs.length > 0;
}

// Fetch from Sky Mavis directly — most authoritative source for current metadata.
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  // 1. Check Supabase — only trust complete data that also has innate stats.
  try {
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/chickens?id=eq.${encodeURIComponent(id)}&select=data&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (dbRes.ok) {
      const rows = await dbRes.json();
      if (Array.isArray(rows) && rows.length > 0 && isComplete(rows[0].data) && hasInnateStats(rows[0].data)) {
        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json(rows[0].data);
      }
    }
  } catch (_) {}

  // 2. Fetch from chicken-api-ivory.
  let data = null;
  try {
    const r = await fetch(`https://chicken-api-ivory.vercel.app/api/${id}`);
    if (r.ok) data = await r.json();
  } catch (_) {}

  // 3. If chicken-api-ivory returned data but is missing innate stats, try Sky Mavis.
  //    Sky Mavis has the most up-to-date metadata — chicken-api-ivory can be stale.
  if (data && !hasInnateStats(data)) {
    const skyData = await fetchFromSkyMavis(id);
    if (skyData && hasInnateStats(skyData)) {
      data = skyData;
    }
  } else if (!data) {
    // chicken-api-ivory failed entirely — go straight to Sky Mavis.
    data = await fetchFromSkyMavis(id);
  }

  if (!data) {
    return res.status(404).json({ error: 'Not found' });
  }

  // 4. Write best available data to Supabase.
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/chickens`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([{ id: String(id), data, updated_at: new Date().toISOString() }]),
    });
  } catch (_) {}

  res.setHeader('Cache-Control', 's-maxage=300');
  return res.status(200).json(data);
};
