export function createViewportController(elements) {
  const state = {
    dragOriginX: 0,
    dragOriginY: 0,
    isDragging: false,
    panX: 0,
    panY: 0,
    scale: 1,
  };

  function applyTransform() {
    const transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
    elements.scene.style.transform = transform;
    elements.connectors.style.transform = transform;
  }

  function centerOn(centerX, centerY) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - elements.canvas.getBoundingClientRect().top;
    state.scale = 1;
    state.panX = viewportWidth / 2 - centerX * state.scale;
    state.panY = viewportHeight / 2 - centerY * state.scale;
    applyTransform();
  }

  elements.canvas.addEventListener('mousedown', (event) => {
    if (event.target.closest('.node')) {
      return;
    }

    state.isDragging = true;
    state.dragOriginX = event.clientX;
    state.dragOriginY = event.clientY;
  });

  window.addEventListener('mousemove', (event) => {
    if (!state.isDragging) {
      return;
    }

    state.panX += event.clientX - state.dragOriginX;
    state.panY += event.clientY - state.dragOriginY;
    state.dragOriginX = event.clientX;
    state.dragOriginY = event.clientY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    state.isDragging = false;
  });

  elements.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    state.scale = Math.min(2.5, Math.max(0.2, state.scale * zoomFactor));
    applyTransform();
  }, { passive: false });

  return {
    applyTransform,
    centerOn,
    reset() {
      state.panX = 0;
      state.panY = 0;
      state.scale = 1;
      applyTransform();
    },
  };
}
