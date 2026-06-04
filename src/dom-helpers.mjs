export function createEl(tagName, { className, text, attrs } = {}) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        element.setAttribute(key, String(value));
      }
    });
  }
  return element;
}

export function setText(element, value) {
  element.textContent = value ?? '';
}

export function sanitizeIconName(iconName, fallback = 'help-circle') {
  return /^[a-z0-9-]+$/i.test(iconName || '') ? iconName : fallback;
}

export function clearChildren(element) {
  element.replaceChildren();
}

export function nextFrame() {
  return new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
