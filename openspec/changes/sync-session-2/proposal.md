# Proposal: sync-session-2

## Summary
Sync specs with deployed code changes from the July 2026 dev session. Covers Sky Mavis fallback, sentinel removal, DB-first child lookup, scan buffer increase, and completeness check improvements.

## Problem
The following deployed behaviors are undocumented or contradict current specs:
1. `descendant-indexing` says nothing about sentinel removal — current code never writes `__none__`
2. `metadata-access` does not document the `isDataComplete` image+attrs check or Sky Mavis innate-stats fallback in `/api/batch`
3. `descendant-indexing` does not document the `SCAN_BUFFER = 3000` safety margin or the `db-children` fast-pass endpoint
4. `lineage-exploration` depth range says "2 to 5" but the UI supports 2–30

## Changes Proposed
- Update `descendant-indexing`: remove sentinel requirement, add `db-children` fast-pass, add scan buffer spec
- Update `metadata-access`: document `isDataComplete` (image + attrs), Sky Mavis fallback in batch, `db-children` endpoint
- Update `lineage-exploration`: correct depth range to 2–30
