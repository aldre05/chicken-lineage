# Design: search-performance

## Parallel tree building
`buildDescendantTree` and `buildAncestorTree` are fully independent — neither needs the other's result. Wrapping both in `Promise.all` lets them run concurrently. The render step still waits for both via destructuring.

## Chunk concurrency increase
`MAX_CHUNK_CONCURRENT` controls how many `/api/batch` requests run simultaneously in the browser. Increasing from 4 to 10 speeds up scans ~2.5x. Risk is low because:
- Supabase can handle high read concurrency easily
- External API calls (chicken-api-ivory, Sky Mavis) only happen for uncached IDs, which are now a minority after weeks of scanning
- Rate limits on external APIs are per-token, not per-connection

## No changes to batch size or external fetch behavior
`BATCH_CHUNK_SIZE` stays at 100. The Sky Mavis and chicken-api-ivory fetch logic inside `/api/batch` is unchanged.
