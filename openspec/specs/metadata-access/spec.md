# metadata-access Specification

## Purpose
TBD - created by archiving change bootstrap-specs-from-readme. Update Purpose after archive.
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

### Requirement: System normalizes upstream metadata into a shared internal shape
The system SHALL normalize upstream payloads into a common internal representation including identity fields, parent references, descriptive attributes, combat stats, computed innate points, image URL, and an unknown fallback state.

#### Scenario: Normalize heterogeneous metadata
- **WHEN** metadata is returned from an upstream provider
- **THEN** the system converts it into the shared internal chicken shape used by the UI and lineage logic

### Requirement: System delegates descendant range scanning to a batch endpoint
The system SHALL use `/api/batch` to scan token ID ranges for descendants by matching `Parent 1` and `Parent 2` against the selected parent ID.

#### Scenario: Scan descendants through the serverless batch endpoint
- **WHEN** the client needs to discover descendants for a selected chicken
- **THEN** the system calls `/api/batch` to evaluate token ranges and return matching children

### Requirement: Metadata proxy uses a documented fallback strategy
The system SHALL have `/api/chicken` try the Chicken Saga proxy first and fall back to the Sky Mavis token API when needed.

#### Scenario: Fallback after primary provider failure
- **WHEN** `/api/chicken` cannot satisfy a request from the primary Chicken Saga proxy
- **THEN** it retries using the Sky Mavis API before returning failure to the client

### Requirement: Batch endpoint validates inputs and returns scan results
The system SHALL return a client error when the required `parent` parameter is missing and SHALL otherwise return the discovered children and scanned count for the requested range.

#### Scenario: Missing parent parameter in batch scan
- **WHEN** `/api/batch` is called without a `parent` query parameter
- **THEN** the endpoint returns a `400` response

#### Scenario: Successful batch scan response
- **WHEN** `/api/batch` receives a valid parent and scan range
- **THEN** the endpoint returns a payload containing `children` and `scanned`

