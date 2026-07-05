# descendant-indexing Specification

## Purpose
Describes the persistent parent-to-children indexing system that reduces the cost of repeated descendant range scans by caching results in Supabase.

## Requirements

### Requirement: System performs a fast direct lookup before falling back to a range scan
The system SHALL query the Supabase `find_chickens_by_parent` RPC via `/api/db-children` to retrieve any already-cached children of a parent before performing a full token ID range scan.

#### Scenario: DB-first descendant lookup
- **WHEN** a descendant scan begins for a parent that is not yet fully indexed
- **THEN** the system first calls `/api/db-children` to return any known children from the persistent cache before scanning the remaining token range

### Requirement: System maintains a persistent parent-to-children index
The system SHALL persist discovered children for a given parent in a Supabase-backed `parent_index` table so future descendant lookups for the same parent return results from the index instead of re-scanning.

#### Scenario: Reuse indexed children
- **WHEN** a parent has a valid, non-expired index entry
- **THEN** the system returns the indexed children directly instead of performing a new range scan

### Requirement: Index entries expire after 1 day
The system SHALL treat `parent_index` entries older than 1 day as expired and return `indexed: false`, triggering a fresh scan. This ensures newly bred offspring are discovered within 1 day of the next search, since a chicken's breed count can increase at any time.

#### Scenario: Expired index triggers re-scan
- **WHEN** a parent has an index entry whose `indexed_at` timestamp is older than 1 day
- **THEN** the system returns `indexed: false` so the client performs a fresh range scan

#### Scenario: Fresh index is served directly
- **WHEN** a parent has an index entry whose `indexed_at` timestamp is within 1 day
- **THEN** the system returns the indexed children without scanning

### Requirement: System never marks a parent as permanently childless
The system SHALL NOT write any sentinel or placeholder value to the index when a scan finds zero children. Childless results are not persisted, so future explorations always re-scan in case offspring were bred since the last scan.

#### Scenario: Childless parent is retried on future exploration
- **WHEN** a range scan for a parent finds zero children
- **THEN** the system writes nothing to the index and future explorations perform a fresh scan

### Requirement: System writes partial scan results to the index
The system SHALL write discovered children to the index even when some scan chunks failed, so repeat searches within the TTL window benefit from partial results.

#### Scenario: Persist partial scan results
- **WHEN** a descendant range scan finishes with some failed chunks but at least one child found
- **THEN** the system writes the discovered children to the index

### Requirement: System determines the descendant scan upper bound dynamically
The system SHALL determine the upper bound for descendant range scanning by querying the highest known token ID plus a safety buffer of 3000, falling back to a fixed floor of 25000 if that query fails.

#### Scenario: Determine max token ID
- **WHEN** a descendant scan needs an upper bound for its token ID range
- **THEN** the system queries for the current highest known token ID and adds 3000 to ensure newly minted tokens are included

#### Scenario: Fallback when max ID lookup fails
- **WHEN** the current highest known token ID cannot be determined
- **THEN** the system uses 25000 as the scan ceiling
