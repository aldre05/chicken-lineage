import { BATCH_CHUNK_SIZE } from '../config/constants.js';

let cachedScanEnd = null;
let cachedScanEndTime = 0;
const SCAN_END_TTL_MS = 5 * 60 * 1000;

async function getScanEnd() {
  const now = Date.now();
  if (cachedScanEnd && (now - cachedScanEndTime) < SCAN_END_TTL_MS) {
    return cachedScanEnd;
  }
  try {
    const r = await fetch('/api/max-id');
    if (r.ok) {
      const { maxId } = await r.json();
      cachedScanEnd = maxId;
      cachedScanEndTime = now;
      return cachedScanEnd;
    }
  } catch {}
  return 25000;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Polite concurrency limiter for individual chicken fetches (ancestor tree).
// ---------------------------------------------------------------------------
const MAX_FETCH_CONCURRENT = 5;
let _fetchRunning = 0;
const _fetchQueue = [];

function acquireFetchSlot() {
  if (_fetchRunning < MAX_FETCH_CONCURRENT) {
    _fetchRunning++;
    return Promise.resolve();
  }
  return new Promise((resolve) => _fetchQueue.push(resolve));
}

function releaseFetchSlot() {
  _fetchRunning--;
  if (_fetchQueue.length > 0) {
    _fetchRunning++;
    _fetchQueue.shift()();
  }
}

// ---------------------------------------------------------------------------
// Polite concurrency limiter for batch chunk requests (descendant scan).
// ---------------------------------------------------------------------------
const MAX_CHUNK_CONCURRENT = 4;
let _chunkRunning = 0;
const _chunkQueue = [];

function acquireChunkSlot() {
  if (_chunkRunning < MAX_CHUNK_CONCURRENT) {
    _chunkRunning++;
    return Promise.resolve();
  }
  return new Promise((resolve) => _chunkQueue.push(resolve));
}

function releaseChunkSlot() {
  _chunkRunning--;
  if (_chunkQueue.length > 0) {
    _chunkRunning++;
    _chunkQueue.shift()();
  }
}

// In-flight deduplication — concurrent callers for the same ID share one fetch.
const inFlight = new Map();

export async function fetchChicken(id, cache) {
  const key = String(id);
  if (cache.has(key)) return cache.get(key);
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      // Sleep BEFORE acquiring a slot so we don't hold a slot while waiting.
      // This keeps the queue moving for other requests during the back-off.
      if (attempt > 0) {
        await sleep(attempt * 500);
      }

      await acquireFetchSlot();
      try {
        const response = await fetch(`/api/chicken?id=${encodeURIComponent(key)}`);
        if (response.ok) {
          const data = await response.json();
          cache.set(key, data);
          return data;
        }
        // 404 = chicken genuinely doesn't exist, no point retrying.
        if (response.status === 404) {
          cache.set(key, null);
          return null;
        }
        // 429 / 5xx — release slot and retry after back-off.
      } catch {
        // Network error — retry.
      } finally {
        releaseFetchSlot();
      }
    }
    // All retries exhausted — don't permanently cache so next explore retries.
    return null;
  })();

  inFlight.set(key, promise);
  promise.finally(() => inFlight.delete(key));
  return promise;
}

// Try the parent index first — single DB query, instant if already scanned.
async function findChildrenFromIndex(parentId, cache) {
  try {
    const r = await fetch(`/api/children?parent=${encodeURIComponent(parentId)}`);
    if (!r.ok) return null;
    const { children, indexed } = await r.json();
    if (!indexed) return null;

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

async function writeChildrenToIndex(parentId, allChildren) {
  try {
    await fetch('/api/index-children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, children: allChildren }),
    });
  } catch {}
}

async function findChildrenByScan(parentId, cache, setStatus) {
  const normalizedParentId = String(parentId);
  const found = [];
  const allRaw = [];
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
    await acquireChunkSlot();
    try {
      const response = await fetch(
        `/api/batch?parent=${encodeURIComponent(normalizedParentId)}&start=${start}&end=${end}`
      );
      if (!response.ok) return;
      const data = await response.json();

      for (const child of data.children || []) {
        const src = child.metadata || child;
        const childId = String(src.token_id || src.id || child.token_id);
        if (!childId || childId === 'undefined') continue;
        cache.set(childId, child);
        found.push(childId);
        allRaw.push(child);
      }
    } catch {
      // Ignore failed chunks.
    } finally {
      releaseChunkSlot();
      completed += 1;
      const pct = Math.round((completed / chunks.length) * 100);
      setStatus(`Scanning #${normalizedParentId} offspring... ${pct}% (${found.length} found)`);
    }
  }));

  writeChildrenToIndex(normalizedParentId, allRaw);
  return found;
}

export async function findChildren(parentId, { cache, setStatus }) {
  const normalizedParentId = String(parentId);

  const indexed = await findChildrenFromIndex(normalizedParentId, cache);
  if (indexed !== null) {
    setStatus(`Loaded children of #${normalizedParentId} from index (${indexed.length} found)`);
    return indexed;
  }

  return findChildrenByScan(normalizedParentId, cache, setStatus);
}
