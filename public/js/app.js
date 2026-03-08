import {
  HORIZONTAL_GAP,
  MAX_ANCESTOR_DEPTH,
  NODE_HEIGHT,
  NODE_WIDTH,
  VERTICAL_GAP,
} from './config/constants.js';
import { buildAncestorTree, buildDescendantTree } from './data/tree-builder.js';
import { buildEdges, layoutAncestors, layoutDescendants, shiftPositions } from './layout/tree-layout.js';
import { renderGraph } from './render/graph-renderer.js';
import { fetchChicken } from './services/chicken-api.js';
import { createInfoPanelController } from './ui/panel.js';
import { createStatusController } from './ui/status.js';
import { createViewportController } from './ui/viewport.js';
import { parseChickenData } from './utils/chicken-parser.js';
import { getAppElements } from './utils/dom.js';

const elements = getAppElements();
const status = createStatusController(elements);
const viewport = createViewportController(elements);
const store = {
  cache: new Map(),
};

let panelController;

async function explore(id) {
  const normalizedId = String(id).trim();
  let keepStatusVisible = false;

  if (!normalizedId) {
    return;
  }

  panelController.close();
  elements.searchButton.disabled = true;
  elements.scene.innerHTML = '';
  elements.connectors.innerHTML = '';

  try {
    const selectedDepth = Number.parseInt(elements.depthSelect.value, 10);
    const ancestorDepth = Math.min(MAX_ANCESTOR_DEPTH, selectedDepth);

    status.show(`Loading #${normalizedId}...`);
    const rootData = await fetchChicken(normalizedId, store.cache);
    const rootChicken = parseChickenData(rootData, normalizedId);
    const hasParents = rootChicken.parent1 !== '0' || rootChicken.parent2 !== '0';
    const rootY = hasParents ? ancestorDepth * (NODE_HEIGHT + VERTICAL_GAP) + 40 : 40;

    status.show(`Finding descendants of #${normalizedId}...`);
    const descTree = await buildDescendantTree(normalizedId, 0, selectedDepth, {
      cache: store.cache,
      setStatus: (message) => status.show(message),
    });

    status.show(`Finding ancestors of #${normalizedId}...`);
    const ancTree = await buildAncestorTree(normalizedId, 0, ancestorDepth, {
      cache: store.cache,
      setStatus: (message) => status.show(message),
    });

    const positions = [];

    if (descTree) {
      layoutDescendants(descTree, 0, rootY, 'root', positions);
    }

    if (positions[0]) {
      positions[0].role = 'root';
    }

    if (ancTree && ancTree.parents.length > 0) {
      const validParents = ancTree.parents.filter((parent) => parent && !parent.chicken.unknown);
      validParents.forEach((parent, index) => {
        const offset = (index - (validParents.length - 1) / 2) * ((NODE_WIDTH * 2) + HORIZONTAL_GAP);
        layoutAncestors(parent, offset, rootY - NODE_HEIGHT - VERTICAL_GAP, positions);
      });
    }

    shiftPositions(positions, 60);
    const edges = buildEdges(positions);

    renderGraph({
      elements,
      positions,
      edges,
      onNodeClick: (chicken) => panelController.open(chicken),
      centerOnRoot: (x, y) => viewport.centerOn(x, y),
    });
  } catch (error) {
    console.error('Failed to explore lineage', error);
    keepStatusVisible = true;
    status.show('Failed to load lineage data. Please try again.');
    window.setTimeout(() => status.hide(), 2500);
  } finally {
    if (!keepStatusVisible) {
      status.hide();
    }

    if (elements.searchButton.disabled) {
      elements.searchButton.disabled = false;
    }
  }
}

panelController = createInfoPanelController(elements, explore);

elements.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  explore(elements.searchInput.value);
});

window.explore = explore;
