import { createOption } from './render-helpers.mjs';
import { getHistoryStorageKey, saveBudgetGroups } from './core.mjs';
import { hideModal, setModalTitle, setSelectOptions, showModal } from './modal-helpers.mjs';
import { setButtonLoading } from './button-helpers.mjs';
import { nextFrame } from './dom-helpers.mjs';
import { showConfirmDialog } from './confirm-dialog.mjs';
import { calculateRemainingBalances, populateBudgetSelectOptions } from './budget-service.mjs';
import { syncQueueInstance } from './sync-queue.mjs';
import { formatThaiDisplayDateTime } from './transaction-service.mjs';

export function openRecurringModal({
  id = null,
  document = globalThis.document,
  categories,
  accounts,
  budgetGroups = [],
  getRecurringItems,
  showModalFn = showModal,
}) {
  const categorySelect = document.getElementById('req-category');
  const accountSelect = document.getElementById('req-account');
  const budgetSelect = document.getElementById('req-budget-group');
  setSelectOptions(categorySelect, categories.spent, createOption);
  setSelectOptions(accountSelect, accounts, createOption);

  if (budgetSelect) {
    populateBudgetSelectOptions(budgetSelect, budgetGroups);
  }

  if (id) {
    setModalTitle('req-modal-title', 'แก้ไขรายการประจำ');
    const item = getRecurringItems().find((i) => i.id === id);
    document.getElementById('req-id').value = item.id;
    document.getElementById('req-name').value = item.name;
    document.getElementById('req-desc').value = item.desc;
    document.getElementById('req-amount').value = item.amount.toLocaleString();
    document.getElementById('req-category').value = item.categoryId;
    document.getElementById('req-account').value = item.accountId || accounts[0].id;
    if (budgetSelect) {
      budgetSelect.value = item.defaultBudgetGroupId || '';
    }
  } else {
    setModalTitle('req-modal-title', 'เพิ่มรายการประจำ');
    document.getElementById('req-id').value = '';
    document.getElementById('req-name').value = '';
    document.getElementById('req-desc').value = 'ทุกสิ้นเดือน';
    document.getElementById('req-amount').value = '';
    if (budgetSelect) {
      budgetSelect.value = '';
    }
  }
  showModalFn('recurring-modal');
}

export function closeRecurringModal({ hideModalFn = hideModal }) {
  hideModalFn('recurring-modal');
}

export async function saveRecurringItem({
  document = globalThis.document,
  categories,
  accounts,
  currentUserProfileId,
  getRecurringItems,
  saveRecurringItems,
  closeRecurringModalFn,
  renderRecurringListFn,
  updateRecurringSummaryFn,
  apiClient,
  showToast,
  localStorageRef = localStorage,
  setButtonLoading,
}) {
  const id = document.getElementById('req-id').value;
  const name = document.getElementById('req-name').value;
  const desc = document.getElementById('req-desc').value;
  const rawAmount = document.getElementById('req-amount').value.replace(/,/g, '');
  const amount = parseFloat(rawAmount);
  const categoryId = document.getElementById('req-category').value;
  const accountId = document.getElementById('req-account').value;
  const defaultBudgetGroupId = document.getElementById('req-budget-group')?.value || '';

  if (!name || Number.isNaN(amount) || amount <= 0) { showToast('ข้อมูลไม่ครบถ้วน', 'error'); return; }

  const btn = document.querySelector('#recurring-modal button[onclick="saveRecurringItem()"]');
  const loadingState = setButtonLoading(btn, { label: 'กำลังบันทึก...', iconClass: 'w-4 h-4' });
  await nextFrame();

  const matchedCat = categories.spent.find((c) => c.id === categoryId);
  const matchedAcc = accounts.find((a) => a.id === accountId);
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

  const items = getRecurringItems();
  let lastPaidMonth = '';
  if (id) lastPaidMonth = items.find((i) => i.id == id).lastPaidMonth || '';

  const newItem = {
    id: id ? parseInt(id, 10) : Date.now(),
    name,
    desc,
    amount,
    categoryId,
    accountId,
    icon: matchedCat.icon,
    category: matchedCat.name,
    account: matchedAcc.name,
    color: colorMap[matchedCat.icon] || 'bg-slate-100 text-slate-600',
    fav: id ? items.find((i) => i.id == id).fav : false,
    lastPaidMonth,
    defaultBudgetGroupId,
  };

  if (id) { const index = items.findIndex((i) => i.id == id); items[index] = newItem; } else { items.unshift(newItem); }
  saveRecurringItems(localStorageRef, currentUserProfileId, items);
  closeRecurringModalFn();
  renderRecurringListFn();
  updateRecurringSummaryFn();
  if (syncQueueInstance) {
    syncQueueInstance.enqueue({ sheetName: currentUserProfileId + '_Recurring', action: id ? 'edit' : 'add', ...newItem });
    showToast('บันทึกรายการสำเร็จ', 'success');
  } else {
    apiClient.postJson({ sheetName: currentUserProfileId + '_Recurring', action: id ? 'edit' : 'add', ...newItem }, { expectJson: false })
      .then(() => showToast('บันทึกรายการสำเร็จ', 'success'))
      .catch(() => showToast('บันทึกในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error'));
  }
  loadingState?.restore();
}

