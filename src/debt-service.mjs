import { createEl, setText } from './dom-helpers.mjs';
import { createIcon } from './render-helpers.mjs';
import { setButtonLoading } from './button-helpers.mjs';
import { formatThaiDisplayDateTime } from './transaction-service.mjs';

const DEBT_ACCOUNT_IDS = ['credit', 'spaylater']; // สามารถเพิ่มได้ในอนาคต

let ctx = {};
let currentDebtAccount = null;
let currentAdjAccount = null;

export function initDebtUi(context) {
  ctx = context;
}

/**
 * จับคู่ transaction กับบัญชีหนี้ที่ถูกต้อง
 * รองรับทั้งข้อมูล local (มี targetAccountId) และข้อมูลจาก Sheets (ไม่มี)
 */
function resolveDebtAccountId(tx, accounts) {
  if (tx.type === 'debt_adjustment') {
    // local: targetAccountId/accountId, sheets fallback: accountName = ชื่อบัญชีหนี้
    let id = tx.targetAccountId || tx.accountId;
    if (!id) {
      const matched = accounts.find(a => a.name === tx.accountName);
      if (matched && DEBT_ACCOUNT_IDS.includes(matched.id)) id = matched.id;
    }
    return id;
  }
  if (tx.type === 'debt_payment') {
    // local: targetAccountId, sheets fallback: parse จาก categoryName "จ่ายหนี้: บัตรเครดิต"
    let id = tx.targetAccountId;
    if (!id && tx.categoryName) {
      const debtName = tx.categoryName.replace(/^จ่ายหนี้:\s*/, '');
      const matched = accounts.find(a => a.name === debtName);
      if (matched && DEBT_ACCOUNT_IDS.includes(matched.id)) id = matched.id;
    }
    return id;
  }
  // spent, income, etc: จับคู่จาก accountId/accountName ปกติ
  const matchedAccount = accounts.find(a => a.id === tx.accountId || a.name === (tx.accountName || tx.account));
  return matchedAccount ? matchedAccount.id : null;
}

export function calculateDebtBalances(txHistory, accounts) {
  // กรองบัญชีที่เป็นหนี้สิน
  const debtAccounts = accounts.filter(acc => DEBT_ACCOUNT_IDS.includes(acc.id));
  
  // สร้างออบเจ็กต์เก็บยอดหนี้ของแต่ละบัญชี
  const debtBalances = {};
  debtAccounts.forEach(acc => {
    debtBalances[acc.id] = {
      ...acc,
      debtAmount: 0
    };
  });

  // คำนวณยอดหนี้จากประวัติ
  txHistory.forEach(tx => {
    const txAccountId = resolveDebtAccountId(tx, accounts);

    if (!txAccountId) return;

    // แปลงตัวเลขให้ปลอดภัย ป้องกัน comma และค่าว่าง
    const amount = Number(String(tx.amount || 0).replace(/,/g, '')) || 0;

    // ถ้ารูดบัตร (spent) -> หนี้เพิ่ม
    if (tx.type === 'spent' && DEBT_ACCOUNT_IDS.includes(txAccountId)) {
      debtBalances[txAccountId].debtAmount += amount;
    }
    // ถ้ามีเงินคืนเข้าบัตร (income) -> หนี้ลด
    else if (tx.type === 'income' && DEBT_ACCOUNT_IDS.includes(txAccountId)) {
      debtBalances[txAccountId].debtAmount -= amount;
    }
    // ถ้าเป็นการจ่ายหนี้ (debt_payment) -> หนี้ลด
    else if (tx.type === 'debt_payment' && DEBT_ACCOUNT_IDS.includes(txAccountId)) {
      debtBalances[txAccountId].debtAmount -= amount;
    }
    // ถ้าเป็นการตั้งค่ายอดยกมา (debt_adjustment) -> เพิ่มหนี้
    else if (tx.type === 'debt_adjustment' && DEBT_ACCOUNT_IDS.includes(txAccountId)) {
      debtBalances[txAccountId].debtAmount += amount;
    }
  });

  // ป้องกันยอดหนี้ติดลบ หรือเป็น NaN
  Object.values(debtBalances).forEach(acc => {
    if (Number.isNaN(acc.debtAmount) || acc.debtAmount < 0) {
      acc.debtAmount = 0;
    }
  });

  return Object.values(debtBalances);
}

