# Design: session-3-sync

## Parallel tree building
buildDescendantTree and buildAncestorTree now run via Promise.all in app.js. They are fully independent so parallelizing halves the total wait time.

## Chunk concurrency
MAX_CHUNK_CONCURRENT raised from 4 to 10. Safe because most chunks are now Supabase cache hits (fast reads), not external API calls. Reduces scan waves from ~40 to ~17.

## GIN index
A jsonb_path_ops GIN index on chickens.data enables fast @> containment queries used by find_chickens_by_parent RPC. Eliminates full table scans that were causing 504s on /api/db-children under load.

## Stale cache bypass in fetchChicken
fetchChicken checks two staleness conditions before serving from session cache:
1. Hatched chicken (has Body attribute) but missing innate stats — stale upstream data
2. Stripped record (1-9 attrs, no innate stats) — old format missing most fields
Either condition causes cache.delete(key) and a fresh fetch via /api/chicken which falls back to Sky Mavis.

## No null caching on failure
fetchChicken no longer writes null to session cache on 404/503 responses. Rate limits can cause false 404s for real chickens, so permanent null caching would block retries for the session lifetime.

## 503 instead of 404 from chicken.js
When both chicken-api-ivory and Sky Mavis fail to return data, /api/chicken returns 503 (Upstream unavailable) instead of 404 (Not found). 503 accurately signals a temporary failure, preventing the client from treating real chickens as permanently missing.

## parent-index TTL
Index entries expire after 1 day so newly bred offspring are discovered within 24 hours of the next search.
