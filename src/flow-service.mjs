import { applyTransactionSave, buildTransactionRecord } from './transaction-service.mjs';

export async function syncDataFromSheetFlow({
  apiClient,
  currentUserProfileId,
  categories,
  accounts,
  saveRecurringItems,
  localStorageRef = localStorage,
  getHistoryKey,
  updateDashboardFn,
  renderHistoryFn,
  renderRecurringListFn,
  updateRecurringSummaryFn,
  appState,
}) {
  const data = await apiClient.getJson({ user: currentUserProfileId });

  let isUpdated = false;
  if (data && data.history) {
    appState.txHistory = data.history.map((item) => {
      const catObj = categories[item.type]?.find((c) => c.name === item.categoryName);
      const accObj = accounts.find((a) => a.name === item.accountName);
      return {
        ...item,
        categoryIcon: catObj ? catObj.icon : 'help-circle',
        accountIcon: accObj ? accObj.icon : 'banknote',
      };
    });
    appState.txHistory.sort((a, b) => b.id - a.id);
    localStorageRef.setItem(getHistoryKey(), JSON.stringify(appState.txHistory));
    isUpdated = true;
  }

  if (data && data.recurring) {
    const mappedRecurring = data.recurring.map((item) => {
      const catObj = categories.spent.find((c) => c.name === item.category);
      const accObj = accounts.find((a) => a.name === item.account);
      const colorMap = { utensils: 'bg-orange-100 text-orange-600', coffee: 'bg-amber-100 text-amber-600', 'shopping-cart': 'bg-emerald-100 text-emerald-600', car: 'bg-blue-100 text-blue-600', clapperboard: 'bg-purple-100 text-purple-600', receipt: 'bg-rose-100 text-rose-600', palmtree: 'bg-teal-100 text-teal-600', 'help-circle': 'bg-slate-100 text-slate-600' };
      return {
        ...item,
        categoryId: catObj ? catObj.id : 'other_exp',
        accountId: accObj ? accObj.id : 'cash',
        icon: catObj ? catObj.icon : 'help-circle',
        color: catObj ? (colorMap[catObj.icon] || 'bg-slate-100 text-slate-600') : 'bg-slate-100 text-slate-600',
        fav: false,
      };
    });
    saveRecurringItems(localStorageRef, currentUserProfileId, mappedRecurring);
    isUpdated = true;
  }

  if (isUpdated) {
    updateDashboardFn();
    if (appState.currentPage === 'history') renderHistoryFn();
    if (appState.currentPage === 'list') { renderRecurringListFn(); updateRecurringSummaryFn(); }
  }
}

export async function selectProfileFlow({
  id,
  currentUserProfileIdRef,
  setCurrentUserProfileId,
  localStorageRef = localStorage,
  getHistoryKey,
  saveCurrentProfileId,
  updateActiveProfileUIFn,
  appState,
  updateDashboardFn,
  renderHistoryFn,
  renderRecurringListFn,
  updateRecurringSummaryFn,
  showToast,
  syncDataFromSheet,
}) {
  setCurrentUserProfileId(id);
  saveCurrentProfileId(localStorageRef, id);
  currentUserProfileIdRef.value = id;
  updateActiveProfileUIFn();
  appState.txHistory = JSON.parse(localStorageRef.getItem(getHistoryKey()) || '[]');
  updateDashboardFn();
  if (appState.currentPage === 'history') renderHistoryFn();
  if (appState.currentPage === 'list') { renderRecurringListFn(); updateRecurringSummaryFn(); }
  showToast(`เข้าสู่ระบบ: ${id}`, 'success');
  await syncDataFromSheet();
}

export async function saveTransactionFlow({
  uiState,
  appState,
  currentUserProfileId,
  categories,
  accounts,
  getHistoryKey,
  updateDashboardFn,
  renderHistoryFn,
  showToast,
  apiClient,
  document = globalThis.document,
  display,
  setLocalDatetime,
}) {
  const finalVal = parseFloat(uiState.expression);
  if (Number.isNaN(finalVal) || finalVal <= 0) { showToast('กรุณากรอกยอด', 'error'); return; }

  const matchedCat = categories[appState.currentType].find((c) => c.id === uiState.selectedCategory);
  const matchedAcc = accounts.find((a) => a.id === uiState.selectedAccount);
  const inputDate = new Date(document.getElementById('tx-date').value);
  const { transactionRecord, uiRecord } = buildTransactionRecord({
    editModeId: uiState.editModeId,
    currentType: appState.currentType,
    selectedCategory: uiState.selectedCategory,
    selectedAccount: uiState.selectedAccount,
    currentScannedBarcode: uiState.currentScannedBarcode,
    currentSlipRefNo: uiState.currentSlipRefNo,
    amount: finalVal,
    inputDate,
    currentUserProfileId,
    matchedCategory: matchedCat,
    matchedAccount: matchedAcc,
  });

  appState.txHistory = applyTransactionSave(appState.txHistory, uiRecord, uiState.editModeId);
  localStorage.setItem(getHistoryKey(), JSON.stringify(appState.txHistory));
  uiState.expression = '0';
  uiState.currentScannedBarcode = '';
  uiState.currentSlipRefNo = '';
  display.innerText = uiState.expression;
  document.getElementById('scanned-note').classList.add('hidden');
  uiState.editModeId = null;
  setLocalDatetime();
  updateDashboardFn();
  if (appState.currentPage === 'history') renderHistoryFn();
  showToast('บันทึกสำเร็จ', 'success');

  try { await apiClient.postJson(transactionRecord, { expectJson: false }); } catch {}
}

export async function executeDeleteFlow({
  id,
  appState,
  currentUserProfileId,
  getHistoryKey,
  updateDashboardFn,
  renderHistoryFn,
  showToast,
  apiClient,
}) {
  appState.txHistory = appState.txHistory.filter((t) => t.id !== id);
  localStorage.setItem(getHistoryKey(), JSON.stringify(appState.txHistory));
  updateDashboardFn();
  renderHistoryFn();
  try { await apiClient.postJson({ action: 'delete', id, sheetName: currentUserProfileId + '_History' }, { expectJson: false }); } catch {}
  showToast('ลบรายการสำเร็จ', 'success');
}
