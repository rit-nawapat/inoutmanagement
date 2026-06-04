import { loadRecurringItems } from './core.mjs';
import { categories, accounts } from './catalog-service.mjs';
import { createEl } from './dom-helpers.mjs';
import { createHistoryRow, createRecurringRow } from './render-helpers.mjs';
import { normalizeTransactionRecord } from './transaction-service.mjs';
import { calculateDebtBalances } from './debt-service.mjs';
import { stateStore } from './state-store.mjs';

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

  const balance = income - spent;

  if (incomeEl) incomeEl.innerText = `฿${income.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (spentEl) spentEl.innerText = `฿${spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (balanceEl) balanceEl.innerText = `฿${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  // Calculate Daily Allowance
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const remainingDays = Math.max(1, totalDays - now.getDate() + 1);

  // Compute remaining budget
  const budgetGroups = stateStore ? (stateStore.get('budgetGroups') || []) : [];
  const nonArchivedBudgets = budgetGroups.filter(g => !g.isArchived);
  const totalRemainingBudget = nonArchivedBudgets.reduce((sum, g) => sum + (g.remaining || 0), 0);

  // Allowance is based on remaining budget if any exists, otherwise total balance
  const allowanceBase = totalRemainingBudget > 0 ? totalRemainingBudget : balance;
  const dailyAllowance = Math.max(0, allowanceBase / remainingDays);

  const allowanceEl = doc.getElementById('dash-daily-allowance');
  const daysEl = doc.getElementById('dash-remaining-days');

  if (allowanceEl) {
    allowanceEl.innerText = `฿${dailyAllowance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / วัน`;
  }
  if (daysEl) {
    daysEl.innerText = `เหลือ ${remainingDays} วันในเดือนนี้`;
  }
}


export function updateRecurringSummary(txHistory, storage, profileId, doc = globalThis.document, targetIds = {}) {
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

  const incomeEl = doc.getElementById(targetIds.incomeId || 'req-dash-income');
  const spentEl = doc.getElementById(targetIds.spentId || 'req-dash-spent');
  const remainEl = doc.getElementById(targetIds.remainId || 'req-dash-remain');

  if (incomeEl) incomeEl.innerText = `฿${thisMonthIncome.toLocaleString()}`;
  if (spentEl) spentEl.innerText = `฿${totalRecurring.toLocaleString()}`;
  if (remainEl) remainEl.innerText = `฿${remain.toLocaleString()}`;
}



export function renderRecurringList({
  storage,
  profileId,
  onPay,
  onCancelPay,
  onToggleFav,
  onEdit,
  onDelete,
  budgetGroups = [],
  doc = globalThis.document,
  lucide = globalThis.lucide,
  containerId = 'recurring-list-container',
} = {}) {
  const container = doc.getElementById(containerId);
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
      budgetGroups,
      onPay: () => onPay?.(item.id),
      onCancelPay: () => onCancelPay?.(item.id),
      onToggleFav: () => onToggleFav?.(item.id),
      onEdit: () => onEdit?.(item.id),
      onDelete: () => onDelete?.(item.id),
    });
    container.appendChild(row);
  });

  lucide?.createIcons?.();
}

export function renderRecurringPreview({
  storage,
  profileId,
  doc = globalThis.document,
  lucide = globalThis.lucide,
  containerId = 'recurring-preview-history',
  maxItems = 3,
} = {}) {
  const container = doc.getElementById(containerId);
  if (!container) return;

  container.replaceChildren();
  const items = getRecurringItems(storage, profileId);
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const activeItems = items.filter((item) => item.lastPaidMonth !== currentMonthStr);
  const totalRecurring = items.reduce((sum, item) => sum + item.amount, 0);

  const header = createEl('div', { className: 'flex items-center justify-between gap-2' });
  header.appendChild(createEl('span', { className: 'text-[10px] font-bold text-slate-500 uppercase tracking-wide', text: `${items.length} รายการประจำ` }));
  header.appendChild(createEl('span', { className: 'text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full', text: `฿${totalRecurring.toLocaleString()}` }));
  container.appendChild(header);

  if (items.length === 0) {
    const empty = createEl('div', { className: 'text-center py-4 text-slate-400' });
    empty.appendChild(createEl('i', { className: 'w-5 h-5 mx-auto mb-1 opacity-50', attrs: { 'data-lucide': 'list-x' } }));
    empty.appendChild(createEl('p', { className: 'text-[10px]', text: 'ยังไม่มีรายการประจำ' }));
    container.appendChild(empty);
    lucide?.createIcons?.();
    return;
  }

  const list = createEl('div', { className: 'space-y-2' });
  activeItems.slice(0, maxItems).forEach((item) => {
    const row = createEl('div', {
      className: 'flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2',
    });
    const left = createEl('div', { className: 'min-w-0 flex-1' });
    left.appendChild(createEl('div', {
      className: 'text-[11px] font-bold text-slate-800 truncate',
      text: item.name,
    }));
    left.appendChild(createEl('div', {
      className: 'text-[10px] text-slate-500 truncate',
      text: item.desc || 'รายการประจำ',
    }));

    const right = createEl('div', { className: 'text-right shrink-0' });
    right.appendChild(createEl('div', {
      className: 'text-[11px] font-bold text-slate-800',
      text: `฿${Number(item.amount || 0).toLocaleString()}`,
    }));
    right.appendChild(createEl('div', {
      className: 'text-[9px] font-bold text-emerald-600',
      text: item.lastPaidMonth === currentMonthStr ? 'จ่ายแล้วเดือนนี้' : 'ยังไม่จ่าย',
    }));

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  });

  if (activeItems.length > maxItems) {
    list.appendChild(createEl('div', {
      className: 'text-center text-[10px] font-bold text-slate-400 py-1',
      text: `อีก ${activeItems.length - maxItems} รายการ`,
    }));
  }

  container.appendChild(list);
  lucide?.createIcons?.();
}

export function renderHistory({
  txHistory,
  onEdit,
  onDelete,
  doc = globalThis.document,
  lucide = globalThis.lucide,
  containerId = 'history-list',
  countId = 'history-count',
  storage,
  profileId,
  recurringItems,
} = {}) {
  const listSection = doc.getElementById(containerId);
  const countEl = doc.getElementById(countId);
  if (!listSection || !countEl) return;

  const filteredHistory = txHistory.filter(tx => tx.type !== 'debt_adjustment');
  const recurring = recurringItems || (storage && profileId ? getRecurringItems(storage, profileId) : []);

  countEl.innerText = `${filteredHistory.length} รายการ`;
  listSection.replaceChildren();

  if (filteredHistory.length === 0) {
    const empty = createEl('div', { className: 'text-center py-10 text-slate-400' });
    empty.appendChild(createEl('i', { className: 'w-6 h-6 mx-auto mb-1', attrs: { 'data-lucide': 'folder-open' } }));
    empty.appendChild(createEl('span', { className: 'text-[10px]', text: 'ยังไม่พบประวัติ' }));
    listSection.appendChild(empty);
    lucide?.createIcons?.();
    return;
  }

  filteredHistory.forEach((data) => {
    const normalized = normalizeTransactionRecord(data, {
      categories,
      accounts,
      recurringItems: recurring,
    });
    const row = createHistoryRow(normalized, {
      onEdit: () => onEdit?.(data.id),
      onDelete: () => onDelete?.(data.id),
    });
    listSection.appendChild(row);
  });

  lucide?.createIcons?.();
}

export function renderUpcomingForecast({
  txHistory,
  storage,
  profileId,
  accounts,
  doc = globalThis.document,
  lucide = globalThis.lucide,
  containerId = 'dashboard-forecast-list',
  countId = 'forecast-count',
} = {}) {
  const container = doc.getElementById(containerId);
  const countEl = doc.getElementById(countId);
  if (!container) return;

  container.replaceChildren();
  const recurringItems = profileId ? loadRecurringItems(storage, profileId) : [];
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const now = new Date();
  const todayDay = now.getDate();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const upcomingList = [];

  // 1. Process recurring items
  recurringItems.forEach((item) => {
    const isPaidThisMonth = item.lastPaidMonth === currentMonthStr;
    if (isPaidThisMonth) return;

    let dueDay = 28;
    const match = (item.desc || '').match(/\d+/);
    if (match) {
      dueDay = parseInt(match[0], 10);
    } else if ((item.desc || '').includes('สิ้น')) {
      dueDay = totalDays;
    }

    const daysUntilDue = dueDay - todayDay;
    if (daysUntilDue >= -7 && daysUntilDue <= 7) {
      upcomingList.push({
        id: item.id,
        type: 'recurring',
        name: item.name,
        amount: item.amount,
        icon: item.icon || 'receipt',
        color: item.color || 'bg-slate-100 text-slate-600',
        dueText: daysUntilDue < 0 ? `เกินกำหนดมาแล้ว ${Math.abs(daysUntilDue)} วัน` : (daysUntilDue === 0 ? 'ครบกำหนดวันนี้!' : `อีก ${daysUntilDue} วันจะถึงกำหนด`),
        daysUntilDue: daysUntilDue,
      });
    }
  });

  // 2. Process non-zero debt balances
  const debtBalances = calculateDebtBalances(txHistory, accounts);
  const settingsKey = `my_debt_settings_${profileId}`;
  const settings = JSON.parse(storage.getItem(settingsKey) || '{}');

  debtBalances.forEach((acc) => {
    if (acc.debtAmount > 0) {
      const dueDay = settings[acc.id]?.dueDay;
      if (dueDay) {
        const resolvedDueDay = dueDay === 'last' ? totalDays : parseInt(dueDay, 10);
        const daysUntilDue = resolvedDueDay - todayDay;
        // Alert when it is near (within -7 to 7 days)
        if (daysUntilDue >= -7 && daysUntilDue <= 7) {
          upcomingList.push({
            id: acc.id,
            type: 'debt',
            name: `ชำระยอดค้าง ${acc.name}`,
            amount: acc.debtAmount,
            icon: acc.icon || 'credit-card',
            color: 'bg-rose-50 text-rose-600',
            dueText: daysUntilDue < 0 
              ? `เกินกำหนดจ่ายมาแล้ว ${Math.abs(daysUntilDue)} วัน` 
              : (daysUntilDue === 0 ? 'ครบกำหนดจ่ายวันนี้!' : `อีก ${daysUntilDue} วันจะครบกำหนดจ่าย`),
            daysUntilDue: daysUntilDue,
          });
        }
      } else {
        // Fallback: if no due day is configured, we always show it in upcoming list as a general outstanding debt
        upcomingList.push({
          id: acc.id,
          type: 'debt',
          name: `ชำระยอดค้าง ${acc.name}`,
          amount: acc.debtAmount,
          icon: acc.icon || 'credit-card',
          color: 'bg-rose-50 text-rose-600',
          dueText: 'มียอดค้างชำระหนี้สิน',
          daysUntilDue: 0,
        });
      }
    }
  });

  upcomingList.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  if (countEl) countEl.innerText = `${upcomingList.length} รายการ`;

  if (upcomingList.length === 0) {
    const empty = createEl('div', { className: 'text-center py-6 text-slate-400' });
    empty.appendChild(createEl('i', { className: 'w-5 h-5 mx-auto mb-1 opacity-50', attrs: { 'data-lucide': 'calendar-check-2' } }));
    empty.appendChild(createEl('p', { className: 'text-[10px]', text: 'ไม่มีค่าใช้จ่ายค้างชำระช่วงนี้' }));
    container.appendChild(empty);
    lucide?.createIcons?.();
    return;
  }

  upcomingList.forEach((item) => {
    const row = createEl('div', {
      className: 'flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 hover:bg-slate-100 transition-colors',
    });

    const left = createEl('div', { className: 'min-w-0 flex-1 flex items-center space-x-3' });
    const iconBox = createEl('div', { className: `${item.color} p-2 rounded-xl shrink-0` });
    iconBox.appendChild(createEl('i', { className: 'w-4 h-4', attrs: { 'data-lucide': item.icon } }));
    left.appendChild(iconBox);

    const textCol = createEl('div', { className: 'min-w-0' });
    textCol.appendChild(createEl('div', { className: 'text-xs font-bold text-slate-800 truncate', text: item.name }));
    textCol.appendChild(createEl('div', { className: `text-[9px] font-bold ${item.daysUntilDue < 0 ? 'text-rose-500' : 'text-slate-500'}`, text: item.dueText }));
    left.appendChild(textCol);

    const right = createEl('div', { className: 'text-right shrink-0' });
    right.appendChild(createEl('div', { className: 'text-xs font-extrabold text-rose-600', text: `฿${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }));
    
    const actionBtn = createEl('button', {
      className: 'text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-2 py-0.5 rounded-md mt-1 cursor-pointer transition-colors',
      text: item.type === 'recurring' ? 'จ่ายด่วน' : 'ชำระหนี้'
    });
    actionBtn.onclick = () => {
      if (item.type === 'recurring') {
        window.openRecurringPayModal?.(item.id);
      } else {
        const matchedAcc = accounts.find(a => a.id === item.id);
        if (matchedAcc) window.openDebtPaymentModal?.(matchedAcc);
      }
    };
    right.appendChild(actionBtn);

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });

  lucide?.createIcons?.();
}

