import { loadRecurringItems } from './core.mjs';
import { createEl } from './dom-helpers.mjs';
import { createHistoryRow, createRecurringRow } from './render-helpers.mjs';

export function getRecurringItems(storage, profileId) {
  return profileId ? loadRecurringItems(storage, profileId) : [];
}

export function updateDashboard(txHistory, doc = globalThis.document) {
  let income = 0;
  let spent = 0;

  txHistory.forEach((entry) => {
    if (entry.type === 'income') income += entry.amount;
    if (entry.type === 'spent') spent += entry.amount;
  });

  const incomeEl = doc.getElementById('dash-income');
  const spentEl = doc.getElementById('dash-spent');
  const balanceEl = doc.getElementById('dash-balance');

  if (incomeEl) incomeEl.innerText = `฿${income.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (spentEl) spentEl.innerText = `฿${spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (balanceEl) balanceEl.innerText = `฿${(income - spent).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function updateRecurringSummary(txHistory, storage, profileId, doc = globalThis.document) {
  const recurring = getRecurringItems(storage, profileId);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  let thisMonthIncome = 0;

  txHistory.forEach((tx) => {
    if (tx.type === 'income' && tx.isoDate) {
      const txDate = new Date(tx.isoDate);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        thisMonthIncome += tx.amount;
      }
    }
  });

  const totalRecurring = recurring.reduce((sum, item) => sum + item.amount, 0);
  const remain = thisMonthIncome - totalRecurring;

  const incomeEl = doc.getElementById('req-dash-income');
  const spentEl = doc.getElementById('req-dash-spent');
  const remainEl = doc.getElementById('req-dash-remain');

  if (incomeEl) incomeEl.innerText = `฿${thisMonthIncome.toLocaleString()}`;
  if (spentEl) spentEl.innerText = `฿${totalRecurring.toLocaleString()}`;
  if (remainEl) remainEl.innerText = `฿${remain.toLocaleString()}`;
}

export function renderRecurringList({
  storage,
  profileId,
  onPay,
  onToggleFav,
  onEdit,
  onDelete,
  doc = globalThis.document,
  lucide = globalThis.lucide,
} = {}) {
  const container = doc.getElementById('recurring-list-container');
  if (!container) return;

  container.replaceChildren();
  const items = getRecurringItems(storage, profileId);

  if (items.length === 0) {
    const empty = createEl('div', { className: 'text-center py-8 text-slate-400' });
    empty.appendChild(createEl('i', { className: 'w-6 h-6 mx-auto mb-1 opacity-50', attrs: { 'data-lucide': 'list-x' } }));
    empty.appendChild(createEl('p', { className: 'text-[10px]', text: 'ยังไม่มีรายการประจำ' }));
    container.appendChild(empty);
    lucide?.createIcons?.();
    return;
  }

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  items.forEach((item) => {
    const isPaidThisMonth = item.lastPaidMonth === currentMonthStr;
    const row = createRecurringRow(item, {
      isPaidThisMonth,
      onPay: () => onPay?.(item.id),
      onToggleFav: () => onToggleFav?.(item.id),
      onEdit: () => onEdit?.(item.id),
      onDelete: () => onDelete?.(item.id),
    });
    container.appendChild(row);
  });

  lucide?.createIcons?.();
}

export function renderHistory({
  txHistory,
  onEdit,
  onDelete,
  doc = globalThis.document,
  lucide = globalThis.lucide,
} = {}) {
  const listSection = doc.getElementById('history-list');
  const countEl = doc.getElementById('history-count');
  if (!listSection || !countEl) return;

  countEl.innerText = `${txHistory.length} รายการ`;
  listSection.replaceChildren();

  if (txHistory.length === 0) {
    const empty = createEl('div', { className: 'text-center py-10 text-slate-400' });
    empty.appendChild(createEl('i', { className: 'w-6 h-6 mx-auto mb-1', attrs: { 'data-lucide': 'folder-open' } }));
    empty.appendChild(createEl('span', { className: 'text-[10px]', text: 'ยังไม่พบประวัติ' }));
    listSection.appendChild(empty);
    lucide?.createIcons?.();
    return;
  }

  txHistory.forEach((data) => {
    const row = createHistoryRow(data, {
      onEdit: () => onEdit?.(data.id),
      onDelete: () => onDelete?.(data.id),
    });
    listSection.appendChild(row);
  });

  lucide?.createIcons?.();
}
