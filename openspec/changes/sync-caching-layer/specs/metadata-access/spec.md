# metadata-access Specification (Delta)

## MODIFIED Requirements

### Requirement: Metadata proxy uses a documented fallback strategy
The system SHALL have `/api/chicken` check a persistent Supabase cache
first, trusting only entries that are complete (have an image and
attributes) and include innate stats; otherwise it SHALL try the Chicken
Saga proxy, and fall back to the Sky Mavis token API when the proxy result
is missing or lacks innate stats.

#### Scenario: Serve from persistent cache
- **WHEN** `/api/chicken` finds a complete, stats-bearing record for the
  requested ID in the Supabase cache
- **THEN** the system returns that cached record without contacting
  upstream providers

#### Scenario: Fallback after primary provider failure
- **WHEN** `/api/chicken` cannot satisfy a request from the primary Chicken
  Saga proxy, or the result lacks innate stats
- **THEN** it retries using the Sky Mavis API before returning failure to
  the client

#### Scenario: Persist newly fetched metadata
- **WHEN** `/api/chicken` retrieves metadata from an upstream provider
- **THEN** the system writes that record to the persistent Supabase cache
  for future requests

## ADDED Requirements

### Requirement: System maintains a persistent metadata cache across sessions
The system SHALL persist fetched chicken metadata in a Supabase-backed
store, separate from the client's in-memory session cache, so metadata
already retrieved by any user can be reused without re-fetching from
upstream providers.

#### Scenario: Reuse across sessions
- **WHEN** a chicken's metadata has already been persisted from a prior
  request by any client
- **THEN** subsequent requests for that chicken can be served from the
  persistent cache instead of requiring a fresh upstream fetch
