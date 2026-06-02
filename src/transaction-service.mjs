export function buildTransactionRecord({
  editModeId,
  currentType,
  selectedCategory,
  selectedAccount,
  currentScannedBarcode,
  currentSlipRefNo,
  amount,
  inputDate,
  currentUserProfileId,
  matchedCategory,
  matchedAccount,
}) {
  const transactionRecord = {
    id: editModeId || Date.now(),
    type: currentType,
    categoryName: matchedCategory ? matchedCategory.name : 'อื่นๆ',
    accountName: matchedAccount ? matchedAccount.name : 'เงินสด',
    amount,
    barcodeNote: currentScannedBarcode,
    slipRefNo: currentSlipRefNo,
    date: inputDate.toLocaleString('th-TH'),
    isoDate: inputDate.toISOString().slice(0, 16),
    action: editModeId ? 'edit' : 'add',
    sheetName: currentUserProfileId + '_History',
  };

  const uiRecord = {
    ...transactionRecord,
    categoryIcon: matchedCategory ? matchedCategory.icon : 'help-circle',
    accountIcon: matchedAccount ? matchedAccount.icon : 'banknote',
    selectedCategory,
    selectedAccount,
  };

  return { transactionRecord, uiRecord };
}

export function applyTransactionSave(txHistory, uiRecord, editModeId) {
  const nextHistory = [...txHistory];
  if (editModeId) {
    const index = nextHistory.findIndex((t) => t.id === editModeId);
    if (index > -1) nextHistory[index] = uiRecord;
  } else {
    nextHistory.unshift(uiRecord);
  }
  return nextHistory;
}

export function buildEditDraft({
  tx,
  currentType,
  categories,
  accounts,
}) {
  return {
    editModeId: tx.id,
    currentType,
    selectedCategory: categories[tx.type].find((c) => c.name === tx.categoryName)?.id || categories[tx.type][0].id,
    selectedAccount: accounts.find((a) => a.name === tx.accountName)?.id || accounts[0].id,
    expression: tx.amount.toString(),
    currentSlipRefNo: tx.slipRefNo || '',
    isoDate: tx.isoDate || new Date().toISOString().slice(0, 16),
  };
}
