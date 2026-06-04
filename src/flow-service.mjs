import { applyTransactionSave, buildTransactionRecord, normalizeTransactionHistory } from './transaction-service.mjs';
import { calculateRemainingBalances } from './budget-service.mjs';
import { saveBudgetGroups } from './core.mjs';
import { showConfirmDialog } from './confirm-dialog.mjs';
import { syncQueueInstance } from './sync-queue.mjs';

export async function syncDataFromSheetFlow({
  apiClient,
  currentUserProfileId,
  categories,
  accounts,
  saveRecurringItems,
  saveBudgetGroupsFn = saveBudgetGroups,
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
  let mappedRecurring = null;
  if (data && data.recurring) {
    mappedRecurring = data.recurring.map((item) => {
      const categoryRef = item.categoryId || item.category;
      const accountRef = item.accountId || item.account;
      const catObj = categories.spent.find((c) => c.id === categoryRef || c.name === categoryRef);
      const accObj = accounts.find((a) => a.id === accountRef || a.name === accountRef);
      const colorMap = {
        utensils: 'bg-orange-100 text-orange-600',
        coffee: 'bg-amber-100 text-amber-600',
        'shopping-cart': 'bg-emerald-100 text-emerald-600',
        car: 'bg-blue-100 text-blue-600',
        clapperboard: 'bg-purple-100 text-purple-600',
        receipt: 'bg-rose-100 text-rose-600',
        palmtree: 'bg-teal-100 text-teal-600',
        'help-circle': 'bg-slate-100 text-slate-600',
        zap: 'bg-amber-100 text-amber-600',
        droplets: 'bg-blue-100 text-blue-600',
        wifi: 'bg-purple-100 text-purple-600',
      };
      return {
        ...item,
        categoryId: catObj ? catObj.id : (categoryRef || 'other_exp'),
        accountId: accObj ? accObj.id : (accountRef || 'cash'),
        icon: catObj ? catObj.icon : 'help-circle',
        color: catObj ? (colorMap[catObj.icon] || 'bg-slate-100 text-slate-600') : 'bg-slate-100 text-slate-600',
        fav: false,
        lastPaidMonth: item.lastPaidMonth || '',
        defaultBudgetGroupId: item.defaultBudgetGroupId || ''
      };
    });
  }

  if (data && data.history) {
    appState.txHistory = normalizeTransactionHistory(data.history, {
      categories,
      accounts,
      recurringItems: mappedRecurring || [],
    });
    appState.txHistory.sort((a, b) => b.id - a.id);
    localStorageRef.setItem(getHistoryKey(), JSON.stringify(appState.txHistory));
    isUpdated = true;
  }

  if (mappedRecurring) {
    saveRecurringItems(localStorageRef, currentUserProfileId, mappedRecurring);
    isUpdated = true;
  }

  if (data && data.budget) {
    saveBudgetGroupsFn(localStorageRef, currentUserProfileId, data.budget);
    isUpdated = true;
  }

  if (isUpdated) {
    updateDashboardFn();
    if (appState.currentPage === 'history') {
      renderRecurringListFn();
      updateRecurringSummaryFn();
      renderHistoryFn();
    }
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
  if (appState.currentPage === 'history') {
    renderRecurringListFn();
    updateRecurringSummaryFn();
    renderHistoryFn();
  }
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
  budgetGroups,
  saveBudgetGroupsFn = saveBudgetGroups,
  getHistoryKey,
  updateDashboardFn,
  renderHistoryFn,
  renderRecurringListFn,
  updateRecurringSummaryFn,
  showToast,
  apiClient,
  document = globalThis.document,
  display,
  setLocalDatetime,
}) {
  const finalVal = parseFloat(uiState.expression);
  if (Number.isNaN(finalVal) || finalVal <= 0) { showToast('กรุณากรอกยอด', 'error'); return; }

  // Warning check if budget would go negative
  if (uiState.selectedBudgetGroupId && budgetGroups) {
    const matchedGroup = budgetGroups.find(g => g.id.toString() === uiState.selectedBudgetGroupId.toString());
    if (matchedGroup) {
      const isNegative = matchedGroup.remaining - finalVal < 0;
      if (isNegative) {
        const confirmSave = await showConfirmDialog({
          type: 'default',
          title: 'ยอดเงินจะติดลบ',
          desc: `ยอดเงินคงเหลือในกลุ่ม "${matchedGroup.name}" จะติดลบ (คงเหลือ ฿${(matchedGroup.remaining - finalVal).toLocaleString()}) ยืนยันที่จะบันทึกต่อหรือไม่?`,
          btnText: 'บันทึกต่อ',
        });
        if (!confirmSave) return;
      }
    }
  }

  const matchedCat = categories[appState.currentType].find((c) => c.id === uiState.selectedCategory);
  const matchedAcc = accounts.find((a) => a.id === uiState.selectedAccount);
  const inputDate = new Date(document.getElementById('tx-date').value);
  const { transactionRecord, uiRecord } = buildTransactionRecord({
    editModeId: uiState.editModeId,
    currentType: appState.currentType,
    selectedCategory: uiState.selectedCategory,
    selectedAccount: uiState.selectedAccount,
    selectedBudgetGroupId: uiState.selectedBudgetGroupId,
    budgetGroups,
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

  // Recalculate remaining balances
  if (budgetGroups && budgetGroups.length > 0) {
    const updatedGroups = calculateRemainingBalances(budgetGroups, appState.txHistory);
    saveBudgetGroupsFn(localStorage, currentUserProfileId, updatedGroups);
    
    // Sync affected budget groups to backend
    updatedGroups.forEach((g) => {
      const oldG = budgetGroups.find((og) => og.id.toString() === g.id.toString());
      if (!oldG || oldG.remaining !== g.remaining) {
        if (syncQueueInstance) {
          syncQueueInstance.enqueue({
            sheetName: currentUserProfileId + '_Budget',
            action: 'edit',
            ...g,
          });
        } else {
          apiClient.postJson({
            sheetName: currentUserProfileId + '_Budget',
            action: 'edit',
            ...g,
          }, { expectJson: false }).catch(() => {});
        }
      }
    });
  }

  try {
    if (syncQueueInstance) {
      syncQueueInstance.enqueue(transactionRecord);
      showToast('บันทึกสำเร็จ', 'success');
    } else {
      await apiClient.postJson(transactionRecord, { expectJson: false });
      showToast('บันทึกสำเร็จ', 'success');
    }
  } catch {
    showToast('บันทึกในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error');
  } finally {
    uiState.expression = '0';
    uiState.currentScannedBarcode = '';
    uiState.currentSlipRefNo = '';
    uiState.selectedBudgetGroupId = '';
    display.innerText = uiState.expression;
    document.getElementById('scanned-note').classList.add('hidden');
    uiState.editModeId = null;
    setLocalDatetime();
    updateDashboardFn();
    if (appState.currentPage === 'history') {
      renderRecurringListFn();
      updateRecurringSummaryFn();
      renderHistoryFn();
    }
  }
}

export async function executeDeleteFlow({
  id,
  appState,
  currentUserProfileId,
  budgetGroups,
  saveBudgetGroupsFn = saveBudgetGroups,
  getHistoryKey,
  updateDashboardFn,
  renderHistoryFn,
  renderRecurringListFn,
  updateRecurringSummaryFn,
  showToast,
  apiClient,
}) {
  appState.txHistory = appState.txHistory.filter((t) => t.id !== id);
  localStorage.setItem(getHistoryKey(), JSON.stringify(appState.txHistory));

  // Recalculate remaining balances
  if (budgetGroups && budgetGroups.length > 0) {
    const updatedGroups = calculateRemainingBalances(budgetGroups, appState.txHistory);
    saveBudgetGroupsFn(localStorage, currentUserProfileId, updatedGroups);
    
    // Sync affected budget groups to backend
    updatedGroups.forEach((g) => {
      const oldG = budgetGroups.find((og) => og.id.toString() === g.id.toString());
      if (!oldG || oldG.remaining !== g.remaining) {
        if (syncQueueInstance) {
          syncQueueInstance.enqueue({
            sheetName: currentUserProfileId + '_Budget',
            action: 'edit',
            ...g,
          });
        } else {
          apiClient.postJson({
            sheetName: currentUserProfileId + '_Budget',
            action: 'edit',
            ...g,
          }, { expectJson: false }).catch(() => {});
        }
      }
    });
  }

  updateDashboardFn();
  if (appState.currentPage === 'history') {
    renderRecurringListFn();
    updateRecurringSummaryFn();
    renderHistoryFn();
  } else {
    renderHistoryFn();
  }

  if (syncQueueInstance) {
    syncQueueInstance.enqueue({ action: 'delete', id, sheetName: currentUserProfileId + '_History' });
    showToast('ลบรายการสำเร็จ', 'success');
  } else {
    apiClient.postJson({ action: 'delete', id, sheetName: currentUserProfileId + '_History' }, { expectJson: false })
      .then(() => showToast('ลบรายการสำเร็จ', 'success'))
      .catch(() => showToast('ลบในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error'));
  }
}

