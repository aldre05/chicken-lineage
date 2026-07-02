# Chicken Saga Lineage Explorer

Chicken Saga Lineage Explorer is a lightweight web application for exploring the family tree of a Chicken Saga NFT. The project is built as a static single-page interface backed by Vercel serverless functions that proxy and aggregate metadata from external APIs, with a Supabase-backed persistence layer for caching metadata and descendant indexes.

## Specification Source of Truth

Behavioral requirements for this project are defined in OpenSpec under `openspec/specs/`. The `README.md` is a descriptive overview of the system, but the normative baseline for expected behavior lives in these specs:

- `openspec/specs/lineage-exploration/spec.md`
- `openspec/specs/graph-visualization/spec.md`
- `openspec/specs/metadata-access/spec.md`
- `openspec/specs/descendant-indexing/spec.md`
- `openspec/specs/diagnostic-endpoints/spec.md`

Future behavior changes should be proposed as OpenSpec changes before they are treated as part of the baseline.

## Overview

The application lets a user enter a chicken ID and visualize:

- The selected chicken as the root node
- Its ancestors above the root
- Its descendants below the root
- Relationship lines between parents and offspring
- Detailed stats and metadata for each discovered chicken

The project favors a small deployment footprint:

- No frontend framework
- No bundler
- No internal state management library
- Supabase used only as a caching/indexing layer, not as an internal data model

## Technology Stack

### Frontend

- HTML5
- Vanilla JavaScript (ES modules under `public/js/`)
- CSS3
- SVG for relationship connectors
- Google Fonts (`Cinzel`, `Crimson Pro`)
- D3.js loaded from CDN for visualization support, although the current implementation renders with native DOM and SVG APIs

### Backend

- Node.js serverless functions using the Vercel `api/` convention
- Native `fetch` API for upstream requests
- Vercel Function configuration through `vercel.json`

### Persistence

- Supabase (Postgres) used as a caching and indexing layer:
  - `chickens` table — persistent cache of fetched, normalized metadata
  - `parent_index` table — persistent index of parent → children relationships
  - RPC functions `find_chickens_by_parent` and `get_max_chicken_id` for fast lookups

### External Data Sources

The app depends on third-party Chicken Saga metadata providers:

- `https://chicken-api-ivory.vercel.app/api/:id`
- `https://app.chickensaga.com/api/proxy?tokenId=:id`
- Sky Mavis token API for the Chicken Saga contract

## Architecture

The system follows a thin-client plus serverless-proxy architecture, with a persistence layer sitting in front of upstream providers.

```text
Browser SPA (public/js/app.js)
  |
  |-- Individual chicken metadata
  |     -> /api/chicken
  |        -> Supabase `chickens` cache (if complete + has innate stats)
  |        -> chicken-api-ivory.vercel.app
  |        -> Sky Mavis API (fallback)
  |
  |-- Descendant discovery
  |     -> /api/children      (check parent_index; instant if already indexed)
  |     -> /api/db-children   (fast DB-only lookup, before a full scan)
  |     -> /api/batch         (chunked range scan against upstream + Supabase)
  |     -> /api/index-children (persist scan results back to parent_index)
  |     -> /api/max-id        (dynamic scan upper bound)
```

### Frontend responsibilities

The browser client is responsible for:

- Collecting the target chicken ID and requested exploration depth
- Fetching metadata for the root, ancestors, and descendants
- Caching already-fetched chickens in memory for the session
- Rate-limiting concurrent fetches and batch-scan requests client-side
- Building two trees: ancestor tree and descendant tree
- Calculating layout positions for every node
- Rendering cards and SVG connectors
- Handling interactions such as pan, zoom, node details, and recursive re-exploration

### Backend responsibilities

The serverless layer:

- Works around CORS and availability issues when fetching Chicken Saga metadata
- Maintains a persistent Supabase cache of metadata and parent/child relationships
- Batch-scans token ID ranges to discover descendants by matching `Parent 1` / `Parent 2`, only when they aren't already indexed

### Deployment model

The repo is designed for Vercel deployment:

- `public/index.html` + `public/js/` act as the client entry point
- `api/*.js` are deployed as serverless endpoints
- `vercel.json` configures per-function timeouts, with the batch scanner given the most headroom
- Supabase project provides the `chickens` and `parent_index` tables plus RPC functions, configured via `SUPABASE_URL` / `SUPABASE_KEY` environment variables

