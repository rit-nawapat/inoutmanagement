import { createEl } from './dom-helpers.mjs';
import { createIcon } from './render-helpers.mjs';

export function showModal(id) {
  globalThis.document?.getElementById(id)?.classList.remove('hidden');
}

export function hideModal(id) {
  globalThis.document?.getElementById(id)?.classList.add('hidden');
}

export function setModalTitle(id, text) {
  const el = globalThis.document?.getElementById(id);
  if (el) el.innerText = text;
}

export function setSelectOptions(selectEl, items, makeOption) {
  if (!selectEl) return;
  selectEl.replaceChildren(...items.map((item) => makeOption(item.id, item.name)));
}

export function renderImagePreview(container, src, fallbackIcon, fallbackClassName = 'w-8 h-8 text-slate-400') {
  if (!container) return;
  container.replaceChildren();
  if (src) {
    container.appendChild(createEl('img', {
      className: 'w-full h-full object-cover',
      attrs: { src },
    }));
  } else {
    container.appendChild(createIcon(fallbackIcon, fallbackClassName));
  }
}