export function renderDebtPage({
  txHistory,
  accounts,
  onPayDebt,
  onAdjustDebt,
  onSpendDebt,
  doc = globalThis.document,
  lucide = globalThis.lucide
}) {
  const container = doc.getElementById('debt-list');
  const totalAmountEl = doc.getElementById('total-debt-amount');
  if (!container || !totalAmountEl) return;

  const debtBalances = calculateDebtBalances(txHistory, accounts);
  let totalDebt = 0;

  container.replaceChildren();

  debtBalances.forEach(acc => {
    totalDebt += acc.debtAmount;

    const card = createEl('div', { className: 'bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col space-y-4' });
    
    // Top row: Icon, Name, Amount
    const topRow = createEl('div', { className: 'flex items-center justify-between' });
    const leftWrap = createEl('div', { className: 'flex items-center space-x-3' });
    const iconWrap = createEl('div', { className: 'bg-indigo-50 p-2.5 rounded-2xl' });
    iconWrap.appendChild(createEl('i', { className: 'w-5 h-5 text-indigo-600', attrs: { 'data-lucide': acc.icon } }));
    leftWrap.appendChild(iconWrap);

    const profileId = ctx.currentUserProfileId();
    const settingsKey = `my_debt_settings_${profileId}`;
    const settings = JSON.parse(ctx.localStorage.getItem(settingsKey) || '{}');
    const dueDay = settings[acc.id]?.dueDay;
    let dueText = 'ค้างชำระ';
    if (dueDay === 'last') {
      dueText = 'ค้างชำระ • จ่ายทุกสิ้นเดือน';
    } else if (dueDay) {
      dueText = `ค้างชำระ • จ่ายทุกวันที่ ${dueDay}`;
    }

    const textWrap = createEl('div', {});
    textWrap.appendChild(createEl('h4', { className: 'font-extrabold text-slate-800 text-[14px]', text: acc.name }));
    textWrap.appendChild(createEl('span', { className: 'text-[10px] text-slate-400 font-bold block mt-0.5', text: dueText }));
    leftWrap.appendChild(textWrap);
    topRow.appendChild(leftWrap);

    const amountWrap = createEl('div', { className: 'text-right' });
    amountWrap.appendChild(createEl('div', { className: 'font-extrabold text-rose-600 text-lg', text: `฿${acc.debtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }));
    topRow.appendChild(amountWrap);
    
    card.appendChild(topRow);

    // Middle row: History
    const historySection = createEl('div', { className: 'pt-2 pb-1 border-t border-slate-100' });
    const historyHeader = createEl('div', { className: 'flex items-center justify-between gap-3 mb-2' });
    historyHeader.appendChild(createEl('h5', { className: 'text-[11px] font-bold text-slate-600', text: 'ประวัติรายการล่าสุด' }));
    
    // Filter history for this debt account
    const accHistory = txHistory.filter(tx => {
      const txAccountId = resolveDebtAccountId(tx, accounts);
      return txAccountId === acc.id && ['spent', 'debt_payment', 'debt_adjustment', 'income'].includes(tx.type);
    }).slice(0, 8);

    historyHeader.appendChild(createEl('span', {
      className: 'inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500',
      text: `${accHistory.length} รายการ`,
    }));
    historySection.appendChild(historyHeader);

    if (accHistory.length === 0) {
      historySection.appendChild(createEl('div', {
        className: 'rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-[11px] text-slate-400',
        text: 'ไม่มีประวัติรายการ',
      }));
    } else {
      const histList = createEl('div', { className: 'max-h-[220px] space-y-2 overflow-y-auto pr-1' });
      accHistory.forEach(tx => {
        const hItem = createEl('div', { className: 'flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-[11px]' });
        
        const hLeft = createEl('div', { className: 'min-w-0 flex-1' });
        const hMeta = createEl('div', { className: 'mb-1.5 flex items-center gap-2' });
        let badgeClass = '';
        let typeName = '';
        if (tx.type === 'spent') { badgeClass = 'bg-rose-100 text-rose-600'; typeName = 'รูดบัตร'; }
        else if (tx.type === 'income') { badgeClass = 'bg-emerald-100 text-emerald-600'; typeName = 'เงินคืน'; }
        else if (tx.type === 'debt_payment') { badgeClass = 'bg-emerald-100 text-emerald-600'; typeName = 'จ่ายหนี้'; }
        else if (tx.type === 'debt_adjustment') { badgeClass = 'bg-slate-100 text-slate-600'; typeName = 'ยอดยกมา'; }

        hMeta.appendChild(createEl('span', { className: `inline-flex items-center rounded-full px-2 py-1 ${badgeClass} font-bold text-[9px]`, text: typeName }));
        hMeta.appendChild(createEl('span', {
          className: 'truncate text-[10px] font-medium text-slate-400',
          text: tx.date || '-',
        }));
        hLeft.appendChild(hMeta);
        hLeft.appendChild(createEl('div', {
          className: 'truncate text-[11px] font-semibold text-slate-700',
          text: tx.categoryName || '-',
        }));
        
        const hRight = createEl('div', { className: 'shrink-0 pt-0.5 text-right flex items-center space-x-2' });
        const amtWrap = createEl('div');
        let amtStr = parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (['spent', 'debt_adjustment'].includes(tx.type)) {
          amtWrap.appendChild(createEl('span', { className: 'block text-[11px] font-bold tabular-nums text-rose-500', text: `+฿${amtStr}` }));
        } else {
          amtWrap.appendChild(createEl('span', { className: 'block text-[11px] font-bold tabular-nums text-emerald-500', text: `-฿${amtStr}` }));
        }
        hRight.appendChild(amtWrap);

        const deleteBtn = createEl('button', {
          className: 'p-1 bg-slate-200/50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors active:scale-90',
          attrs: { title: 'ลบรายการ' }
        });
        deleteBtn.appendChild(createIcon('trash-2', 'w-3 h-3'));
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (globalThis.window?.deleteTransaction) {
                globalThis.window.deleteTransaction(tx.id);
            }
        };
        hRight.appendChild(deleteBtn);

        hItem.appendChild(hLeft);
        hItem.appendChild(hRight);
        histList.appendChild(hItem);
      });
      historySection.appendChild(histList);
    }

    card.appendChild(historySection);

    // Bottom row: Actions
    const actions = createEl('div', { className: 'grid grid-cols-3 gap-2 pt-3 border-t border-slate-100' });
    
    const adjustBtn = createEl('button', {
      className: 'flex flex-col items-center justify-center py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors font-bold text-[10px]',
    });
    adjustBtn.onclick = () => onAdjustDebt?.(acc);
    adjustBtn.appendChild(createEl('i', { className: 'w-4 h-4 mb-1', attrs: { 'data-lucide': 'settings-2' } }));
    adjustBtn.appendChild(createEl('span', { text: 'ตั้งยอดยกมา' }));

    const spendBtn = createEl('button', {
      className: 'flex flex-col items-center justify-center py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer hover:bg-rose-100 transition-colors font-bold text-[10px]',
    });
    spendBtn.onclick = () => onSpendDebt?.(acc);
    spendBtn.appendChild(createEl('i', { className: 'w-4 h-4 mb-1', attrs: { 'data-lucide': 'shopping-bag' } }));
    spendBtn.appendChild(createEl('span', { text: 'รูดบัตร' }));
    
    const payBtn = createEl('button', {
      className: 'flex flex-col items-center justify-center py-2 rounded-xl bg-indigo-600 text-white shadow-md cursor-pointer hover:bg-indigo-700 transition-colors font-bold text-[10px]',
    });
    payBtn.onclick = () => onPayDebt?.(acc);
    payBtn.appendChild(createEl('i', { className: 'w-4 h-4 mb-1', attrs: { 'data-lucide': 'check-circle' } }));
    payBtn.appendChild(createEl('span', { text: 'จ่ายหนี้' }));

    actions.appendChild(adjustBtn);
    actions.appendChild(spendBtn);
    actions.appendChild(payBtn);
    
    card.appendChild(actions);
    container.appendChild(card);
  });

  setText(totalAmountEl, `฿${totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  lucide?.createIcons?.();
}

export function openDebtPaymentModal(account, doc = globalThis.document) {
  currentDebtAccount = account;
  doc.getElementById('debt-payment-account-name').innerText = account.name;
  const amountInput = doc.getElementById('debt-payment-amount');
  amountInput.value = account.debtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  // Populate sources (exclude debt accounts)
  const sourceSelect = doc.getElementById('debt-payment-source');
  sourceSelect.innerHTML = '';
  const sourceAccounts = ctx.accounts.filter(a => a.id !== 'credit' && a.id !== 'spaylater');
  sourceAccounts.forEach(a => {
      const option = doc.createElement('option');
      option.value = a.id;
      option.innerText = a.name;
      sourceSelect.appendChild(option);
  });

  doc.getElementById('debt-payment-modal').classList.remove('hidden');
}

export function closeDebtPaymentModal(doc = globalThis.document) {
  currentDebtAccount = null;
  doc.getElementById('debt-payment-modal').classList.add('hidden');
}

export async function submitDebtPayment(doc = globalThis.document) {
  if (!currentDebtAccount) return;
  
  const amountStr = doc.getElementById('debt-payment-amount').value.replace(/,/g, '');
  const amount = parseFloat(amountStr);
  
  if (isNaN(amount) || amount <= 0) {
      ctx.showToast('กรุณาระบุยอดที่ถูกต้อง', 'error');
      return;
  }
  if (amount > currentDebtAccount.debtAmount) {
      ctx.showToast('ไม่สามารถจ่ายเกินยอดค้างชำระได้', 'error');
      return;
  }

  const sourceAccountId = doc.getElementById('debt-payment-source').value;
  const sourceAccount = ctx.accounts.find(a => a.id === sourceAccountId);

  const btn = doc.getElementById('btn-submit-debt-payment');
  const loadingState = setButtonLoading(btn, { label: 'กำลังบันทึก...', iconClass: 'w-4 h-4' });

  const now = new Date();
  const isoDate = now.toISOString().slice(0, 16);
  const dateStr = formatThaiDisplayDateTime(now);

  const transactionRecord = {
      sheetName: ctx.currentUserProfileId() + '_History',
      action: 'add',
      id: Date.now(),
      type: 'debt_payment',
      amount: amount,
      categoryName: 'จ่ายหนี้: ' + currentDebtAccount.name,
      accountName: sourceAccount.name,
      date: dateStr,
      isoDate: isoDate,
      targetAccountId: currentDebtAccount.id, // custom field for internal use
      desc: ''
  };

  const uiRecord = {
      ...transactionRecord,
      categoryIcon: currentDebtAccount.icon, // use target debt icon
      accountIcon: sourceAccount.icon,
  };

  ctx.appState.txHistory.push(uiRecord);
  ctx.appState.txHistory.sort((a, b) => b.id - a.id);
  ctx.localStorage.setItem(ctx.getHistoryKey(), JSON.stringify(ctx.appState.txHistory));

  if (ctx.syncQueueInstance()) {
      ctx.syncQueueInstance().enqueue(transactionRecord);
      ctx.showToast('บันทึกจ่ายหนี้สำเร็จ', 'success');
  } else {
      ctx.apiClient.postJson(transactionRecord, { expectJson: false })
          .then(() => ctx.showToast('บันทึกจ่ายหนี้สำเร็จ', 'success'))
          .catch(() => ctx.showToast('บันทึกในเครื่องสำเร็จ แต่เชื่อมต่อชีทล้มเหลว', 'error'));
  }

  ctx.updateDashboard();
  ctx.renderDebt();
  if (ctx.appState.currentPage === 'history') ctx.renderHistory();

  closeDebtPaymentModal(doc);
  loadingState?.restore();
}

export function openDebtAdjustmentModal(account, doc = globalThis.document) {
  currentAdjAccount = account;
  doc.getElementById('debt-adj-account-name').innerText = account.name;
  doc.getElementById('debt-adj-amount').value = ''; // Reset input

  // Load dueDay if configured
  const profileId = ctx.currentUserProfileId();
  const settingsKey = `my_debt_settings_${profileId}`;
  const settings = JSON.parse(ctx.localStorage.getItem(settingsKey) || '{}');
  const currentDueDay = settings[account.id]?.dueDay || '';
  const dueDayInput = doc.getElementById('debt-adj-due-day');
  if (dueDayInput) dueDayInput.value = currentDueDay;

  doc.getElementById('debt-adjustment-modal').classList.remove('hidden');
}

export function closeDebtAdjustmentModal(doc = globalThis.document) {
  currentAdjAccount = null;
  doc.getElementById('debt-adjustment-modal').classList.add('hidden');
}

export async function submitDebtAdjustment(doc = globalThis.document) {
  if (!currentAdjAccount) return;
  
  const amountStr = doc.getElementById('debt-adj-amount').value.replace(/,/g, '');
  const amount = parseFloat(amountStr) || 0;

  const dueDayInput = doc.getElementById('debt-adj-due-day');
  const dueDayVal = dueDayInput ? dueDayInput.value : '';
  if (dueDayVal !== '' && dueDayVal !== 'last') {
      const num = parseInt(dueDayVal, 10);
      if (isNaN(num) || num < 1 || num > 31) {
          ctx.showToast('กรุณาระบุวันที่ 1-31 เท่านั้น', 'error');
          return;
      }
  }

  // ต้องมีอย่างน้อย 1 อย่าง: ยอดเงิน หรือ วันครบกำหนด
  if (amount <= 0 && dueDayVal === '') {
      ctx.showToast('กรุณาระบุยอดเงิน หรือ วันครบกำหนดชำระ', 'error');
      return;
  }

  const btn = doc.getElementById('btn-submit-debt-adj');
  const loadingState = setButtonLoading(btn, { label: 'กำลังบันทึก...', iconClass: 'w-4 h-4' });

  // Save dueDay to settings
  const profileId = ctx.currentUserProfileId();
  const settingsKey = `my_debt_settings_${profileId}`;
  const settings = JSON.parse(ctx.localStorage.getItem(settingsKey) || '{}');
  if (dueDayVal !== '') {
      settings[currentAdjAccount.id] = { dueDay: dueDayVal };
  } else {
      delete settings[currentAdjAccount.id];
  }
  ctx.localStorage.setItem(settingsKey, JSON.stringify(settings));

  // สร้าง transaction เฉพาะเมื่อมียอดเงิน > 0
  if (amount > 0) {
      const now = new Date();
      const isoDate = now.toISOString().slice(0, 16);
      const dateStr = formatThaiDisplayDateTime(now);

      const transactionRecord = {
          sheetName: ctx.currentUserProfileId() + '_History',
          action: 'add',
          id: Date.now(),
          type: 'debt_adjustment',
          amount: amount,
          categoryName: 'ตั้งค่ายอดยกมา: ' + currentAdjAccount.name,
          accountName: currentAdjAccount.name,
          date: dateStr,
          isoDate: isoDate,
          targetAccountId: currentAdjAccount.id,
          accountId: currentAdjAccount.id,
          desc: ''
      };

      const uiRecord = {
          ...transactionRecord,
          categoryIcon: 'settings-2',
          accountIcon: currentAdjAccount.icon,
      };

      ctx.appState.txHistory.push(uiRecord);
      ctx.appState.txHistory.sort((a, b) => b.id - a.id);
      ctx.localStorage.setItem(ctx.getHistoryKey(), JSON.stringify(ctx.appState.txHistory));

      if (ctx.syncQueueInstance()) {
          ctx.syncQueueInstance().enqueue(transactionRecord);
      } else {
          ctx.apiClient.postJson(transactionRecord, { expectJson: false }).catch(() => {});
      }
  }

  ctx.showToast(amount > 0 ? 'บันทึกยอดยกมาสำเร็จ' : 'บันทึกการตั้งค่าสำเร็จ', 'success');
  ctx.updateDashboard();
  ctx.renderDebt();
  if (ctx.appState.currentPage === 'history') ctx.renderHistory();

  closeDebtAdjustmentModal(doc);
  loadingState?.restore();
}
