import { createOption } from './render-helpers.mjs';
import { getHistoryStorageKey } from './core.mjs';
import { hideModal, setModalTitle, setSelectOptions, showModal } from './modal-helpers.mjs';
import { setButtonLoading } from './button-helpers.mjs';

export function openRecurringModal({
  id = null,
  document = globalThis.document,
  categories,
  accounts,
  getRecurringItems,
  showModalFn = showModal,
}) {
  const categorySelect = document.getElementById('req-category');
  const accountSelect = document.getElementById('req-account');
  setSelectOptions(categorySelect, categories.spent, createOption);
  setSelectOptions(accountSelect, accounts, createOption);

  if (id) {
    setModalTitle('req-modal-title', 'แก้ไขรายการประจำ');
    const item = getRecurringItems().find((i) => i.id === id);
    document.getElementById('req-id').value = item.id;
    document.getElementById('req-name').value = item.name;
    document.getElementById('req-desc').value = item.desc;
    document.getElementById('req-amount').value = item.amount.toLocaleString();
    document.getElementById('req-category').value = item.categoryId;
    document.getElementById('req-account').value = item.accountId || accounts[0].id;
  } else {
    setModalTitle('req-modal-title', 'เพิ่มรายการประจำ');
    document.getElementById('req-id').value = '';
    document.getElementById('req-name').value = '';
    document.getElementById('req-desc').value = 'ทุกสิ้นเดือน';
    document.getElementById('req-amount').value = '';
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

  if (!name || Number.isNaN(amount) || amount <= 0) { showToast('ข้อมูลไม่ครบถ้วน', 'error'); return; }

  const btn = document.querySelector('#recurring-modal button[onclick="saveRecurringItem()"]');
  const loadingState = setButtonLoading(btn, { label: 'กำลังบันทึก...', iconClass: 'w-4 h-4' });

  const matchedCat = categories.spent.find((c) => c.id === categoryId);
  const matchedAcc = accounts.find((a) => a.id === accountId);
  const colorMap = { utensils: 'bg-orange-100 text-orange-600', coffee: 'bg-amber-100 text-amber-600', 'shopping-cart': 'bg-emerald-100 text-emerald-600', car: 'bg-blue-100 text-blue-600', clapperboard: 'bg-purple-100 text-purple-600', receipt: 'bg-rose-100 text-rose-600', palmtree: 'bg-teal-100 text-teal-600', 'help-circle': 'bg-slate-100 text-slate-600' };

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
  };

  if (id) { const index = items.findIndex((i) => i.id == id); items[index] = newItem; } else { items.unshift(newItem); }
  saveRecurringItems(localStorageRef, currentUserProfileId, items);
  closeRecurringModalFn();
  renderRecurringListFn();
  updateRecurringSummaryFn();
  showToast('บันทึกรายการสำเร็จ', 'success');

  try { await apiClient.postJson({ sheetName: currentUserProfileId + '_Recurring', action: id ? 'edit' : 'add', ...newItem }, { expectJson: false }); } catch {}
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
  showToast('ลบแล้ว', 'success');
  try { await apiClient.postJson({ sheetName: currentUserProfileId + '_Recurring', action: 'delete', id }, { expectJson: false }); } catch {}
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
}) {
  const btn = globalThis.window?.event ? globalThis.window.event.currentTarget : null;
  const loadingState = setButtonLoading(btn, { label: 'รอ...', iconClass: 'w-3 h-3', wrapperClass: 'inline-flex items-center' });

  let items = getRecurringItems();
  const item = items.find((i) => i.id === id);
  if (!item) { loadingState?.restore(); return; }

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  if (item.lastPaidMonth === currentMonthStr) { loadingState?.restore(); showToast('จ่ายไปแล้วเดือนนี้', 'error'); return; }

  item.lastPaidMonth = currentMonthStr;
  const index = items.findIndex((i) => i.id === id); items[index] = item;
  const matchedCat = categories.spent.find((c) => c.id === item.categoryId) || categories.spent[0];
  const matchedAcc = accounts.find((a) => a.id === item.accountId) || accounts[0];

  const transactionRecord = { id: Date.now(), type: 'spent', categoryName: item.name, accountName: matchedAcc.name, amount: item.amount, barcodeNote: 'รายจ่ายประจำ: ' + item.desc, date: new Date().toLocaleString('th-TH'), isoDate: new Date().toISOString().slice(0, 16), action: 'add', sheetName: currentUserProfileId + '_History' };
  const uiRecord = { ...transactionRecord, categoryIcon: matchedCat.icon, accountIcon: matchedAcc.icon };

  try {
    await Promise.all([
      apiClient.postJson(transactionRecord, { expectJson: false }),
      apiClient.postJson({ sheetName: currentUserProfileId + '_Recurring', action: 'edit', ...item }, { expectJson: false }),
    ]);
  } catch {}

  appState.txHistory.unshift(uiRecord);
  appState.txHistory.sort((a, b) => b.id - a.id);
  localStorageRef.setItem(getHistoryStorageKey(currentUserProfileId), JSON.stringify(appState.txHistory));
  saveRecurringItems(localStorageRef, currentUserProfileId, items);

  updateDashboardFn();
  updateRecurringSummaryFn();
  renderRecurringListFn();
  showToast(`จ่าย ${item.name} สำเร็จ`, 'success');

  loadingState?.restore();
}