export async function executeDeleteRecurring({
  id,
  currentUserProfileId,
  getRecurringItems,
  saveRecurringItems,
  renderRecurringListFn,
  updateRecurringSummaryFn,
  showToast,
  apiClient,
  localStorageRef = localStorage,
}) {
  let items = getRecurringItems();
  items = items.filter((i) => i.id !== id);
  saveRecurringItems(localStorageRef, currentUserProfileId, items);
  renderRecurringListFn();
  updateRecurringSummaryFn();
  if (syncQueueInstance) {
    syncQueueInstance.enqueue({ sheetName: currentUserProfileId + '_Recurring', action: 'delete', id });
    showToast('ลบแล้ว', 'success');
  } else {
    apiClient.postJson({ sheetName: currentUserProfileId + '_Recurring', action: 'delete', id }, { expectJson: false })
      .then(() => showToast('ลบแล้ว', 'success'))
      .catch(() => showToast('ลบในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error'));
  }
}

export function deleteRecurringItem({ id, triggerResetConfirm }) {
  triggerResetConfirm('delete_recurring', id);
}

export function toggleFavRecurring({
  id,
  currentUserProfileId,
  getRecurringItems,
  saveRecurringItems,
  renderRecurringListFn,
  localStorageRef = localStorage,
}) {
  const items = getRecurringItems();
  const item = items.find((i) => i.id === id);
  if (item) {
    item.fav = !item.fav;
    saveRecurringItems(localStorageRef, currentUserProfileId, items);
    renderRecurringListFn();
  }
}

