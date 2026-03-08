# diagnostic-endpoints Specification

## Purpose
TBD - created by archiving change bootstrap-specs-from-readme. Update Purpose after archive.
## Requirements
### Requirement: Test endpoint supports parent-child validation diagnostics
The system SHALL provide `/api/test` as a diagnostic endpoint for checking whether selected token IDs are children of a given parent.

#### Scenario: Validate candidate children for a parent
- **WHEN** a maintainer calls `/api/test` for diagnostic purposes
- **THEN** the endpoint reports whether the selected tokens match the expected parent-child relationship

### Requirement: Debug endpoint exposes upstream response previews
The system SHALL provide `/api/debug` as a diagnostic endpoint for inspecting raw upstream token API response previews.

#### Scenario: Inspect upstream response shape
- **WHEN** a maintainer calls `/api/debug` for troubleshooting
- **THEN** the endpoint returns a preview of the upstream response data needed for inspection

