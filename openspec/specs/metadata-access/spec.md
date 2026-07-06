# metadata-access Specification

## Purpose
Describes how the system fetches, validates, caches, and normalizes chicken metadata from upstream providers, including fallback strategies, persistent caching, stale cache detection, and error handling.

## Requirements

### Requirement: System fetches metadata for explored chickens
The system SHALL fetch metadata for the selected chicken and for recursively discovered ancestors and descendants.

#### Scenario: Load metadata during exploration
- **WHEN** a lineage exploration starts or expands to related chickens
- **THEN** the system retrieves metadata for each required chicken to continue building the lineage

### Requirement: System caches fetched chickens during a session
The system SHALL maintain an in-memory cache of fetched chicken records during a client session.

#### Scenario: Reuse previously fetched chicken data
- **WHEN** a chicken already fetched in the current session is needed again
- **THEN** the system reuses the cached record instead of requiring a duplicate fetch for that session

### Requirement: System bypasses session cache for stale hatched chickens
The system SHALL detect and bypass stale session cache entries to ensure hatched chickens always display current innate stats. Two conditions trigger a bypass:
1. The cached record has a Body attribute (hatched chicken) but no innate stats
2. The cached record has between 1 and 9 attributes and no innate stats (stripped old format)

When either condition is met, the system removes the entry from the session cache and re-fetches via `/api/chicken`.

#### Scenario: Bypass stale cache for hatched chicken
- **WHEN** fetchChicken finds a session-cached record with a Body attribute but no innate stats
- **THEN** the system clears the cache entry and fetches fresh data from the server

#### Scenario: Bypass stripped record in session cache
- **WHEN** fetchChicken finds a session-cached record with fewer than 10 attributes and no innate stats
- **THEN** the system clears the cache entry and fetches fresh data from the server

### Requirement: System does not cache failed fetch results
The system SHALL NOT write null to the session cache when a fetch returns 404 or 503. Rate limits can cause false negatives for real chickens, so failed results must be retried on the next exploration rather than permanently blocked.

#### Scenario: Failed fetch is not cached
- **WHEN** fetchChicken receives a 404 or 503 response for a chicken
- **THEN** the system returns null without writing to the session cache so the next exploration retries

### Requirement: System maintains a persistent metadata cache across sessions
The system SHALL persist fetched chicken metadata in a Supabase-backed store so metadata already retrieved by any user can be reused without re-fetching from upstream providers. A GIN index on the data column enables fast JSONB containment queries used by the parent-child lookup RPC.

#### Scenario: Reuse across sessions
- **WHEN** a chicken's metadata has already been persisted from a prior request by any client
- **THEN** subsequent requests for that chicken can be served from the persistent cache instead of requiring a fresh upstream fetch

### Requirement: System validates persistent cache entries before trusting them
The system SHALL only serve a Supabase-cached record when it is complete (non-empty image URL and non-empty attributes) and includes innate stats. Incomplete or stats-lacking records are treated as cache misses.

#### Scenario: Reject incomplete or stats-lacking cache entry
- **WHEN** `/api/chicken` finds a Supabase record missing image, attributes, or innate stats
- **THEN** the system treats it as a cache miss and fetches fresh data from upstream

### Requirement: Metadata proxy uses a documented fallback strategy
The system SHALL have `/api/chicken` check a persistent Supabase cache first; otherwise try the Chicken Saga proxy; and fall back to the Sky Mavis token API when the proxy result is missing innate stats or unavailable.

#### Scenario: Serve from persistent cache
- **WHEN** `/api/chicken` finds a complete, stats-bearing record in Supabase
- **THEN** the system returns that cached record without contacting upstream providers

#### Scenario: Sky Mavis fallback for missing innate stats
- **WHEN** the Chicken Saga proxy returns a record lacking innate stats
- **THEN** `/api/chicken` retries using the Sky Mavis API before returning to the client

#### Scenario: Return 503 when all upstreams fail
- **WHEN** both the Chicken Saga proxy and Sky Mavis fail to return data
- **THEN** `/api/chicken` returns 503 (Upstream unavailable) so the client knows to retry rather than treating the chicken as permanently missing

#### Scenario: Persist newly fetched metadata
- **WHEN** `/api/chicken` retrieves metadata from an upstream provider
- **THEN** the system writes that record to the persistent Supabase cache for future requests

### Requirement: System normalizes upstream metadata into a shared internal shape
The system SHALL normalize upstream payloads into a common internal representation including identity fields, parent references, descriptive attributes, combat stats, computed innate points, image URL, and an unknown fallback state.

#### Scenario: Normalize heterogeneous metadata
- **WHEN** metadata is returned from an upstream provider
- **THEN** the system converts it into the shared internal chicken shape used by the UI and lineage logic

### Requirement: System delegates descendant range scanning to a batch endpoint
The system SHALL use `/api/batch` to scan token ID ranges for descendants, with Sky Mavis as a per-token fallback when the Chicken Saga proxy returns a rate-limit or server error.

#### Scenario: Scan descendants through the serverless batch endpoint
- **WHEN** the client needs to discover descendants for a selected chicken
- **THEN** the system calls `/api/batch` to evaluate token ranges and return matching children

### Requirement: System provides a direct DB child lookup endpoint
The system SHALL expose `/api/db-children?parent=<id>` which queries the Supabase `find_chickens_by_parent` RPC and returns known children with `token_id` injected from the database row ID.

#### Scenario: DB child lookup returns known children
- **WHEN** `/api/db-children` is called with a valid parent ID
- **THEN** the endpoint returns all children of that parent currently in the persistent cache, each with `token_id` set

### Requirement: Batch endpoint validates inputs and returns scan results
The system SHALL return a client error when the required `parent` parameter is missing and SHALL otherwise return the discovered children and scanned count for the requested range.

#### Scenario: Missing parent parameter in batch scan
- **WHEN** `/api/batch` is called without a `parent` query parameter
- **THEN** the endpoint returns a `400` response

#### Scenario: Successful batch scan response
- **WHEN** `/api/batch` receives a valid parent and scan range
- **THEN** the endpoint returns a payload containing `children` and `scanned`
