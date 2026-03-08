# Chicken Saga Lineage Explorer

Chicken Saga Lineage Explorer is a lightweight web application for exploring the family tree of a Chicken Saga NFT. The project is built as a static single-page interface backed by Vercel serverless functions that proxy and aggregate metadata from external APIs.

## Specification Source of Truth

Behavioral requirements for this project are defined in OpenSpec under `openspec/specs/`. The `README.md` is a descriptive overview of the system, but the normative baseline for expected behavior lives in these specs:

- `openspec/specs/lineage-exploration/spec.md`
- `openspec/specs/graph-visualization/spec.md`
- `openspec/specs/metadata-access/spec.md`
- `openspec/specs/diagnostic-endpoints/spec.md`

Future behavior changes should be proposed as OpenSpec changes before they are treated as part of the baseline.

## Overview

The application lets a user enter a chicken ID and visualize:

- The selected chicken as the root node
- Its ancestors above the root
- Its descendants below the root
- Relationship lines between parents and offspring
- Detailed stats and metadata for each discovered chicken

The project favors a very small deployment footprint:

- No frontend framework
- No bundler
- No local database
- No internal state management library
- No runtime dependencies declared in `package.json`

## Technology Stack

### Frontend

- HTML5
- Vanilla JavaScript
- CSS3
- SVG for relationship connectors
- Google Fonts (`Cinzel`, `Crimson Pro`)
- D3.js loaded from CDN for visualization support, although the current implementation renders with native DOM and SVG APIs

### Backend

- Node.js serverless functions using the Vercel `api/` convention
- Native `fetch` API for upstream requests
- Vercel Function configuration through `vercel.json`

### External Data Sources

The app depends on third-party Chicken Saga metadata providers:

- `https://chicken-api-ivory.vercel.app/api/:id`
- `https://app.chickensaga.com/api/proxy?tokenId=:id`
- Sky Mavis token API for the Chicken Saga contract

## Architecture

The system follows a thin-client plus serverless-proxy architecture.

```text
Browser SPA (public/index.html)
  |
  |-- Direct metadata reads for individual chickens
  |     -> chicken-api-ivory.vercel.app
  |
  |-- Descendant range scans
  |     -> /api/batch
  |        -> chicken-api-ivory.vercel.app (multiple token lookups)
  |
  |-- Optional internal metadata proxy
        -> /api/chicken
           -> Chicken Saga proxy
           -> fallback to Sky Mavis API
```

### Frontend responsibilities

The browser client is responsible for:

- Collecting the target chicken ID and requested exploration depth
- Fetching metadata for the root, ancestors, and descendants
- Caching already-fetched chickens in memory
- Building two trees: ancestor tree and descendant tree
- Calculating layout positions for every node
- Rendering cards and SVG connectors
- Handling interactions such as pan, zoom, node details, and recursive re-exploration

### Backend responsibilities

The serverless layer is intentionally small and serves two main purposes:

- Work around CORS and availability issues when fetching Chicken Saga metadata
- Batch-scan token ID ranges to discover descendants by matching `Parent 1` / `Parent 2`

### Deployment model

The repo is designed for Vercel deployment:

- `public/index.html` acts as the client entry point
- `api/*.js` are deployed as serverless endpoints
- `vercel.json` increases the function timeout for the heavier batch scanner

## Repository Structure

```text
.
|-- api/
|   |-- batch.js     # Descendant discovery by scanning token ranges
|   |-- chicken.js   # Metadata proxy with fallback strategy
|   |-- debug.js     # Diagnostic endpoint for upstream API inspection
|   `-- test.js      # Diagnostic endpoint for parent-child validation
|-- openspec/
|   |-- specs/       # Normative project requirements and capabilities
|   `-- changes/     # Proposed spec changes before they are merged
|-- public/
|   `-- index.html   # Entire frontend UI, styling, rendering, and client logic
|-- package.json     # Minimal project metadata
`-- vercel.json      # Serverless function timeout configuration
```

## Implemented Features

### 1. Interactive lineage exploration

Users can enter a chicken ID and render a lineage graph centered on that chicken.

### 2. Configurable traversal depth

The UI supports depth levels from 2 to 5. Descendant traversal uses the selected depth, while ancestor traversal is currently capped at 2 levels.

### 3. Ancestor discovery

The client reads `Parent 1` and `Parent 2` attributes recursively and places ancestors above the selected chicken.

### 4. Descendant discovery

The app discovers descendants by scanning token IDs greater than the current parent and checking whether either parent attribute matches the selected chicken ID.

### 5. Chunked batch scanning

To reduce the number of browser-originated requests, descendant discovery is delegated to `/api/batch`, which scans ID ranges in chunks of 500 and processes up to 4 chunks in parallel from the browser workflow.

### 6. In-memory client cache

A `Map` cache stores fetched chickens to avoid repeated metadata requests during a session.

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

`/api/chicken` first tries the Chicken Saga proxy and then falls back to the Sky Mavis API if needed.

### 16. Diagnostic endpoints

The project includes two helper endpoints used during integration/debugging:

- `/api/test` validates parent-child relationships for specific token IDs
- `/api/debug` exposes raw upstream response previews

## Data Flow

### Explore flow

1. The user enters a chicken ID and chooses a depth.
2. The client fetches the root chicken metadata.
3. The client recursively builds the descendant tree.
4. During descendant discovery, the client calls `/api/batch` for chunked scans.
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
- Handles CORS-sensitive upstream access from the server side
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

The Vercel config customizes serverless execution time:

- `api/batch.js`: `maxDuration = 60`
- `api/chicken.js`: `maxDuration = 10`

This reflects the fact that descendant scanning is the slowest operation in the system.

## Design Characteristics

### Strengths

- Extremely small codebase
- Simple deployment model
- No build step required
- Clear separation between visualization logic and proxy/batch serverless functions
- Works without a database because lineage is reconstructed from NFT metadata

### Current constraints

- The frontend currently fetches individual chicken metadata directly from `chicken-api-ivory.vercel.app` instead of using the local `/api/chicken` endpoint for the main flow
- Descendant discovery relies on range scanning, which can become expensive as the token space grows
- There are embedded upstream constants and API credentials in serverless files instead of environment variables
- There is no automated test suite
- There are no local development scripts documented in the repo
- D3 is loaded but not meaningfully used by the current rendering implementation

## Running the Project

Because the project has no build system, the simplest way to run it is through a static/serverless environment such as Vercel.

Typical local options:

- Use `vercel dev` to serve both `public/` and `api/`
- Or serve `public/index.html` statically and deploy/use the `api/` folder through Vercel-compatible tooling

## Summary

This project is a compact lineage visualization tool for Chicken Saga NFTs. Its architecture combines a single-file browser client with Vercel serverless endpoints that proxy metadata and perform descendant batch scans. The main implemented value is the ability to navigate a chicken's ancestry and offspring interactively, inspect metadata, and explore the graph recursively without any heavy application framework or persistent backend.
