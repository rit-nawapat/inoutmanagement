export const uiState = {
  expression: '0',
  isEvaluated: false,
  selectedCategory: 'food',
  selectedAccount: 'cash',
  accountTab: 'money',
  selectedBudgetGroupId: '',
  editModeId: null,
  currentSlipRefNo: '',
  currentScannedBarcode: '',
};

export function resetUiState() {
  uiState.expression = '0';
  uiState.isEvaluated = false;
  uiState.selectedCategory = 'food';
  uiState.selectedAccount = 'cash';
  uiState.accountTab = 'money';
  uiState.selectedBudgetGroupId = '';
  uiState.editModeId = null;
  uiState.currentSlipRefNo = '';
  uiState.currentScannedBarcode = '';
}
