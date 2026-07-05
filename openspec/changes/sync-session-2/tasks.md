# Tasks: parent-index-ttl

## Status: READY TO IMPLEMENT

- [ ] Update `api/children.js`
  - Add `INDEX_TTL_DAYS = 1` and `INDEX_TTL_MS` constants
  - Add `indexed_at` to the Supabase select query
  - After confirming valid rows, check age vs TTL — return `indexed: false` if expired

- [ ] Update `openspec/specs/descendant-indexing/spec.md`
  - Add requirement: index entries expire after 1 day and trigger a re-scan
