import {
  BATCH_CHUNK_SIZE,
} from '../config/constants.js';

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
  return 17500; // safe fallback
}

// Tracks in-flight fetch promises so concurrent callers for the same ID
// share one network request instead of firing duplicates.
const inFlight = new Map();

export async function fetchChicken(id, cache) {
  const key = String(id);

  // Return immediately if already resolved and cached.
  if (cache.has(key)) {
    return cache.get(key);
  }

  // Return the in-flight promise if a request is already underway.
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = (async () => {
    try {
      const response = await fetch(`https://chicken-api-ivory.vercel.app/api/${key}`);

      if (!response.ok) {
        cache.set(key, null);
        return null;
      }

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

// Try the parent index first — a single DB query that returns results instantly
// if this parent has been scanned before. Falls back to the full range scan
// if the index has no entry yet (first time this parent is explored).
async function findChildrenFromIndex(parentId, cache) {
  try {
    const r = await fetch(`/api/children?parent=${encodeURIComponent(parentId)}`);
    if (!r.ok) return null;
    const { children, indexed } = await r.json();
    if (!indexed) return null; // not in index yet, fall back to scan

    // Warm the client cache with the returned child data.
    for (const child of children) {
      cache.set(String(child.token_id), child);
    }
    return children.map((child) => String(child.token_id));
  } catch {
    return null; // network error — fall back to scan
  }
}

async function findChildrenByScan(parentId, cache, setStatus) {
  const normalizedParentId = String(parentId);
  const found = [];
  const scanStart = Number.parseInt(normalizedParentId, 10) + 1;
  const scanEnd = await getScanEnd();

  if (Number.isNaN(scanStart) || scanStart > scanEnd) {
    return found;
  }

  const chunks = [];
  for (let start = scanStart; start <= scanEnd; start += BATCH_CHUNK_SIZE) {
    chunks.push([start, Math.min(start + BATCH_CHUNK_SIZE - 1, scanEnd)]);
  }

  setStatus(`Scanning #${normalizedParentId} offspring... 0% (0 found)`);

  let completed = 0;

  await Promise.all(chunks.map(async ([start, end], chunkIndex) => {
    try {
      const isLast = chunkIndex === chunks.length - 1 ? '1' : '0';
      const response = await fetch(
        `/api/batch?parent=${encodeURIComponent(normalizedParentId)}&start=${start}&end=${end}&last=${isLast}`
      );

      if (!response.ok) return;

      const data = await response.json();

      for (const child of data.children || []) {
        cache.set(String(child.token_id), child);
        found.push(String(child.token_id));
      }
    } catch {
      // Ignore failed chunks and keep scanning.
    } finally {
      completed += 1;
      const percentage = Math.round((completed / chunks.length) * 100);
      setStatus(`Scanning #${normalizedParentId} offspring... ${percentage}% (${found.length} found)`);
    }
  }));

  return found;
}

export async function findChildren(parentId, { cache, setStatus }) {
  const normalizedParentId = String(parentId);

  // Fast path: check the parent index first (single DB query, no scanning).
  const indexed = await findChildrenFromIndex(normalizedParentId, cache);
  if (indexed !== null) {
    setStatus(`Loaded children of #${normalizedParentId} from index (${indexed.length} found)`);
    return indexed;
  }

  // Slow path: full range scan — also populates the index for next time.
  return findChildrenByScan(normalizedParentId, cache, setStatus);
}