export async function payRecurringItem({
  id,
  currentUserProfileId,
  getRecurringItems,
  saveRecurringItems,
  updateDashboardFn,
  updateRecurringSummaryFn,
  renderRecurringListFn,
  showToast,
  apiClient,
  appState,
  localStorageRef = localStorage,
  categories,
  accounts,
  getHistoryKey,
  budgetGroups = [],
  saveBudgetGroupsFn = saveBudgetGroups,
  onRequireBudgetGroupChooser,
  chosenBudgetGroupId = undefined,
  showConfirmDialogFn = showConfirmDialog,
}) {
  const btn = globalThis.window?.event ? globalThis.window.event.currentTarget : null;
  const loadingState = setButtonLoading(btn, { label: 'รอ...', iconClass: 'w-3 h-3', wrapperClass: 'inline-flex items-center' });
  await nextFrame();

  let items = getRecurringItems();
  const item = items.find((i) => i.id === id);
  if (!item) { loadingState?.restore(); return; }

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  if (item.lastPaidMonth === currentMonthStr) { loadingState?.restore(); showToast('จ่ายไปแล้วเดือนนี้', 'error'); return; }

  // Resolve target budget group
  let targetBudgetGroupId = chosenBudgetGroupId;
  if (targetBudgetGroupId === undefined) {
    const hasDefault = item.defaultBudgetGroupId && budgetGroups.some((g) => g && g.id != null && String(g.id) === String(item.defaultBudgetGroupId) && !g.isArchived);
    if (hasDefault) {
      targetBudgetGroupId = item.defaultBudgetGroupId;
    } else {
      // No default! Ask user via callback
      loadingState?.restore();
      if (onRequireBudgetGroupChooser) {
        onRequireBudgetGroupChooser(item, (selectedId) => {
          payRecurringItem({
            id,
            currentUserProfileId,
            getRecurringItems,
            saveRecurringItems,
            updateDashboardFn,
            updateRecurringSummaryFn,
            renderRecurringListFn,
            showToast,
            apiClient,
            appState,
            localStorageRef,
            categories,
            accounts,
            getHistoryKey,
            budgetGroups,
            saveBudgetGroupsFn,
            onRequireBudgetGroupChooser,
            chosenBudgetGroupId: selectedId,
          });
        });
      } else {
        showToast('กรุณาระบุกลุ่มกระเป๋าก่อนชำระเงิน', 'error');
      }
      return;
    }
  }

  // Deduct/warn if negative balance
  const matchedBudgetGroup = budgetGroups.find((g) => g && g.id != null && String(g.id) === String(targetBudgetGroupId));
  if (matchedBudgetGroup) {
    const isNegative = matchedBudgetGroup.remaining - item.amount < 0;
    if (isNegative) {
      const confirmSave = await showConfirmDialogFn({
        title: 'ยอดเงินจะติดลบ',
        desc: `ยอดเงินคงเหลือในกลุ่ม "${matchedBudgetGroup.name}" จะติดลบ (คงเหลือ ฿${(matchedBudgetGroup.remaining - item.amount).toLocaleString()}) ยืนยันที่จะบันทึกต่อหรือไม่?`,
        btnText: 'ยืนยันการจ่าย',
        btnClass: 'w-full bg-indigo-600 text-white py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors hover:bg-indigo-700',
      });
      if (!confirmSave) {
        loadingState?.restore();
        return;
      }
    }
  }

  item.lastPaidMonth = currentMonthStr;
  const index = items.findIndex((i) => i.id === id); items[index] = item;
  const matchedCat = categories.spent.find((c) => c.id === item.categoryId) || categories.spent[0];
  const matchedAcc = accounts.find((a) => a.id === item.accountId) || accounts[0];
  const now = new Date();

  const transactionRecord = {
    id: Date.now(),
    type: 'spent',
    categoryName: item.name,
    accountName: matchedAcc.name,
    amount: item.amount,
    barcodeNote: 'รายจ่ายประจำ: ' + item.desc,
    date: formatThaiDisplayDateTime(now),
    isoDate: now.toISOString().slice(0, 16),
    budgetGroupId: matchedBudgetGroup ? matchedBudgetGroup.id : null,
    budgetGroupName: matchedBudgetGroup ? matchedBudgetGroup.name : null,
    budgetGroupType: matchedBudgetGroup ? (matchedBudgetGroup.parentId ? 'child' : 'root') : null,
    recurringSourceId: item.id,
    action: 'add',
    sheetName: currentUserProfileId + '_History',
  };
  const uiRecord = { ...transactionRecord, categoryIcon: matchedCat.icon, accountIcon: matchedAcc.icon };

  // Optimistic save
  appState.txHistory.unshift(uiRecord);
  appState.txHistory.sort((a, b) => b.id - a.id);
  localStorageRef.setItem(getHistoryStorageKey(currentUserProfileId), JSON.stringify(appState.txHistory));
  saveRecurringItems(localStorageRef, currentUserProfileId, items);

  // Recalculate remaining balances
  if (budgetGroups && budgetGroups.length > 0) {
    const updatedGroups = calculateRemainingBalances(budgetGroups, appState.txHistory);
    saveBudgetGroupsFn(localStorageRef, currentUserProfileId, updatedGroups);
    
    // Sync affected budget groups to backend
    updatedGroups.forEach((g) => {
      const oldG = budgetGroups.find((og) => og && og.id != null && g && g.id != null && String(og.id) === String(g.id));
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

  if (syncQueueInstance) {
    syncQueueInstance.enqueue(transactionRecord);
    syncQueueInstance.enqueue({ sheetName: currentUserProfileId + '_Recurring', action: 'edit', ...item });
    showToast(`จ่าย ${item.name} สำเร็จ`, 'success');
  } else {
    Promise.all([
      apiClient.postJson(transactionRecord, { expectJson: false }),
      apiClient.postJson({ sheetName: currentUserProfileId + '_Recurring', action: 'edit', ...item }, { expectJson: false }),
    ])
    .then(() => showToast(`จ่าย ${item.name} สำเร็จ`, 'success'))
    .catch(() => showToast(`บันทึกการจ่าย ${item.name} ในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว`, 'error'));
  }

  updateDashboardFn();
  updateRecurringSummaryFn();
  renderRecurringListFn();

  loadingState?.restore();
}

export async function cancelRecurringPayment({
  id,
  currentUserProfileId,
  getRecurringItems,
  saveRecurringItems,
  updateDashboardFn,
  updateRecurringSummaryFn,
  renderRecurringListFn,
  showToast,
  apiClient,
  appState,
  localStorageRef = localStorage,
  budgetGroups = [],
  saveBudgetGroupsFn,
  showConfirmDialogFn = showConfirmDialog,
}) {
  const confirmed = await showConfirmDialogFn({
    title: 'ยกเลิกการจ่ายบิล?',
    desc: 'ต้องการยกเลิกการชำระเงินบิลประจำและลบรายการรายจ่ายที่เกี่ยวข้องใช่หรือไม่?',
    btnText: 'ยืนยันยกเลิก',
    btnClass: 'flex-1 bg-rose-600 text-white py-2.5 rounded-lg cursor-pointer hover:bg-rose-700 transition-colors',
  });
  if (!confirmed) return;

  let items = getRecurringItems();
  const item = items.find((i) => i.id == id);
  if (!item) return;

  item.lastPaidMonth = '';
  saveRecurringItems(localStorageRef, currentUserProfileId, items);

  const linkedTx = appState.txHistory.find((tx) => tx.recurringSourceId == id);
  if (linkedTx) {
    appState.txHistory = appState.txHistory.filter((tx) => tx.id !== linkedTx.id);
    localStorageRef.setItem(getHistoryStorageKey(currentUserProfileId), JSON.stringify(appState.txHistory));

    if (linkedTx.budgetGroupId && budgetGroups && budgetGroups.length > 0) {
      const updatedGroups = calculateRemainingBalances(budgetGroups, appState.txHistory);
      if (saveBudgetGroupsFn) {
        saveBudgetGroupsFn(localStorageRef, currentUserProfileId, updatedGroups);
      }
      
      updatedGroups.forEach((g) => {
        const oldG = budgetGroups.find((og) => og && og.id != null && g && g.id != null && String(og.id) === String(g.id));
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

    if (syncQueueInstance) {
      syncQueueInstance.enqueue({
        sheetName: currentUserProfileId + '_History',
        action: 'delete',
        id: linkedTx.id,
      });
    } else {
      apiClient.postJson({
        sheetName: currentUserProfileId + '_History',
        action: 'delete',
        id: linkedTx.id,
      }, { expectJson: false }).catch(() => {});
    }
  }

  if (syncQueueInstance) {
    syncQueueInstance.enqueue({
      sheetName: currentUserProfileId + '_Recurring',
      action: 'edit',
      ...item,
    });
    showToast('ยกเลิกการจ่ายบิลสำเร็จ', 'success');
  } else {
    await apiClient.postJson({
      sheetName: currentUserProfileId + '_Recurring',
      action: 'edit',
      ...item,
    }, { expectJson: false })
    .then(() => showToast('ยกเลิกการจ่ายบิลสำเร็จ', 'success'))
    .catch(() => showToast('ยกเลิกในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error'));
  }

  updateDashboardFn();
  updateRecurringSummaryFn();
  renderRecurringListFn();
}
