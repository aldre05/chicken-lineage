import {
  HORIZONTAL_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  VERTICAL_GAP,
} from '../config/constants.js';

function descendantSubtreeWidth(node) {
  if (!node || node.chicken.unknown) {
    return NODE_WIDTH;
  }

  const validChildren = node.children.filter((child) => child && !child.chicken.unknown);

  if (validChildren.length === 0) {
    return NODE_WIDTH;
  }

  const totalWidth = validChildren.reduce(
    (sum, child) => sum + descendantSubtreeWidth(child) + HORIZONTAL_GAP,
    -HORIZONTAL_GAP,
  );

  return Math.max(NODE_WIDTH, totalWidth);
}

function ancestorSubtreeWidth(node) {
  if (!node.parents.length) {
    return NODE_WIDTH;
  }

  const totalWidth = node.parents.reduce(
    (sum, parent) => sum + ancestorSubtreeWidth(parent) + HORIZONTAL_GAP,
    -HORIZONTAL_GAP,
  );

  return Math.max(NODE_WIDTH, totalWidth);
}

export function layoutDescendants(node, centerX, positionY, role, positions) {
  if (!node || node.chicken.unknown) {
    return;
  }

  const leftX = centerX - NODE_WIDTH / 2;
  positions.push({ chicken: node.chicken, x: leftX, y: positionY, role });

  const validChildren = node.children.filter((child) => child && !child.chicken.unknown);
  const childWidths = validChildren.map(descendantSubtreeWidth);
  const totalWidth = childWidths.reduce((sum, width) => sum + width + HORIZONTAL_GAP, -HORIZONTAL_GAP);

  let currentX = centerX - (totalWidth > 0 ? totalWidth / 2 : 0);

  validChildren.forEach((child, index) => {
    const childCenterX = currentX + childWidths[index] / 2;
    layoutDescendants(child, childCenterX, positionY + NODE_HEIGHT + VERTICAL_GAP, 'descendant', positions);
    currentX += childWidths[index] + HORIZONTAL_GAP;
  });
}

export function layoutAncestors(node, centerX, positionY, positions) {
  if (!node || node.chicken.unknown) {
    return;
  }

  const leftX = centerX - NODE_WIDTH / 2;
  positions.push({ chicken: node.chicken, x: leftX, y: positionY, role: 'ancestor' });

  const validParents = node.parents.filter((parent) => parent && !parent.chicken.unknown);
  const parentWidths = validParents.map(ancestorSubtreeWidth);
  const totalWidth = parentWidths.reduce((sum, width) => sum + width + HORIZONTAL_GAP, -HORIZONTAL_GAP);

  let currentX = centerX - (totalWidth > 0 ? totalWidth / 2 : 0);

  validParents.forEach((parent, index) => {
    const parentCenterX = currentX + parentWidths[index] / 2;
    layoutAncestors(parent, parentCenterX, positionY - NODE_HEIGHT - VERTICAL_GAP, positions);
    currentX += parentWidths[index] + HORIZONTAL_GAP;
  });
}

export function shiftPositions(positions, padding) {
  const minimumX = positions.length > 0 ? Math.min(...positions.map((position) => position.x)) : padding;
  const offsetX = padding - minimumX;

  positions.forEach((position) => {
    position.x += offsetX;
  });
}

export function buildEdges(positions) {
  const positionMap = new Map(
    positions.filter((position) => !position.chicken.unknown).map((position) => [position.chicken.id, position]),
  );

  const edges = [];

  positions.forEach((position) => {
    const chicken = position.chicken;

    if (chicken.unknown) {
      return;
    }

    [chicken.parent1, chicken.parent2].forEach((parentId) => {
      if (parentId && parentId !== '0' && positionMap.has(parentId)) {
        const parentPosition = positionMap.get(parentId);
        edges.push({
          x1: parentPosition.x + NODE_WIDTH / 2,
          y1: parentPosition.y + NODE_HEIGHT,
          x2: position.x + NODE_WIDTH / 2,
          y2: position.y,
        });
      }
    });
  });

  return edges;
}
