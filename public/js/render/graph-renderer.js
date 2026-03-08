import { NODE_HEIGHT, NODE_WIDTH, ROLE_COLORS } from '../config/constants.js';

export function getInnatePointColor(innatePoints) {
  if (innatePoints >= 220) {
    return '#4cff91';
  }

  if (innatePoints >= 190) {
    return '#ffd700';
  }

  if (innatePoints >= 160) {
    return '#e8d5a3';
  }

  return '#ff5c5c';
}

function getRoleColor(role) {
  return ROLE_COLORS[role] || ROLE_COLORS.root;
}

function createNodeElement({ chicken, x, y, role, onNodeClick }) {
  const color = chicken.unknown
    ? ROLE_COLORS.unknown
    : chicken.dead
      ? '#cc2222'
      : getRoleColor(role);
  const node = document.createElement('article');
  node.className = `node ${chicken.unknown ? 'unknown' : role}`;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.style.borderColor = color;

  if (role === 'root') {
    node.style.boxShadow = '0 0 24px rgba(245, 166, 35, 0.35)';
  }

  const image = document.createElement('img');
  image.className = 'node__image';
  image.alt = `Chicken #${chicken.id}`;

  const imageFrame = document.createElement('div');
  imageFrame.className = 'node__image-frame';

  const placeholder = document.createElement('div');
  placeholder.className = 'node__placeholder';
  placeholder.textContent = '🐔';

  if (chicken.image && !chicken.unknown) {
    image.src = chicken.image;
    if (chicken.dead) {
      image.classList.add('node__image--dead');
    }
    image.addEventListener('error', () => {
      image.remove();
      placeholder.style.display = 'flex';
    }, { once: true });
    imageFrame.appendChild(image);
    placeholder.style.display = 'none';
  } else {
    placeholder.style.display = 'flex';
  }

  if (chicken.dead && !chicken.unknown) {
    const deadBadge = document.createElement('div');
    deadBadge.className = 'node__dead-badge';
    deadBadge.textContent = 'X DEAD';
    imageFrame.appendChild(deadBadge);
  }

  if (imageFrame.childElementCount > 0) {
    node.appendChild(imageFrame);
  }

  node.appendChild(placeholder);

  const divider = document.createElement('div');
  divider.className = 'node__divider';
  divider.style.background = color;
  node.appendChild(divider);

  const label = document.createElement('div');
  label.className = 'node__label';
  label.style.color = color;
  label.textContent = `#${chicken.id}`;

  if (!chicken.unknown && chicken.ip > 0) {
    const innatePoints = document.createElement('span');
    innatePoints.className = 'node__ip';
    innatePoints.style.color = getInnatePointColor(chicken.ip);
    innatePoints.textContent = `IP ${chicken.ip}`;
    label.appendChild(innatePoints);
  }

  node.appendChild(label);
  node.addEventListener('click', () => onNodeClick(chicken));

  return node;
}

function renderEdges(svg, edges) {
  svg.innerHTML = '';

  edges.forEach(({ x1, y1, x2, y2 }) => {
    const midpointY = (y1 + y2) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${x1},${y1} C${x1},${midpointY} ${x2},${midpointY} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(245, 166, 35, 0.3)');
    path.setAttribute('stroke-width', '2');
    svg.appendChild(path);
  });
}

export function renderGraph({ elements, positions, edges, onNodeClick, centerOnRoot }) {
  if (positions.length === 0) {
    return;
  }

  elements.scene.innerHTML = '';

  const allX = positions.map((position) => position.x).concat(edges.flatMap((edge) => [edge.x1, edge.x2]));
  const allY = positions.map((position) => position.y).concat(edges.flatMap((edge) => [edge.y1, edge.y2]));
  const svgWidth = Math.max(...allX) + 300;
  const svgHeight = Math.max(...allY) + 300;

  elements.connectors.setAttribute('width', String(svgWidth));
  elements.connectors.setAttribute('height', String(svgHeight));
  elements.connectors.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  renderEdges(elements.connectors, edges);

  positions.forEach((position) => {
    elements.scene.appendChild(createNodeElement({ ...position, onNodeClick }));
  });

  elements.statNodes.textContent = String(positions.length);
  elements.statLinks.textContent = String(edges.length);
  elements.emptyState.classList.add('is-hidden');

  const rootPosition = positions.find((position) => position.role === 'root');

  if (rootPosition) {
    centerOnRoot(rootPosition.x + NODE_WIDTH / 2, rootPosition.y + NODE_HEIGHT / 2);
  }
}