## Repository Structure

```text
.
|-- api/
|   |-- batch.js          # Descendant discovery by scanning token ranges
|   |-- chicken.js        # Metadata proxy with Supabase cache + fallback strategy
|   |-- children.js       # Reads known children from the parent_index
|   |-- db-children.js    # Fast DB-only child lookup via RPC
|   |-- index-children.js # Persists scan results to parent_index
|   |-- max-id.js         # Dynamic descendant scan upper bound
|   |-- debug.js          # Diagnostic endpoint for upstream API inspection
|   `-- test.js           # Diagnostic endpoint for parent-child validation
|-- openspec/
|   |-- specs/            # Normative project requirements and capabilities
|   `-- changes/          # Proposed spec changes before they are merged
|-- public/
|   |-- index.html        # App shell and markup
|   `-- js/                # Frontend logic, organized by concern
|       |-- app.js            # Explore flow orchestration
|       |-- config/           # Layout and rendering constants
|       |-- data/             # Ancestor/descendant tree building
|       |-- layout/           # Node positioning and edge computation
|       |-- render/           # Graph rendering
|       |-- services/         # chicken-api.js — fetching, caching, indexing
|       |-- ui/                # Panel, status, viewport controllers
|       `-- utils/            # Parsing and DOM helpers
|-- package.json          # Minimal project metadata
`-- vercel.json           # Serverless function timeout configuration
```

## Implemented Features

### 1. Interactive lineage exploration

Users can enter a chicken ID and render a lineage graph centered on that chicken.

### 2. Configurable traversal depth

The UI supports depth levels from 2 to 5. Descendant traversal uses the selected depth, while ancestor traversal is currently capped at 2 levels.

### 3. Ancestor discovery

The client reads `Parent 1` and `Parent 2` attributes recursively and places ancestors above the selected chicken.

### 4. Descendant discovery with persistent indexing

The app discovers descendants by first checking a persistent parent-index cache; if a parent hasn't been indexed yet, it scans token IDs greater than the current parent, checking whether either parent attribute matches, and then persists the results for future lookups.

### 5. Chunked batch scanning

When a full scan is needed, it's delegated to `/api/batch`, which scans ID ranges in chunks (default 100 per chunk) with client-side concurrency limits to stay polite to upstream providers.

### 6. Two-tier caching (in-memory + persistent)

A `Map` cache stores fetched chickens in memory for the current session, backed by a persistent Supabase cache shared across all users and sessions.

### 7. Relationship graph rendering

The family tree is rendered with:

- HTML cards for nodes
- SVG bezier curves for family connections
- Role-based color coding for root, ancestors, descendants, and unknown entries
- Dead chickens shown with a muted image treatment and a visible `DEAD` badge

### 8. Pan and zoom navigation

The graph canvas supports drag-to-pan and mouse-wheel zoom.

### 9. Auto-centering on the root node

After rendering, the viewport recenters itself on the selected chicken.

### 10. Metadata side panel

Clicking a node opens a detail panel showing:

- ID
- generation
- type
- gender
- instinct
- level
- body
- breed count / breeds left
- innate attack, defense, speed, health
- computed innate points (IP)
- dead/alive state inferred from metadata when available
- parent links

### 11. Re-explore from any discovered node

The side panel includes an action to reload the visualization using the selected node as the new root.

### 12. External deep link to the game

Each node detail panel links to the corresponding chicken page in Chicken Saga.

### 13. Loading and progress feedback

The UI displays status messages while loading root metadata, scanning descendants, and walking ancestor chains.

### 14. Empty state, legend, and graph statistics

The interface includes:

- a startup empty state
- a legend for node roles
- counters for rendered chickens and connections

### 15. Metadata fallback strategy

`/api/chicken` checks the persistent cache first, then tries the Chicken Saga proxy, then falls back to the Sky Mavis API if needed.

### 16. Diagnostic endpoints

The project includes two helper endpoints used during integration/debugging:

- `/api/test` validates parent-child relationships for specific token IDs
- `/api/debug` exposes raw upstream response previews

## Data Flow

### Explore flow

1. The user enters a chicken ID and chooses a depth.
2. The client fetches the root chicken metadata (persistent cache → proxy → Sky Mavis).
3. The client recursively builds the descendant tree, checking the parent index before scanning.
4. If a parent isn't indexed, the client calls `/api/batch` for chunked scans and persists results via `/api/index-children`.
5. The client recursively builds the ancestor tree.
6. Layout functions compute horizontal subtree widths and node positions.
7. The UI renders nodes and connectors.
8. The viewport recenters on the root node.

### Metadata normalization

The client normalizes upstream payloads into a simplified internal shape containing:

- core identity fields
- parent references
- image URL
- descriptive attributes
- innate combat stats
- computed innate points
- a derived `dead` flag based on the upstream `State` attribute
- an `unknown` fallback state when metadata is missing

## Serverless Endpoints

### `GET /api/chicken?id=<tokenId>`

Purpose:

- Returns lightweight metadata for a single chicken
- Checks the persistent Supabase cache first, then handles CORS-sensitive upstream access from the server side
- Falls back between providers

Behavior:

- Returns `400` if `id` is missing
- Returns cached-by-edge responses with `s-maxage=300`
- Returns upstream not found or server errors when both sources fail

### `GET /api/batch?parent=<id>&start=<n>&end=<n>`

Purpose:

- Scans a token ID range
- Returns chickens whose `Parent 1` or `Parent 2` matches `parent`

Behavior:

- Returns `400` if `parent` is missing
- Processes the full ID range with `Promise.allSettled`
- Returns `{ children, scanned }`
- Disables caching with `Cache-Control: no-store`

### `GET /api/children?parent=<id>`

Purpose:

- Returns all known children of a parent from the persistent `parent_index`
- Returns `indexed: false` if the parent hasn't been scanned yet, so the caller falls back to a scan

### `GET /api/db-children?parent=<id>`

Purpose:

- Fast first-pass lookup of known children directly from the `chickens` table via RPC, avoiding a full range scan for already-cached data

### `POST /api/index-children`

Purpose:

- Persists descendant scan results to the `parent_index` table after a scan completes
- Does not write a sentinel for zero-result scans, so childless chickens are re-checked on future explorations

### `GET /api/max-id`

Purpose:

- Determines the dynamic upper bound for descendant range scanning
- Tries an RPC, then a direct table query, then a hardcoded floor (25000) as a last resort

### `GET /api/test`

Purpose:

- Debug helper for checking whether selected tokens are children of a given parent

### `GET /api/debug`

Purpose:

- Debug helper for inspecting raw upstream token API responses

## Configuration

### `package.json`

The manifest is intentionally minimal and currently only contains project metadata. There are no scripts or runtime dependencies declared.

### `vercel.json`

The Vercel config customizes serverless execution time per function, reflecting that descendant scanning and indexing are the heaviest operations in the system.

### Environment Variables

- `SUPABASE_URL` / `SUPABASE_KEY` — required for the persistent cache and parent index
- `SKYMAVIS_API_KEY` — optional; falls back to an embedded default if unset

## Design Characteristics

### Strengths

- Small, modular codebase
- Simple deployment model
- No build step required
- Clear separation between visualization logic, proxy/batch serverless functions, and the persistence layer
- Descendant re-scans are avoided once a parent is indexed, significantly reducing repeated upstream load

### Current constraints

- The frontend fetches individual chicken metadata directly from `chicken-api-ivory.vercel.app` in some paths instead of exclusively using the local `/api/chicken` endpoint
- There is an embedded fallback API credential in serverless files instead of relying solely on environment variables
- There is no automated test suite
- There are no local development scripts documented in the repo
- D3 is loaded but not meaningfully used by the current rendering implementation

## Running the Project

Because the project has no build system, the simplest way to run it is through a static/serverless environment such as Vercel.

Typical local options:

- Use `vercel dev` to serve both `public/` and `api/` (requires `SUPABASE_URL` and `SUPABASE_KEY` in your local env)
- Or serve `public/index.html` statically and deploy/use the `api/` folder through Vercel-compatible tooling

## Summary

This project is a compact lineage visualization tool for Chicken Saga NFTs. Its architecture combines a modular browser client with Vercel serverless endpoints that proxy metadata, perform descendant batch scans, and persist results in Supabase to minimize repeated upstream load. The main implemented value is the ability to navigate a chicken's ancestry and offspring interactively, inspect metadata, and explore the graph recursively without any heavy application framework.
