export const appState = {
  currentPage: 'add',
  currentType: 'spent',
  txHistory: [],
};

export function resetAppState() {
  appState.currentPage = 'add';
  appState.currentType = 'spent';
  appState.txHistory = [];
}
