import { stateStore } from './state-store.mjs';

// Ensure keys exist in state store
if (stateStore.get('currentPage') === undefined) {
  stateStore.set('currentPage', 'add', true);
}
if (stateStore.get('currentType') === undefined) {
  stateStore.set('currentType', 'spent', true);
}

export const appState = {
  get currentPage() {
    return stateStore.get('currentPage') || 'add';
  },
  set currentPage(value) {
    stateStore.set('currentPage', value);
  },
  get currentType() {
    return stateStore.get('currentType') || 'spent';
  },
  set currentType(value) {
    stateStore.set('currentType', value);
  },
  get txHistory() {
    return stateStore.get('txHistory') || [];
  },
  set txHistory(value) {
    stateStore.set('txHistory', value);
    stateStore.saveToCache(); // Automatically write to offline cache
  }
};

export function resetAppState() {
  appState.currentPage = 'add';
  appState.currentType = 'spent';
  appState.txHistory = [];
}

