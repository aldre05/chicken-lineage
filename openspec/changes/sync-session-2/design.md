# Design: sync-session-2

## descendant-indexing changes

### Sentinel removal
Previous design wrote a `__none__` sentinel row to `parent_index` when a scan found zero children, preventing re-scans. This is removed. Chickens may be bred at any time, so a childless result must never be treated as permanent. The index is now only written when children are found; childless parents are simply re-scanned on every exploration.

### DB-first fast-pass via `/api/db-children`
Before the token range scan, the system calls `/api/db-children?parent=<id>`, which invokes the Supabase `find_chickens_by_parent` RPC. This returns any already-cached children immediately. If children are found, they are displayed while the range scan continues in the background to find uncached offspring. The RPC searches both `data->'attributes'` and `data->'metadata'->'attributes'` and matches both string and integer representations of the parent ID.

### Scan buffer
The upper bound for range scanning is `MAX(id) + SCAN_BUFFER` where `SCAN_BUFFER = 3000`, with a floor of `FALLBACK_MAX_ID = 25000`. This ensures newly minted tokens above the current Supabase max are always included in scans.

### Partial scan indexing
If a scan completes with some failed chunks, any children found are still written to the index. The index entry is not treated as complete, so the next exploration will re-scan and may find additional children missed by the failed chunks.

## metadata-access changes

### isDataComplete check
`/api/chicken` and `/api/batch` both use an `isDataComplete(data)` guard before trusting Supabase cache entries. A record is considered complete only if it has a non-empty `image` URL AND a non-empty `attributes` array (checked at both top-level and under `metadata`). Old stripped records with `image: ''` or `attributes: []` are treated as incomplete and re-fetched.

### Sky Mavis fallback in `/api/chicken`
After fetching from the Chicken Saga proxy, if the result lacks innate stats (no attribute with `trait_type` starting with "innate"), the system falls back to the Sky Mavis token API (`api-gateway.skymavis.com`). This covers stale proxy records that predate the Ronin L2 migration (May 2026).

### Sky Mavis fallback in `/api/batch`
`/api/batch` also falls back to Sky Mavis per-token when the Chicken Saga proxy returns a non-200, non-404 response (e.g. 429 rate limit). This ensures descendants can be discovered even under heavy rate limiting.

### `/api/db-children` endpoint
New endpoint. Calls the `find_chickens_by_parent(p_parent_id text)` Supabase RPC and returns `{ children: RawChickenData[] }`. Each child object has `token_id` injected from the database row's `id` column so the client can derive the child's ID even when the stored payload lacks a top-level `token_id` field.

## lineage-exploration changes

### Depth range correction
UI supports depth 2–30, not 2–5 as previously documented.
