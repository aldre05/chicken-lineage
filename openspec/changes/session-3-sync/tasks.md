# Tasks: session-3-sync

## Status: READY TO ARCHIVE
All changes deployed. Spec updates required.

- [ ] openspec/specs/lineage-exploration/spec.md
  - Add: trees build in parallel via Promise.all
  - Add: chunk concurrency is 10

- [ ] openspec/specs/metadata-access/spec.md
  - Add: fetchChicken bypasses session cache for stale hatched chickens and stripped records
  - Add: no null caching on 404/503
  - Add: /api/chicken returns 503 when upstream unavailable
  - Add: GIN index on chickens.data

- [ ] openspec/specs/descendant-indexing/spec.md
  - Already updated with TTL in previous session
