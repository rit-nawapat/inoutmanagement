export function buildTransactionRecord({
  editModeId,
  currentType,
  selectedCategory,
  selectedAccount,
  selectedBudgetGroupId,
  budgetGroups,
  currentScannedBarcode,
  currentSlipRefNo,
  amount,
  inputDate,
  currentUserProfileId,
  matchedCategory,
  matchedAccount,
}) {
  const matchedBudgetGroup = (budgetGroups || []).find(
    (g) => g.id.toString() === selectedBudgetGroupId?.toString()
  );

  const transactionRecord = {
    id: editModeId || Date.now(),
    type: currentType,
    categoryName: matchedCategory ? matchedCategory.name : 'อื่นๆ',
    accountName: matchedAccount ? matchedAccount.name : 'เงินสด',
    amount,
    barcodeNote: currentScannedBarcode,
    slipRefNo: currentSlipRefNo,
    date: formatThaiDisplayDateTime(inputDate),
    isoDate: inputDate.toISOString().slice(0, 16),
    budgetGroupId: matchedBudgetGroup ? matchedBudgetGroup.id : null,
    budgetGroupName: matchedBudgetGroup ? matchedBudgetGroup.name : null,
    budgetGroupType: matchedBudgetGroup ? (matchedBudgetGroup.parentId ? 'child' : 'root') : null,
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

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function formatThaiDisplayDateTime(date, locale = 'th-TH', timeZone = 'Asia/Bangkok') {
  return date.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone,
  }).replace(',', '');
}

function formatToThai(date, locale = 'th-TH') {
  try {
    const formatted = date.toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatted.replace(',', '');
  } catch (e) {
    return date.toLocaleString(locale);
  }
}

export function formatTransactionDisplayDate(tx, locale = 'th-TH') {
  let dateStr = tx?.date ? String(tx.date) : '';
  
  const hasGmt = dateStr.includes('GMT') || dateStr.includes('UTC');
  const hasAlpha = /[a-zA-Z]/.test(dateStr);
  
  if (dateStr && (hasGmt || hasAlpha)) {
    let parsed = new Date(dateStr);
    if (isValidDate(parsed)) {
      if (parsed.getFullYear() > 2400) {
        parsed.setFullYear(parsed.getFullYear() - 543);
      }
      return formatToThai(parsed, locale);
    }
  }

  if (tx?.isoDate) {
    const parsed = new Date(tx.isoDate);
    if (isValidDate(parsed)) {
      return formatToThai(parsed, locale);
    }
  }

  if (tx?.id) {
    const parsed = new Date(Number(tx.id));
    if (isValidDate(parsed)) {
      return formatToThai(parsed, locale);
    }
  }

  if (dateStr) {
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (match) {
      const day = match[1];
      const monthIdx = parseInt(match[2], 10) - 1;
      const year = match[3];
      const hour = match[4];
      const minute = match[5];
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${day} ${thaiMonths[monthIdx]} ${year} ${hour}:${minute}`;
    }
    return dateStr;
  }

  return '';
}

function findRecurringSource(tx, recurringItems = []) {
  if (!tx) return null;

  return recurringItems.find((item) => {
    if (tx.recurringSourceId && String(item.id) === String(tx.recurringSourceId)) return true;
    return tx.categoryName && item.name === tx.categoryName;
  }) || null;
}

function findCategory(tx, categories = {}, recurringItems = []) {
  const allCategories = [
    ...(categories.spent || []),
    ...(categories.income || []),
  ];
  const recurringSource = findRecurringSource(tx, recurringItems);
  const categoryRef = tx?.categoryId || recurringSource?.categoryId || recurringSource?.category;

  return allCategories.find((cat) => cat.id === categoryRef)
    || allCategories.find((cat) => cat.name === tx?.categoryName)
    || null;
}

function findAccount(tx, accounts = [], recurringItems = []) {
  const recurringSource = findRecurringSource(tx, recurringItems);
  const accountRef = tx?.accountId || recurringSource?.accountId || recurringSource?.account;

  return accounts.find((account) => account.id === accountRef)
    || accounts.find((account) => account.name === tx?.accountName)
    || null;
}

export function normalizeTransactionRecord(tx, {
  categories = {},
  accounts = [],
  recurringItems = [],
  locale = 'th-TH',
} = {}) {
  const matchedCategory = findCategory(tx, categories, recurringItems);
  const matchedAccount = findAccount(tx, accounts, recurringItems);

  let categoryIcon = tx?.categoryIcon || matchedCategory?.icon || 'help-circle';
  if (tx.type === 'debt_adjustment') {
    categoryIcon = 'settings-2';
  } else if (tx.type === 'debt_payment') {
    categoryIcon = 'credit-card';
  }

  return {
    ...tx,
    categoryIcon,
    accountIcon: tx?.accountIcon || matchedAccount?.icon || 'banknote',
    accountName: tx?.accountName || matchedAccount?.name || 'เงินสด',
    date: formatTransactionDisplayDate(tx, locale),
  };
}

export function normalizeTransactionHistory(txHistory = [], options = {}) {
  return txHistory.map((tx) => normalizeTransactionRecord(tx, options));
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
    selectedBudgetGroupId: tx.budgetGroupId || '',
    expression: tx.amount.toString(),
    currentSlipRefNo: tx.slipRefNo || '',
    isoDate: tx.isoDate || new Date().toISOString().slice(0, 16),
  };
}
