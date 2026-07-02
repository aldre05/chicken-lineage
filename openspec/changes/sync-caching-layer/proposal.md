# Sync Specs with Implemented Caching Layer

## Why
The frontend and API layer gained a persistent Supabase caching system (a
`chickens` table, a `parent_index` table, and four endpoints — `/api/children`,
`/api/db-children`, `/api/index-children`, `/api/max-id`) after the specs were
originally bootstrapped from the README. None of this is reflected in
`openspec/specs/`, so the specs no longer describe the deployed system. This
is exactly the kind of drift OpenSpec is meant to prevent — any change
proposed against the current specs would be planned against a stale picture
of what's actually running.

This change contains no behavior change. It is a documentation-only sync:
bringing `openspec/specs/` into agreement with what's already deployed, so it
becomes a trustworthy baseline again.

## What Changes
- ADD a new `descendant-indexing` capability covering the parent-index-backed
  cache, DB-first lookup, scan-and-persist behavior, and dynamic max-ID
  discovery.
- MODIFY `metadata-access` to document the persistent Supabase cache for
  individual chicken metadata, alongside the existing in-memory session cache
  and provider fallback.
- Update `README.md`'s endpoint list, repo structure, and architecture
  description to include the four undocumented endpoints and the Supabase
  dependency.

## Impact
- Affected specs: `metadata-access` (modified), `descendant-indexing` (added)
- Affected code: none — this is a docs-only change
- Non-goals: this change does not alter API key handling, does not change
  scan behavior, and does not add tests
