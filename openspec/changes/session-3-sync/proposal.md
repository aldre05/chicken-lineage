# Proposal: session-3-sync

## Summary
Sync specs with deployed changes from the July 6 2026 dev session. Covers performance improvements, GIN index, stale cache bypass, egg detection, and error handling improvements.

## Changes Made
1. Parallel tree building in app.js
2. Chunk concurrency increased to 10
3. GIN index on chickens.data for fast JSONB queries
4. fetchChicken bypasses session cache for stale hatched chickens
5. fetchChicken no longer caches null on 404/503
6. chicken.js returns 503 instead of 404 when upstream unavailable
7. parent-index TTL set to 1 day

## Files Changed
- public/js/app.js
- public/js/services/chicken-api.js
- api/chicken.js
- api/children.js
- Supabase: GIN index on chickens table
