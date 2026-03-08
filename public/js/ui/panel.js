import { getInnatePointColor } from '../render/graph-renderer.js';

function createRow(label, value, options = {}) {
  const row = document.createElement('div');
  row.className = 'info-panel__row';

  const labelElement = document.createElement('span');
  labelElement.textContent = label;

  const valueElement = document.createElement(options.interactive ? 'button' : 'b');
  valueElement.className = 'info-panel__value';
  valueElement.textContent = value;

  if (options.color) {
    valueElement.style.color = options.color;
  }

  if (options.interactive) {
    valueElement.classList.add('info-panel__value--interactive');
    valueElement.type = 'button';
    valueElement.style.background = 'none';
    valueElement.style.border = 'none';
    valueElement.style.padding = '0';
    valueElement.addEventListener('click', options.onClick);
  }

  row.append(labelElement, valueElement);
  return row;
}

function setBody(panelBody, chicken, onExplore) {
  panelBody.innerHTML = '';

  if (chicken.unknown) {
    const empty = document.createElement('div');
    empty.style.color = 'var(--text-dim)';
    empty.style.fontSize = '0.82rem';
    empty.textContent = 'No data available.';
    panelBody.appendChild(empty);
    return;
  }

  const rows = [
    createRow('Instinct', chicken.instinct),
    createRow('Level', String(chicken.level)),
    createRow('Body', chicken.body),
    createRow('Breeds left', `${3 - chicken.breedCount}/3`),
    createRow('Innate Points', String(chicken.ip), { color: getInnatePointColor(chicken.ip) }),
    createRow('ATK/DEF/SPD/HP', `${chicken.iAtk}/${chicken.iDef}/${chicken.iSpd}/${chicken.iHp}`),
  ];

  if (chicken.parent1 !== '0') {
    rows.push(createRow('Parent 1', `#${chicken.parent1}`, {
      interactive: true,
      onClick: () => onExplore(chicken.parent1),
    }));
  }

  if (chicken.parent2 !== '0') {
    rows.push(createRow('Parent 2', `#${chicken.parent2}`, {
      interactive: true,
      onClick: () => onExplore(chicken.parent2),
    }));
  }

  rows.forEach((row) => panelBody.appendChild(row));
}

export function createInfoPanelController(elements, onExplore) {
  elements.panelClose.addEventListener('click', () => {
    elements.infoPanel.classList.remove('is-open');
    elements.infoPanel.setAttribute('aria-hidden', 'true');
  });

  return {
    open(chicken) {
      elements.panelId.textContent = `#${chicken.id}`;
      elements.panelSub.textContent = chicken.unknown
        ? 'Unknown Chicken'
        : `${chicken.gen} - ${chicken.type} - ${chicken.gender}`;
      elements.panelLink.href = `https://app.chickensaga.com/inventory/chickens/${chicken.id}`;
      elements.panelExplore.onclick = () => onExplore(chicken.id);
      setBody(elements.panelBody, chicken, onExplore);
      elements.infoPanel.classList.add('is-open');
      elements.infoPanel.setAttribute('aria-hidden', 'false');
    },
    close() {
      elements.infoPanel.classList.remove('is-open');
      elements.infoPanel.setAttribute('aria-hidden', 'true');
    },
  };
}
