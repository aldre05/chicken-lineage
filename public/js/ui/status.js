export function createStatusController(elements) {
  return {
    show(message) {
      elements.statusText.textContent = message;
      elements.status.classList.add('is-visible');
      elements.status.setAttribute('aria-hidden', 'false');
    },
    hide() {
      elements.status.classList.remove('is-visible');
      elements.status.setAttribute('aria-hidden', 'true');
    },
  };
}
