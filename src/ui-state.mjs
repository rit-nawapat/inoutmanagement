export const uiState = {
  expression: '0',
  isEvaluated: false,
  selectedCategory: 'food',
  selectedAccount: 'cash',
  editModeId: null,
  currentSlipRefNo: '',
  currentScannedBarcode: '',
};

export function resetUiState() {
  uiState.expression = '0';
  uiState.isEvaluated = false;
  uiState.selectedCategory = 'food';
  uiState.selectedAccount = 'cash';
  uiState.editModeId = null;
  uiState.currentSlipRefNo = '';
  uiState.currentScannedBarcode = '';
}
