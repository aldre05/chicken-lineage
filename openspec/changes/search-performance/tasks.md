# Tasks: search-performance

## Status: READY TO IMPLEMENT

- [ ] `public/js/app.js`
  - Wrap `buildDescendantTree` and `buildAncestorTree` in `Promise.all`
  - Destructure results: `const [descTree, ancTree] = await Promise.all([...])`

- [ ] `public/js/services/chicken-api.js`
  - Change `MAX_CHUNK_CONCURRENT` from 4 to 10
