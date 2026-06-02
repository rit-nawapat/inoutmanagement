import { createEl } from './dom-helpers.mjs';

export function setButtonLoading(button, { label, iconClass = 'w-4 h-4', wrapperClass = 'inline-flex items-center', spinnerClass = 'opacity-70 cursor-not-allowed' } = {}) {
  if (!button) return null;

  const originalNodes = Array.from(button.childNodes).map((node) => node.cloneNode(true));
  const loadingContent = createEl('span', { className: wrapperClass });
  loadingContent.appendChild(createEl('i', {
    className: `${iconClass} animate-spin inline-block mr-2`,
    attrs: { 'data-lucide': 'loader-2' },
  }));
  loadingContent.appendChild(createEl('span', { text: label }));

  button.replaceChildren(loadingContent);
  button.disabled = true;
  button.classList.add(...spinnerClass.split(' ').filter(Boolean));
  globalThis.lucide?.createIcons?.();

  return {
    restore() {
      button.replaceChildren(...originalNodes.map((node) => node.cloneNode(true)));
      button.disabled = false;
      button.classList.remove(...spinnerClass.split(' ').filter(Boolean));
      globalThis.lucide?.createIcons?.();
    },
    button,
  };
}

export function setDialogConfirmLoading(button, label = 'รอสักครู่...') {
  return setButtonLoading(
    button,
    { label }
  );
}
