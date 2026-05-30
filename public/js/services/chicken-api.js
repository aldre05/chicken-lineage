import { BATCH_CHUNK_SIZE } from '../config/constants.js';

let cachedScanEnd = null;

async function getScanEnd() {
  if (cachedScanEnd) return cachedScanEnd;
  try {
    const r = await fetch('/api/max-id');
    if (r.ok) {
      const { maxId } = await r.json();
      cachedScanEnd = maxId;
      return cachedScanEnd;
    }
  } catch {}
  return 17500;
}

// In-flight deduplication — concurrent callers for the same ID share one request.
const inFlight = new Map();

export async function fetchChicken(id, cache) {
  const key = String(id);
  if (cache.has(key)) return cache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    try {
      const response = await fetch(`https://chicken-api-ivory.vercel.app/api/${key}`);
      if (!response.ok) { cache.set(key, null); return null; }
      const data = await response.json();
      cache.set(key, data);
      return data;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

// Try the parent index first — single DB query, instant if already scanned.
async function findChildrenFromIndex(parentId, cache) {
  try {
    const r = await fetch(`/api/children?parent=${encodeURIComponent(parentId)}`);
    if (!r.ok) return null;
    const { children, indexed } = await r.json();
    if (!indexed) return null;

    // Warm the client-side cache with the full raw data returned from index.
    for (const child of children) {
      const childId = String(child.token_id || child.id || (child.metadata && child.metadata.token_id));
      if (childId) cache.set(childId, child);
    }
    return children.map((child) =>
      String(child.token_id || child.id || (child.metadata && child.metadata.token_id))
    ).filter(Boolean);
  } catch {
    return null;
  }
}

// Write all discovered children into the index ONCE after the full scan
// completes — never partial, so the index is always complete or absent.
// Always called even for empty results so a sentinel gets written and
// future lookups don't fall back to a full scan unnecessarily.
async function writeChildrenToIndex(parentId, allChildren) {
  try {
    await fetch('/api/index-children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, children: allChildren }),
    });
  } catch {
    // Non-fatal — next scan will just re-index.
  }
}

async function findChildrenByScan(parentId, cache, setStatus) {
  const normalizedParentId = String(parentId);
  const found = [];        // child IDs
  const allRaw = [];       // full raw payloads for indexing
  const scanStart = Number.parseInt(normalizedParentId, 10) + 1;
  const scanEnd = await getScanEnd();

  if (Number.isNaN(scanStart) || scanStart > scanEnd) return found;

  const chunks = [];
  for (let start = scanStart; start <= scanEnd; start += BATCH_CHUNK_SIZE) {
    chunks.push([start, Math.min(start + BATCH_CHUNK_SIZE - 1, scanEnd)]);
  }

  setStatus(`Scanning #${normalizedParentId} offspring... 0% (0 found)`);
  let completed = 0;

  await Promise.all(chunks.map(async ([start, end]) => {
    try {
      const response = await fetch(
        `/api/batch?parent=${encodeURIComponent(normalizedParentId)}&start=${start}&end=${end}`
      );
      if (!response.ok) return;
      const data = await response.json();

      for (const child of data.children || []) {
        // batch.js now returns full raw payloads — derive the ID correctly.
        const src = child.metadata || child;
        const childId = String(src.token_id || src.id || child.token_id);
        if (!childId || childId === 'undefined') continue;
        cache.set(childId, child);
        found.push(childId);
        allRaw.push(child);
      }
    } catch {
      // Ignore failed chunks and keep scanning.
    } finally {
      completed += 1;
      const pct = Math.round((completed / chunks.length) * 100);
      setStatus(`Scanning #${normalizedParentId} offspring... ${pct}% (${found.length} found)`);
    }
  }));

  // Write the complete child list to the index now that the scan is done.
  writeChildrenToIndex(normalizedParentId, allRaw);

  return found;
}

export async function findChildren(parentId, { cache, setStatus }) {
  const normalizedParentId = String(parentId);

  // Fast path: index hit — no scanning needed.
  const indexed = await findChildrenFromIndex(normalizedParentId, cache);
  if (indexed !== null) {
    setStatus(`Loaded children of #${normalizedParentId} from index (${indexed.length} found)`);
    return indexed;
  }

  // Slow path: full range scan + index write for next time.
  return findChildrenByScan(normalizedParentId, cache, setStatus);
}
