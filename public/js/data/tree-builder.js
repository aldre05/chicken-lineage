import { findChildren, fetchChicken } from '../services/chicken-api.js';
import { parseChickenData } from '../utils/chicken-parser.js';

export async function buildDescendantTree(id, depth, maxDepth, dependencies, visited = new Set()) {
  const normalizedId = String(id);

  if (visited.has(normalizedId)) {
    return null;
  }

  visited.add(normalizedId);

  const data = await fetchChicken(normalizedId, dependencies.cache);
  const chicken = parseChickenData(data, normalizedId);
  const node = { chicken, children: [] };

  if (depth >= maxDepth || chicken.unknown) {
    return node;
  }

  const childIds = await findChildren(normalizedId, dependencies);

  if (childIds.length === 0) {
    return node;
  }

  const generationLabel = depth === 0 ? 'children' : depth === 1 ? 'grandchildren' : `generation ${depth + 1} descendants`;
  dependencies.setStatus(`Found ${childIds.length} ${generationLabel} of #${normalizedId}, scanning their offspring...`);

  // Prefetch all children in parallel so their data lands in cache before
  // recursing — recursive calls then return from cache immediately.
  const unvisitedIds = childIds.filter((childId) => !visited.has(childId));
  await Promise.all(unvisitedIds.map((childId) => fetchChicken(childId, dependencies.cache)));

  // Now recurse — visited tracking happens inside each call as normal.
  const childNodes = await Promise.all(
    childIds.map((childId) => buildDescendantTree(childId, depth + 1, maxDepth, dependencies, visited)),
  );

  node.children = childNodes.filter(Boolean);
  return node;
}

export async function buildAncestorTree(id, depth, maxDepth, dependencies) {
  const normalizedId = String(id);
  const data = await fetchChicken(normalizedId, dependencies.cache);
  const chicken = parseChickenData(data, normalizedId);
  const node = { chicken, parents: [] };

  if (depth >= maxDepth || chicken.unknown) {
    return node;
  }

  const parents = await Promise.all([
    chicken.parent1 !== '0' ? buildAncestorTree(chicken.parent1, depth + 1, maxDepth, dependencies) : null,
    chicken.parent2 !== '0' ? buildAncestorTree(chicken.parent2, depth + 1, maxDepth, dependencies) : null,
  ]);

  node.parents = parents.filter(Boolean);
  return node;
}
