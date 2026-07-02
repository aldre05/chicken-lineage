# descendant-indexing Specification

## Purpose
Describes the persistent parent-to-children indexing system that reduces the cost of repeated descendant range scans by caching results in Supabase.

## Requirements
### Requirement: System maintains a persistent parent-to-children index
The system SHALL persist discovered children for a given parent in a Supabase-backed parent index, so future descendant lookups for the same parent do not require re-scanning the token ID range.

#### Scenario: Reuse indexed children
- **WHEN** a parent has previously been fully indexed
- **THEN** the system returns the indexed children directly instead of performing a new range scan

### Requirement: System performs a fast direct lookup before falling back to a range scan
The system SHALL query the persistent cache directly for known children of a parent before performing a full token ID range scan.

#### Scenario: DB-first descendant lookup
- **WHEN** a descendant scan begins for a parent that is not yet fully indexed
- **THEN** the system first queries the database directly for any already-cached children of that parent before scanning the remaining token range

### Requirement: System persists scan results after a completed range scan
The system SHALL write newly discovered children to the parent index after a range scan completes, without writing a sentinel value when zero children are found.

#### Scenario: Persist scan results
- **WHEN** a descendant range scan finishes for a parent
- **THEN** the system writes the discovered children to the parent index

#### Scenario: Childless parent is retried on future exploration
- **WHEN** a range scan for a parent finds zero children
- **THEN** the system does not mark that parent as permanently childless, so future explorations re-scan it in case new offspring were bred since

### Requirement: System determines the descendant scan upper bound dynamically
The system SHALL determine the upper bound for descendant range scanning by querying the highest known token ID plus a safety buffer, falling back to a fixed floor value if that query fails.

#### Scenario: Determine max token ID
- **WHEN** a descendant scan needs an upper bound for its token ID range
- **THEN** the system queries for the current highest known token ID and adds a safety buffer to determine the scan's upper bound

#### Scenario: Fallback when max ID lookup fails
- **WHEN** the current highest known token ID cannot be determined
- **THEN** the system uses a fixed fallback ceiling for the scan's upper bound
