# Design

This is a retroactive documentation change, not a new design decision — the
behavior described here already exists in the codebase. Recording it here so
future changes have an accurate technical picture to plan against.

## Persistent cache (Supabase `chickens` table)
- `/api/chicken` checks Supabase first, but only trusts an entry if it's
  "complete" (has an image URL and non-empty attributes) AND includes innate
  stats — otherwise it treats the cache as a miss and re-fetches from
  `chicken-api-ivory`, falling back to Sky Mavis if stats are still missing.
- Every successful fetch is written back to Supabase (best-effort, failures
  are swallowed so they don't block the response).

## Parent index (Supabase `parent_index` table)
- `/api/children` checks whether a parent has already been fully indexed. A
  legacy `__none__` sentinel value is treated as "not indexed" and forces a
  fresh scan.
- `/api/db-children` is a faster first-pass query directly against the
  `chickens` table via an RPC (`find_chickens_by_parent`), tried before
  falling back to a full token-range scan.
- `/api/index-children` writes scan results after a full scan completes.
  Zero-result scans are never written as a sentinel — intentional, so
  childless chickens are re-checked on future explorations in case they're
  bred later.

## Dynamic scan bound (`/api/max-id`)
- Tries an RPC (`get_max_chicken_id`) first, falls back to a direct query
  ordering the `chickens` table by ID, falls back to a hardcoded floor
  (25000) if both fail.
- The client caches this result for 5 minutes (`SCAN_END_TTL_MS`) to avoid
  hitting the endpoint on every explore.

## Client-side concurrency control
- `chicken-api.js` runs two independent concurrency limiters
  (`MAX_FETCH_CONCURRENT = 5` for individual metadata fetches,
  `MAX_CHUNK_CONCURRENT = 4` for batch scan chunks) plus in-flight request
  de-duplication — none of which were previously documented anywhere.
