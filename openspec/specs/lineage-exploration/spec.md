# lineage-exploration Specification

## Purpose
TBD - created by archiving change bootstrap-specs-from-readme. Update Purpose after archive.
## Requirements
### Requirement: User can start a lineage exploration from a chicken ID
The system SHALL allow a user to enter a chicken ID and render a lineage graph centered on the selected chicken.

#### Scenario: Explore a chicken from the main input
- **WHEN** the user submits a valid chicken ID from the main interface
- **THEN** the system renders a lineage view using that chicken as the root node

### Requirement: User can configure traversal depth
The system SHALL allow the user to choose an exploration depth between 2 and 5 before loading the lineage.

#### Scenario: Select a supported depth
- **WHEN** the user chooses a depth value from 2 to 5 and starts an exploration
- **THEN** the system uses that depth for descendant traversal during the current exploration

### Requirement: System discovers ancestors from parent metadata
The system SHALL discover ancestors by reading `Parent 1` and `Parent 2` attributes recursively and placing those ancestors above the selected chicken.

#### Scenario: Build ancestor lineage
- **WHEN** the selected chicken has parent references in its metadata
- **THEN** the system loads those ancestors and positions them above the root node in the lineage view

### Requirement: System discovers descendants from parent-child matching
The system SHALL discover descendants by scanning candidate chickens and matching the selected chicken ID against `Parent 1` or `Parent 2`.

#### Scenario: Build descendant lineage
- **WHEN** descendant discovery runs for a selected chicken
- **THEN** the system includes chickens whose parent metadata references the selected chicken ID as descendants below the root

### Requirement: User can re-explore from a discovered chicken
The system SHALL allow the user to restart the lineage view using any discovered chicken as the new root.

#### Scenario: Re-explore from node details
- **WHEN** the user triggers the re-explore action for a discovered chicken
- **THEN** the system reloads the lineage graph with that chicken as the new root

