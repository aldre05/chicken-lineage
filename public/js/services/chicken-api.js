import {
  BATCH_CHUNK_SIZE,
  BATCH_PARALLEL_REQUESTS,
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

export async function fetchChicken(id, cache) {
  const key = String(id);

  if (cache.has(key)) {
    return cache.get(key);
  }

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
  }
}

export async function findChildren(parentId, { cache, setStatus }) {
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

  for (let index = 0; index < chunks.length; index += BATCH_PARALLEL_REQUESTS) {
    const percentage = Math.round((index / chunks.length) * 100);
    setStatus(`Scanning #${normalizedParentId} offspring... ${percentage}% (${found.length} found)`);

    const currentBatch = chunks.slice(index, index + BATCH_PARALLEL_REQUESTS);

    await Promise.all(currentBatch.map(async ([start, end]) => {
      try {
        const response = await fetch(`/api/batch?parent=${encodeURIComponent(normalizedParentId)}&start=${start}&end=${end}`);

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        for (const child of data.children || []) {
          cache.set(String(child.token_id), child);
          found.push(String(child.token_id));
        }
      } catch {
        // Ignore failed chunks and keep scanning.
      }
    }));
  }

  return found;
}
