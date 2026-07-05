# Proposal: search-performance

## Summary
Reduce perceived and actual search time by parallelizing ancestor/descendant tree building and increasing chunk concurrency.

## Problem
Two bottlenecks identified:

1. **Sequential tree building** — `app.js` awaits `buildDescendantTree` fully before starting `buildAncestorTree`. These are independent operations and should run in parallel.

2. **Low chunk concurrency** — `MAX_CHUNK_CONCURRENT = 4` means 170+ chunks process in 40+ sequential waves. Most chunks are now Supabase cache hits (fast), so this limit is overly conservative. External API rate limit risk is low since uncached IDs are the minority.

## Proposed Changes
- Run `buildDescendantTree` and `buildAncestorTree` in parallel via `Promise.all` in `app.js`
- Increase `MAX_CHUNK_CONCURRENT` from 4 to 10 in `chicken-api.js`

## Files Changed
- `public/js/app.js` — parallel tree building
- `public/js/services/chicken-api.js` — higher chunk concurrency
