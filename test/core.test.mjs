import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  calculateExpression,
  checkDuplicateSlipInHistory,
  getHistoryStorageKey,
  getRecurringStorageKey,
  loadRecurringItems,
  loadCurrentProfileId,
  loadSavedProfiles,
  parseDateTimeFromOCR,
  parseRefNoFromOCR,
  saveCurrentProfileId,
  saveSavedProfiles,
} from '../src/core.mjs';
import { appState, resetAppState } from '../src/app-state.mjs';
import { uiState, resetUiState } from '../src/ui-state.mjs';
import { guessAccountForCategory, guessCategoryFromText } from '../src/catalog-service.mjs';
import { setButtonLoading } from '../src/button-helpers.mjs';
import { analyzeSlipText } from '../src/ocr-service.mjs';
import { backspaceCalculator, calculateCalculator, clearCalculator, handleCalculatorKeyboardInput, inputDigitCalculator, inputOperatorCalculator, quickPriceCalculator, resetCalculatorScanState } from '../src/calculator-service.mjs';
import { applyTransactionSave, buildEditDraft, buildTransactionRecord, formatThaiDisplayDateTime, normalizeTransactionRecord } from '../src/transaction-service.mjs';
import { createEl, sanitizeIconName, setText } from '../src/dom-helpers.mjs';
import { createHistoryRow, createRecurringRow } from '../src/render-helpers.mjs';
import { renderHistory, renderRecurringList, renderRecurringPreview, updateRecurringSummary } from '../src/ledger-service.mjs';
import { calculateRemainingBalances } from '../src/budget-service.mjs';
import { saveTransactionFlow, syncDataFromSheetFlow } from '../src/flow-service.mjs';
import { resolveConfirmDialog } from '../src/confirm-dialog.mjs';
import { cancelRecurringPayment, payRecurringItem } from '../src/recurring-service.mjs';
import { SyncQueueManager } from '../src/sync-queue.mjs';

test('app declares recurring handlers before exposing them globally', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const handlers = [
    'openRecurringModal',
    'closeRecurringModal',
    'saveRecurringItem',
    'executeDeleteRecurring',
    'deleteRecurringItem',
    'toggleFavRecurring',
    'payRecurringItem',
  ];

  for (const handler of handlers) {
    assert.match(source, new RegExp(`function\\s+${handler}\\s*\\(`));
  }
});

test('profile selection includes a dedicated loading block and app toggles it during init', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(htmlSource, /id="profile-loading-block"/);
  assert.match(htmlSource, /id="profile-sync-indicator"/);
  assert.match(htmlSource, /ตรวจสอบล่าสุด/);
  assert.match(htmlSource, /absolute bottom-6 right-4/);
  assert.match(htmlSource, /animate-spin/);
  assert.match(appSource, /function\s+setProfileSelectionLoading\s*\(\s*isLoading\s*\)/);
  assert.match(appSource, /const hasProfiles = allProfiles\.length > 0/);
  assert.match(appSource, /profileSyncIndicatorText/);
  assert.match(appSource, /loadingBlock\)\s+loadingBlock\.classList\.toggle\('hidden', !isLoading \|\| hasProfiles\)/);
  assert.match(appSource, /profileGrid\)\s+profileGrid\.classList\.toggle\('hidden', isLoading && !hasProfiles\)/);
  assert.match(appSource, /profileSyncIndicator\)\s+profileSyncIndicator\.classList\.toggle\('hidden', !isLoading \|\| !hasProfiles\)/);
  assert.match(appSource, /setText\(profileSyncIndicatorText, isLoading \? 'ตรวจสอบล่าสุด' : ''\)/);
  assert.match(appSource, /setProfileSelectionLoading\(true\)/);
  assert.match(appSource, /finally\s*\{[\s\S]*setProfileSelectionLoading\(false\)/);
});

test('date writers use the shared Thai display formatter', () => {
  const debtSource = readFileSync(new URL('../src/debt-service.mjs', import.meta.url), 'utf8');
  const recurringSource = readFileSync(new URL('../src/recurring-service.mjs', import.meta.url), 'utf8');

  assert.match(debtSource, /formatThaiDisplayDateTime\(/);
  assert.match(recurringSource, /formatThaiDisplayDateTime\(/);
});

test('debt history UI uses a bounded scroll panel with richer row structure', () => {
  const debtSource = readFileSync(new URL('../src/debt-service.mjs', import.meta.url), 'utf8');

  assert.match(debtSource, /max-h-\[220px\]/);
  assert.match(debtSource, /overflow-y-auto/);
  assert.match(debtSource, /ประวัติรายการล่าสุด/);
  assert.match(debtSource, /slice\(0,\s*8\)/);
});

test('mobile add page uses a compact one-page layout and removes OCR controls', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(htmlSource, /min-h-\[100dvh\] overflow-x-hidden md:h-\[100dvh\] md:overflow-hidden/);
  assert.match(htmlSource, /id="tx-budget-summary-row"/);
  assert.match(htmlSource, /id="account-selector-modal"/);
  assert.match(htmlSource, /id="budget-selector-modal"/);
  assert.match(htmlSource, /md:hidden/);
  assert.match(htmlSource, /hidden md:block/);
  assert.match(htmlSource, /เลือกวันเวลา/);
  assert.match(htmlSource, /เลือกกระเป๋า/);
  assert.match(htmlSource, /id="account-grid"/);
  assert.match(htmlSource, /id="tx-budget-group-grid"/);
  assert.match(htmlSource, /grid-cols-3/);
  assert.match(htmlSource, /flex flex-wrap gap-/);
  assert.match(htmlSource, /id="tx-date-compact-row"/);
  assert.match(htmlSource, /id="mobile-app-shell"/);
  assert.match(htmlSource, /id="mobile-app-header"/);
  assert.match(htmlSource, /id="category-grid-scroll"/);
  assert.match(htmlSource, /id="account-grid-scroll"/);
  assert.match(htmlSource, /id="tx-budget-group-grid-scroll"/);
  assert.match(htmlSource, /option-block-stretch/);
  assert.match(
    htmlSource,
    /<[^>]*(?:id="(?:category-grid-scroll|account-grid-scroll|tx-budget-group-grid-scroll)"[^>]*class="[^"]*\bmobile-option-scroll\b[^"]*\bno-scrollbar\b[^"]*"|class="[^"]*\bmobile-option-scroll\b[^"]*\bno-scrollbar\b[^"]*"[^>]*id="(?:category-grid-scroll|account-grid-scroll|tx-budget-group-grid-scroll)")[^>]*>/
  );
  assert.match(htmlSource, /min-h-\[38px\]/);
  assert.doesNotMatch(htmlSource, /id="tab-acc-money"/);
  assert.doesNotMatch(htmlSource, /ข้อมูลประกอบรายการ/);
  assert.doesNotMatch(htmlSource, /id="ocr-file-input"/);
  assert.doesNotMatch(htmlSource, /processSlipOCR\(this\)/);
  assert.match(appSource, /function\s+scrollMainContentToTop\s*\(/);
  assert.match(appSource, /function\s+syncViewportMetrics\s*\(/);
  assert.match(appSource, /--app-height/);
  assert.match(appSource, /--content-height/);
  assert.match(appSource, /visualViewport/);
  assert.match(appSource, /classList\.toggle\('is-add-page', pageId === 'add'\)/);
  assert.match(appSource, /function\s+openAccountSelectorModal\s*\(/);
  assert.match(appSource, /function\s+openBudgetSelectorModal\s*\(/);
  assert.match(appSource, /function\s+updateCompactSelectionSummary\s*\(/);
  assert.match(appSource, /if\s*\(pageId === 'add'\)\s*scrollMainContentToTop\(\)/);
  assert.doesNotMatch(appSource, /window\.processSlipOCR\s*=/);
  assert.doesNotMatch(appSource, /function\s+toggleAddDetails\s*\(/);
});

test('mobile viewport CSS locks the add page to measured visual viewport height', () => {
  const cssSource = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(cssSource, /--app-height:\s*100dvh/);
  assert.match(cssSource, /--content-height:\s*calc\(var\(--app-height\) - 128px\)/);
  assert.match(cssSource, /#mobile-app-shell/);
  assert.match(cssSource, /height:\s*var\(--app-height\)/);
  assert.match(cssSource, /#main-content-scroll/);
  assert.match(cssSource, /height:\s*var\(--content-height\)/);
  assert.match(cssSource, /body\.is-add-page #main-content-scroll/);
  assert.match(cssSource, /body:not\(\.is-add-page\) #main-content-scroll/);
  assert.match(cssSource, /--mobile-save-height:\s*48px/);
  assert.match(cssSource, /--add-content-height/);
  assert.match(cssSource, /body\.is-add-page #btn-save/);
  assert.doesNotMatch(cssSource, /body\.is-add-page #btn-save\s*\{[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /height:\s*var\(--mobile-save-height\)/);
  assert.match(cssSource, /flex:\s*0 0 var\(--mobile-save-height\)/);
  assert.match(cssSource, /body\.is-add-page #tx-options-card/);
  assert.match(cssSource, /max-height:\s*none/);
  assert.match(cssSource, /#page-add/);
  assert.match(cssSource, /height:\s*var\(--add-content-height\)/);
  assert.match(cssSource, /#page-add\s+#?[^{}]*\{/);
  assert.match(cssSource, /#tx-form-body\s*\{[^}]*overflow:\s*visible/);
  assert.doesNotMatch(cssSource, /#tx-form-body\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-option-scroll\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-option-scroll\s*\{[\s\S]*-webkit-overflow-scrolling:\s*touch/);
  assert.match(cssSource, /\.mobile-option-scroll\s*\{[\s\S]*min-height:\s*0/);
  assert.match(cssSource, /\.option-block\s*\{[\s\S]*display:\s*flex/);
  assert.match(cssSource, /\.option-block-stretch\s*\{[\s\S]*flex:\s*1 1 0/);
  assert.match(cssSource, /#category-grid-scroll/);
  assert.match(cssSource, /#account-grid-scroll/);
  assert.match(cssSource, /#tx-budget-group-grid-scroll/);
});

test('desktop add page uses a dedicated two-column layout', () => {
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(htmlSource, /lg:grid lg:grid-cols-\[minmax\(380px,440px\)_minmax\(0,1fr\)\]/);
  assert.match(htmlSource, /lg:sticky lg:top-0/);
  assert.match(htmlSource, /lg:flex-wrap/);
});

test('getRecurringStorageKey namespaces recurring items by profile id', () => {
  assert.equal(getRecurringStorageKey('user_123'), 'my_recurring_list_user_123');
});

test('loadRecurringItems migrates legacy recurring items into the namespaced key', () => {
  const store = new Map();
  store.set('my_recurring_list', JSON.stringify([{ id: 1, name: 'legacy item' }]));

  const storage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };

  const items = loadRecurringItems(storage, 'user_123');

  assert.deepEqual(items, [{ id: 1, name: 'legacy item' }]);
  assert.equal(storage.getItem('my_recurring_list'), null);
  assert.equal(storage.getItem('my_recurring_list_user_123'), JSON.stringify(items));
});

test('calculateExpression respects arithmetic precedence', () => {
  assert.equal(calculateExpression('10+5*2'), '20');
});

test('calculateExpression rejects unsafe expressions', () => {
  assert.throws(() => calculateExpression('alert(1)'), /Invalid expression/);
});

test('parseDateTimeFromOCR parses Thai Buddhist year dates', () => {
  assert.equal(
    parseDateTimeFromOCR('วันที่ 2 มิ.ย. 2569 เวลา 08:45'),
    '2026-06-02T08:45'
  );
});

test('parseRefNoFromOCR extracts reference numbers', () => {
  assert.equal(
    parseRefNoFromOCR('เลขที่อ้างอิง 1234ABCD5678'),
    '1234ABCD5678'
  );
});

test('checkDuplicateSlipInHistory returns the matching transaction', () => {
  const history = [
    { id: 1, slipRefNo: 'AAA111' },
    { id: 2, slipRefNo: 'BBB222' },
  ];

  assert.deepEqual(checkDuplicateSlipInHistory(history, 'BBB222'), history[1]);
  assert.equal(checkDuplicateSlipInHistory(history, 'CCC333'), undefined);
});

test('getHistoryStorageKey namespaces transaction history by profile id', () => {
  assert.equal(getHistoryStorageKey('user_123'), 'my_tx_history_user_123');
});

test('profile storage helpers read and write the profile keys', () => {
  const store = new Map();
  const storage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };

  saveSavedProfiles(storage, [{ id: 'user_1', name: 'A' }]);
  saveCurrentProfileId(storage, 'user_1');

  assert.deepEqual(loadSavedProfiles(storage), [{ id: 'user_1', name: 'A' }]);
  assert.equal(loadCurrentProfileId(storage), 'user_1');

  saveCurrentProfileId(storage, null);
  assert.equal(loadCurrentProfileId(storage), null);
});

test('sanitizeIconName rejects unsafe icon names', () => {
  assert.equal(sanitizeIconName('check-circle'), 'check-circle');
  assert.equal(sanitizeIconName('alert" onclick="x'), 'help-circle');
});

test('render helpers build rows with text nodes instead of interpolated html', () => {
  const previousDocument = globalThis.document;

  class FakeNode {
    constructor(tagName = '#text') {
      this.tagName = tagName;
      this.children = [];
      this.attributes = {};
      this.className = '';
      this.textContent = '';
      this.disabled = false;
      this.onclick = null;
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    replaceChildren(...children) {
      this.children = [...children];
    }
  }

  function collectText(node) {
    if (!node) return '';
    let text = node.textContent || '';
    for (const child of node.children || []) {
      text += collectText(child);
    }
    return text;
  }

  globalThis.document = {
    createElement(tagName) {
      return new FakeNode(tagName);
    },
    createTextNode(text) {
      const node = new FakeNode('#text');
      node.textContent = text;
      return node;
    },
  };

  try {
    const recurringRow = createRecurringRow(
      {
        id: 1,
        name: 'ค่าน้ำ',
        desc: 'ทุกสิ้นเดือน',
        amount: 500,
        category: 'บิล',
        color: 'bg-blue-100',
        icon: 'receipt',
        fav: false,
      },
      {
        isPaidThisMonth: false,
        onPay() {},
        onToggleFav() {},
        onEdit() {},
        onDelete() {},
      }
    );

    const paidRecurringRow = createRecurringRow(
      {
        id: 2,
        name: 'ค่าไฟ',
        desc: 'ทุกเดือน',
        amount: 700,
        category: 'บิล',
        color: 'bg-blue-100',
        icon: 'receipt',
        fav: false,
      },
      {
        isPaidThisMonth: true,
        onPay() {},
        onCancelPay() {},
        onToggleFav() {},
        onEdit() {},
        onDelete() {},
      }
    );

    const historyRow = createHistoryRow(
      {
        id: 2,
        type: 'spent',
        categoryIcon: 'receipt',
        categoryName: 'อาหาร',
        accountName: 'เงินสด',
        barcodeNote: 'สลิป: <script>',
        date: '2026-06-02',
        amount: 100,
      },
      {
        onEdit() {},
        onDelete() {},
      }
    );

    assert.equal(recurringRow.tagName, 'div');
    assert.equal(paidRecurringRow.tagName, 'div');
    assert.equal(historyRow.tagName, 'div');
    assert.ok(recurringRow.children.length >= 2);
    assert.ok(!String(paidRecurringRow.className).includes('opacity-60'));
    assert.match(collectText(paidRecurringRow), /ยกเลิกจ่าย/);
    assert.match(collectText(historyRow), /เงินสด/);
    assert.match(collectText(historyRow), /สลิป: <script>/);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('ledger renderers can target alternate containers for combined history page', () => {
  const previousDocument = globalThis.document;
  const previousLucide = globalThis.lucide;

  class FakeNode {
    constructor(tagName = 'div') {
      this.tagName = tagName;
      this.children = [];
      this.attributes = {};
      this.className = '';
      this.textContent = '';
      this.innerText = '';
      this.disabled = false;
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    replaceChildren(...children) {
      this.children = [...children];
    }
  }

  const elements = new Map();
  const createContainer = (id) => {
    const node = new FakeNode('div');
    elements.set(id, node);
    return node;
  };

  const recurringContainer = createContainer('recurring-preview-history');
  const historyContainer = createContainer('history-list');
  const summaryIncome = new FakeNode('span');
  const summarySpent = new FakeNode('span');
  const summaryRemain = new FakeNode('span');
  const historyCount = new FakeNode('span');
  elements.set('req-dash-income-history', summaryIncome);
  elements.set('req-dash-spent-history', summarySpent);
  elements.set('req-dash-remain-history', summaryRemain);
  elements.set('history-count', historyCount);

  globalThis.document = {
    createElement(tagName) {
      return new FakeNode(tagName);
    },
    createTextNode(text) {
      const node = new FakeNode('#text');
      node.textContent = text;
      return node;
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
  };
  globalThis.lucide = { createIcons() {} };

  try {
    const storage = {
      getItem(key) {
        if (key === 'my_recurring_list_user_1') {
          return JSON.stringify([{ id: 1, name: 'ค่าไฟ', amount: 500, desc: 'ทุกสิ้นเดือน', categoryId: 'bills', accountId: 'cash', lastPaidMonth: '' }]);
        }
        return null;
      },
      setItem() {},
    };

    updateRecurringSummary(
      [{ type: 'income', amount: 1000, isoDate: '2026-06-03T10:00' }],
      storage,
      'user_1',
      globalThis.document,
      {
        incomeId: 'req-dash-income-history',
        spentId: 'req-dash-spent-history',
        remainId: 'req-dash-remain-history',
      }
    );

    renderRecurringPreview({
      storage,
      profileId: 'user_1',
      doc: globalThis.document,
      lucide: globalThis.lucide,
      containerId: 'recurring-preview-history',
    });

    renderHistory({
      txHistory: [{ id: 10, type: 'spent', amount: 100, categoryIcon: 'receipt', categoryName: 'อาหาร', accountName: 'เงินสด', date: '2026-06-03' }],
      onEdit() {},
      onDelete() {},
      doc: globalThis.document,
      lucide: globalThis.lucide,
      containerId: 'history-list',
      countId: 'history-count',
    });

    assert.equal(summaryIncome.innerText, '฿1,000');
    assert.equal(summarySpent.innerText, '฿500');
    assert.equal(summaryRemain.innerText, '฿500');
    assert.ok(recurringContainer.children.length > 0);
    assert.ok(historyContainer.children.length > 0);
    assert.equal(historyCount.innerText, '1 รายการ');
  } finally {
    globalThis.document = previousDocument;
    globalThis.lucide = previousLucide;
  }
});

test('resetAppState restores the default state bucket', () => {
  appState.currentPage = 'history';
  appState.currentType = 'income';
  appState.txHistory = [{ id: 1 }];

  resetAppState();

  assert.equal(appState.currentPage, 'add');
  assert.equal(appState.currentType, 'spent');
  assert.deepEqual(appState.txHistory, []);
});

test('resetUiState restores calculator and selection state', () => {
  uiState.expression = '42';
  uiState.isEvaluated = true;
  uiState.selectedCategory = 'travel';
  uiState.selectedAccount = 'credit';
  uiState.editModeId = 99;
  uiState.currentSlipRefNo = 'ABC123';
  uiState.currentScannedBarcode = 'sku';

  resetUiState();

  assert.equal(uiState.expression, '0');
  assert.equal(uiState.isEvaluated, false);
  assert.equal(uiState.selectedCategory, 'food');
  assert.equal(uiState.selectedAccount, 'cash');
  assert.equal(uiState.editModeId, null);
  assert.equal(uiState.currentSlipRefNo, '');
  assert.equal(uiState.currentScannedBarcode, '');
});

test('guessCategoryFromText maps common OCR phrases to a category', () => {
  assert.equal(guessCategoryFromText('ชำระค่าไฟฟ้าและน้ำประปา'), 'electricity');
  assert.equal(guessCategoryFromText('beer cold 1 bottle'), 'beverage');
});

test('guessAccountForCategory prefers domain-specific defaults', () => {
  assert.equal(guessAccountForCategory('bills', []), 'promptpay');
  assert.equal(guessAccountForCategory('food', []), 'qrscan');
  assert.equal(guessAccountForCategory('travel', []), 'credit');
});

test('buildTransactionRecord composes history payloads consistently', () => {
  const inputDate = new Date('2026-06-03T12:34:00.000Z');
  const { transactionRecord, uiRecord } = buildTransactionRecord({
    editModeId: 7,
    currentType: 'spent',
    selectedCategory: 'food',
    selectedAccount: 'cash',
    currentScannedBarcode: 'สลิปโอนเงิน (OCR)',
    currentSlipRefNo: 'REF123',
    amount: 120.5,
    inputDate,
    currentUserProfileId: 'user_1',
    matchedCategory: { name: 'อาหาร', icon: 'utensils' },
    matchedAccount: { name: 'เงินสด', icon: 'banknote' },
  });

  assert.equal(transactionRecord.id, 7);
  assert.equal(transactionRecord.type, 'spent');
  assert.equal(transactionRecord.sheetName, 'user_1_History');
  assert.equal(transactionRecord.slipRefNo, 'REF123');
  assert.equal(transactionRecord.isoDate, '2026-06-03T12:34');
  assert.equal(transactionRecord.date, '3 มิ.ย. 2569 19:34:00');
  assert.equal(uiRecord.categoryIcon, 'utensils');
  assert.equal(uiRecord.accountIcon, 'banknote');
});

test('formatThaiDisplayDateTime returns a consistent Thai display string', () => {
  const formatted = formatThaiDisplayDateTime(new Date('2026-06-03T16:35:02.118Z'));
  assert.equal(formatted, '3 มิ.ย. 2569 23:35:02');
});

test('applyTransactionSave updates existing rows or prepends new ones', () => {
  const existing = [{ id: 1, amount: 10 }, { id: 2, amount: 20 }];
  assert.deepEqual(applyTransactionSave(existing, { id: 2, amount: 99 }, 2), [{ id: 1, amount: 10 }, { id: 2, amount: 99 }]);
  assert.deepEqual(applyTransactionSave(existing, { id: 3, amount: 30 }, null), [{ id: 3, amount: 30 }, { id: 1, amount: 10 }, { id: 2, amount: 20 }]);
});

test('normalizeTransactionRecord restores recurring-list transaction icon, account, and time', () => {
  const normalized = normalizeTransactionRecord(
    {
      id: 1790827200000,
      type: 'spent',
      categoryName: 'ค่าไฟบ้าน',
      accountName: '',
      amount: 500,
      isoDate: '2026-06-03T08:45',
    },
    {
      categories: {
        spent: [{ id: 'electricity', name: 'ค่าไฟ', icon: 'zap' }],
        income: [],
      },
      accounts: [{ id: 'promptpay', name: 'พร้อมเพย์', icon: 'smartphone' }],
      recurringItems: [{ id: 1, name: 'ค่าไฟบ้าน', categoryId: 'electricity', accountId: 'promptpay' }],
    }
  );

  assert.equal(normalized.categoryIcon, 'zap');
  assert.equal(normalized.accountIcon, 'smartphone');
  assert.equal(normalized.accountName, 'พร้อมเพย์');
  assert.match(normalized.date, /2569|2026|03\/06/);
  assert.match(normalized.date, /08:45/);
});

test('buildEditDraft maps a transaction back into UI state values', () => {
  const draft = buildEditDraft({
    tx: {
      id: 11,
      type: 'spent',
      categoryName: 'อาหาร',
      accountName: 'เงินสด',
      amount: 55,
      slipRefNo: 'ABC',
      isoDate: '2026-06-03T10:15',
    },
    currentType: 'spent',
    categories: {
      spent: [{ id: 'food', name: 'อาหาร' }],
      income: [],
    },
    accounts: [{ id: 'cash', name: 'เงินสด' }],
  });

  assert.equal(draft.editModeId, 11);
  assert.equal(draft.selectedCategory, 'food');
  assert.equal(draft.selectedAccount, 'cash');
  assert.equal(draft.expression, '55');
  assert.equal(draft.currentSlipRefNo, 'ABC');
  assert.equal(draft.isoDate, '2026-06-03T10:15');
});

test('syncDataFromSheetFlow normalizes history paid from recurring list', async () => {
  const store = new Map();
  const appStateMock = { currentPage: 'history', txHistory: [] };
  let renderHistoryCalled = false;
  let savedRecurring = null;

  await syncDataFromSheetFlow({
    apiClient: {
      getJson: async () => ({
        history: [{
          id: 1,
          type: 'spent',
          categoryName: 'ค่าไฟบ้าน',
          accountName: 'พร้อมเพย์',
          amount: 500,
          isoDate: '2026-06-03T08:45',
        }],
        recurring: [{
          id: 10,
          name: 'ค่าไฟบ้าน',
          desc: 'ทุกเดือน',
          amount: 500,
          categoryId: 'electricity',
          accountId: 'promptpay',
        }],
      }),
    },
    currentUserProfileId: 'user_1',
    categories: {
      spent: [{ id: 'electricity', name: 'ค่าไฟ', icon: 'zap' }],
      income: [],
    },
    accounts: [{ id: 'promptpay', name: 'พร้อมเพย์', icon: 'smartphone' }],
    saveRecurringItems: (storage, profileId, items) => { savedRecurring = items; },
    localStorageRef: {
      setItem(key, value) {
        store.set(key, value);
      },
    },
    getHistoryKey: () => 'history_user_1',
    updateDashboardFn() {},
    renderHistoryFn() { renderHistoryCalled = true; },
    renderRecurringListFn() {},
    updateRecurringSummaryFn() {},
    appState: appStateMock,
  });

  assert.equal(appStateMock.txHistory[0].categoryIcon, 'zap');
  assert.equal(appStateMock.txHistory[0].accountIcon, 'smartphone');
  assert.match(appStateMock.txHistory[0].date, /08:45/);
  assert.equal(savedRecurring[0].icon, 'zap');
  assert.equal(renderHistoryCalled, true);
  assert.match(store.get('history_user_1'), /categoryIcon/);
});

test('saveTransactionFlow waits for sheet sync before resetting the form', async () => {
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;

  try {
    const store = new Map();
    globalThis.localStorage = {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, value);
      },
    };

    const txDate = { value: '2026-06-03T12:34' };
    const scannedNote = {
      classList: {
        add() {},
        remove() {},
      },
    };
    globalThis.document = {
      getElementById(id) {
        if (id === 'tx-date') return txDate;
        if (id === 'scanned-note') return scannedNote;
        return null;
      },
    };

    let resolvePost;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });
    const postCalls = [];
    const apiClient = {
      postJson(payload) {
        postCalls.push(payload);
        return postPromise;
      },
    };
    const toasts = [];
    const display = { innerText: '123' };
    const updateDashboardFn = () => {};
    const renderHistoryFn = () => {};
    const renderRecurringListFn = () => {};
    const updateRecurringSummaryFn = () => {};
    const setLocalDatetime = () => {};
    const showToast = (message, type) => {
      toasts.push({ message, type });
    };

    uiState.expression = '123';
    uiState.selectedCategory = 'food';
    uiState.selectedAccount = 'cash';
    uiState.selectedBudgetGroupId = '';
    uiState.currentSlipRefNo = 'REF-1';
    uiState.currentScannedBarcode = 'scan-1';
    uiState.editModeId = 9;
    appState.currentType = 'spent';
    appState.currentPage = 'add';
    appState.txHistory = [];

    const flowPromise = saveTransactionFlow({
      uiState,
      appState,
      currentUserProfileId: 'user_1',
      categories: {
        spent: [{ id: 'food', name: 'อาหาร', icon: 'utensils' }],
        income: [],
      },
      accounts: [{ id: 'cash', name: 'เงินสด', icon: 'banknote' }],
      budgetGroups: [],
      getHistoryKey: () => 'history_user_1',
      updateDashboardFn,
      renderHistoryFn,
      renderRecurringListFn,
      updateRecurringSummaryFn,
      showToast,
      apiClient,
      document: globalThis.document,
      display,
      setLocalDatetime,
    });

    let settled = false;
    flowPromise.then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(display.innerText, '123');
    assert.equal(uiState.expression, '123');

    resolvePost();
    await flowPromise;

    assert.equal(settled, true);
    assert.equal(display.innerText, '0');
    assert.equal(uiState.expression, '0');
    assert.equal(uiState.editModeId, null);
    assert.equal(postCalls.length, 1);
    assert.equal(toasts.at(-1).type, 'success');
  } finally {
    globalThis.document = previousDocument;
    globalThis.localStorage = previousLocalStorage;
  }
});

test('setButtonLoading swaps button content without using html strings', () => {
  const previousDocument = globalThis.document;

  class FakeNode {
    constructor(tagName = 'button') {
      this.tagName = tagName;
      this.children = [];
      this.childNodes = this.children;
      this.className = '';
      this.classList = {
        add: (...tokens) => { this._classes = new Set([...(this._classes || []), ...tokens]); },
        remove: (...tokens) => {
          const next = new Set(this._classes || []);
          tokens.forEach((token) => next.delete(token));
          this._classes = next;
        },
      };
      this.disabled = false;
      this.textContent = '';
      this.attributes = {};
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    replaceChildren(...children) {
      this.children = [...children];
      this.childNodes = this.children;
    }

    cloneNode() {
      const clone = new FakeNode(this.tagName);
      clone.children = [...this.children];
      clone.childNodes = clone.children;
      clone.className = this.className;
      clone.disabled = this.disabled;
      clone.textContent = this.textContent;
      clone.attributes = { ...this.attributes };
      return clone;
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  }

  globalThis.document = {
    createElement(tagName) {
      return new FakeNode(tagName);
    },
    createTextNode(text) {
      const node = new FakeNode('#text');
      node.textContent = text;
      return node;
    },
  };

  try {
    const button = new FakeNode('button');
    const original = new FakeNode('#text');
    original.textContent = 'บันทึก';
    button.appendChild(original);

    const loading = setButtonLoading(button, { label: 'กำลังบันทึก...' });

    assert.equal(button.disabled, true);
    assert.equal(button.children.length, 1);
    assert.match(button.children[0].children[1].textContent, /กำลังบันทึก/);

    loading.restore();
    assert.equal(button.disabled, false);
    assert.equal(button.children.length, 1);
    assert.equal(button.children[0].textContent, 'บันทึก');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('analyzeSlipText extracts amount, date, ref, and category hints', () => {
  const result = analyzeSlipText(
    'จำนวนเงิน 125.50\nวันที่ 2 มิ.ย. 2569 เวลา 08:45\nเลขที่อ้างอิง 12345678\nค่าน้ำค่าไฟ',
    [{ id: 1, slipRefNo: 'ABC' }]
  );

  assert.equal(result.detectedAmount, 125.5);
  assert.equal(result.parsedDate, '2026-06-02T08:45');
  assert.equal(result.refNo, '12345678');
  assert.equal(result.guessedCategoryId, 'electricity');
  assert.equal(result.duplicateTx, null);
});

test('calculator service mutates ui state predictably', () => {
  const state = { expression: '0', isEvaluated: false, currentScannedBarcode: 'x', currentSlipRefNo: 'y' };

  inputDigitCalculator(state, '1');
  inputOperatorCalculator(state, '+');
  inputDigitCalculator(state, '2');
  calculateCalculator(state);
  assert.equal(state.expression, '3');
  assert.equal(state.isEvaluated, true);

  quickPriceCalculator(state, 7);
  assert.equal(state.expression, '10');

  backspaceCalculator(state);
  assert.equal(state.expression, '1');

  resetCalculatorScanState(state);
  assert.equal(state.currentScannedBarcode, '');
  assert.equal(state.currentSlipRefNo, '');

  clearCalculator(state);
  assert.equal(state.expression, '0');
});

test('handleCalculatorKeyboardInput supports physical keyboard input', () => {
  const state = { expression: '0', isEvaluated: false };

  assert.equal(handleCalculatorKeyboardInput(state, '1'), true);
  assert.equal(handleCalculatorKeyboardInput(state, '0'), true);
  assert.equal(handleCalculatorKeyboardInput(state, '+'), true);
  assert.equal(handleCalculatorKeyboardInput(state, '2'), true);
  assert.equal(handleCalculatorKeyboardInput(state, 'Enter'), true);

  assert.equal(state.expression, '12');
  assert.equal(state.isEvaluated, true);

  assert.equal(handleCalculatorKeyboardInput(state, 'Backspace'), true);
  assert.equal(state.expression, '1');

   assert.equal(handleCalculatorKeyboardInput(state, 'Escape'), true);
  assert.equal(state.expression, '0');
});

test('calculateRemainingBalances deducts from both child and parent groups', () => {
  const groups = [
    { id: 1, name: 'หลัก', budget: 7000, parentId: null },
    { id: 2, name: 'ย่อย', budget: 3000, parentId: 1 }
  ];
  const txHistory = [
    { type: 'spent', amount: 500, budgetGroupId: '2', isoDate: new Date().toISOString() },
    { type: 'spent', amount: 1000, budgetGroupId: '1', isoDate: new Date().toISOString() },
    // A spent transaction from another month should not count
    { type: 'spent', amount: 300, budgetGroupId: '2', isoDate: '2025-01-01T12:00' },
    // An income transaction should not count
    { type: 'income', amount: 2000, budgetGroupId: '2', isoDate: new Date().toISOString() }
  ];

  const result = calculateRemainingBalances(groups, txHistory);
  const parentGroup = result.find(g => g.id === 1);
  const childGroup = result.find(g => g.id === 2);

  assert.equal(childGroup.remaining, 2500); // 3000 - 500
  assert.equal(parentGroup.remaining, 5500); // 7000 - 500 - 1000
});

test('buildTransactionRecord includes budget group metadata', () => {
  const groups = [
    { id: 2, name: 'ย่อย', parentId: 1 }
  ];
  const inputDate = new Date();
  const { transactionRecord } = buildTransactionRecord({
    editModeId: null,
    currentType: 'spent',
    selectedCategory: 'food',
    selectedAccount: 'cash',
    selectedBudgetGroupId: '2',
    budgetGroups: groups,
    currentScannedBarcode: '',
    currentSlipRefNo: '',
    amount: 100,
    inputDate,
    currentUserProfileId: 'user_1'
  });

  assert.equal(transactionRecord.budgetGroupId, 2);
  assert.equal(transactionRecord.budgetGroupName, 'ย่อย');
  assert.equal(transactionRecord.budgetGroupType, 'child');
});

test('payRecurringItem uses default budget group if valid', async () => {
  const recurringItems = [{ id: 1, name: 'ค่าไฟ', amount: 500, categoryId: 'bills', accountId: 'cash', defaultBudgetGroupId: '2', lastPaidMonth: '' }];
  const budgetGroups = [{ id: 2, name: 'บ้าน', budget: 1000, remaining: 1000, parentId: null }];
  const txHistory = [];
  const appStateMock = { txHistory };

  let savedItems = null;
  let savedGroups = null;

  await payRecurringItem({
    id: 1,
    currentUserProfileId: 'user_1',
    getRecurringItems: () => recurringItems,
    saveRecurringItems: (store, profileId, items) => { savedItems = items; },
    updateDashboardFn: () => {},
    updateRecurringSummaryFn: () => {},
    renderRecurringListFn: () => {},
    showToast: () => {},
    apiClient: { postJson: async () => {} },
    appState: appStateMock,
    localStorageRef: { setItem: () => {} },
    categories: { spent: [{ id: 'bills', name: 'บิล', icon: 'receipt' }] },
    accounts: [{ id: 'cash', name: 'เงินสด' }],
    getHistoryKey: () => 'history_key',
    budgetGroups,
    saveBudgetGroupsFn: (store, profileId, groups) => { savedGroups = groups; }
  });

  assert.equal(savedItems[0].lastPaidMonth, new Date().toISOString().slice(0, 7));
  assert.equal(appStateMock.txHistory.length, 1);
  assert.equal(appStateMock.txHistory[0].budgetGroupId, 2);
  assert.equal(appStateMock.txHistory[0].budgetGroupName, 'บ้าน');
  assert.equal(appStateMock.txHistory[0].budgetGroupType, 'root');
  assert.equal(savedGroups[0].remaining, 500);
});

test('payRecurringItem falls back to budget chooser callback if no default budget group', async () => {
  const recurringItems = [{ id: 1, name: 'ค่าไฟ', amount: 500, categoryId: 'bills', accountId: 'cash', lastPaidMonth: '' }];
  const budgetGroups = [{ id: 2, name: 'บ้าน', budget: 1000, remaining: 1000, parentId: null }];
  const txHistory = [];
  const appStateMock = { txHistory };

  let chooserCalled = false;
  let savedGroups = null;

  let resolveDone;
  const donePromise = new Promise((resolve) => { resolveDone = resolve; });

  await payRecurringItem({
    id: 1,
    currentUserProfileId: 'user_1',
    getRecurringItems: () => recurringItems,
    saveRecurringItems: () => {},
    updateDashboardFn: () => {},
    updateRecurringSummaryFn: () => {},
    renderRecurringListFn: () => {},
    showToast: () => {},
    apiClient: { postJson: async () => {} },
    appState: appStateMock,
    localStorageRef: { setItem: () => {} },
    categories: { spent: [{ id: 'bills', name: 'บิล', icon: 'receipt' }] },
    accounts: [{ id: 'cash', name: 'เงินสด' }],
    getHistoryKey: () => 'history_key',
    budgetGroups,
    saveBudgetGroupsFn: (store, profileId, groups) => {
      savedGroups = groups;
      resolveDone();
    },
    onRequireBudgetGroupChooser: (item, callback) => {
      chooserCalled = true;
      callback('2');
    }
  });

  await donePromise;

  assert.equal(chooserCalled, true);
  assert.equal(savedGroups[0].remaining, 500);
});

test('payRecurringItem uses app confirm dialog instead of native confirm for negative balances', async () => {
  const previousConfirm = globalThis.confirm;

  try {
    globalThis.confirm = () => {
      throw new Error('native confirm should not be used');
    };

    const recurringItems = [{ id: 1, name: 'ค่ารถ', amount: 500, categoryId: 'bills', accountId: 'cash', defaultBudgetGroupId: '2', lastPaidMonth: '' }];
    const budgetGroups = [{ id: 2, name: 'Main', budget: 1000, remaining: 100, parentId: null }];
    const appStateMock = { txHistory: [] };
    const dialogCalls = [];
    let savedGroups = null;

    await payRecurringItem({
      id: 1,
      currentUserProfileId: 'user_1',
      getRecurringItems: () => recurringItems,
      saveRecurringItems: () => {},
      updateDashboardFn: () => {},
      updateRecurringSummaryFn: () => {},
      renderRecurringListFn: () => {},
      showToast: () => {},
      apiClient: { postJson: async () => {} },
      appState: appStateMock,
      localStorageRef: { setItem: () => {} },
      categories: { spent: [{ id: 'bills', name: 'บิล', icon: 'receipt' }] },
      accounts: [{ id: 'cash', name: 'เงินสด' }],
      getHistoryKey: () => 'history_key',
      budgetGroups,
      saveBudgetGroupsFn: (store, profileId, groups) => { savedGroups = groups; },
      showConfirmDialogFn: async (options) => {
        dialogCalls.push(options);
        return true;
      },
    });

    assert.equal(dialogCalls.length, 1);
    assert.equal(dialogCalls[0].title, 'ยอดเงินจะติดลบ');
    assert.match(dialogCalls[0].desc, /Main/);
    assert.equal(appStateMock.txHistory.length, 1);
    assert.equal(savedGroups[0].remaining, 500);
  } finally {
    globalThis.confirm = previousConfirm;
  }
});

test('cancelRecurringPayment clears lastPaidMonth and deletes the linked history item', async () => {
  const previousDocument = globalThis.document;
  const previousConfirm = globalThis.confirm;

  try {
    globalThis.confirm = () => {
      throw new Error('native confirm should not be used');
    };
    globalThis.document = {
      createElement() {
        return {
          className: '',
          textContent: '',
          children: [],
          appendChild(child) {
            this.children.push(child);
            return child;
          },
          setAttribute() {},
          replaceChildren() {},
        };
      },
      createTextNode(text) {
        return { textContent: text };
      },
      getElementById(id) {
        if (id === 'custom-confirm-dialog') {
          return {
            classList: {
              remove() {},
              add() {},
            },
          };
        }
        return {
          classList: { remove() {}, add() {} },
          innerText: '',
          className: '',
        };
      },
    };

    const store = new Map();
    const items = [{
      id: 1,
      name: 'ค่าไฟ/ผ่อนบ้าน',
      desc: 'ทุกเดือน',
      amount: 500,
      categoryId: 'bills',
      accountId: 'cash',
      lastPaidMonth: '2026-06',
    }];

    const storage = {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, value);
      },
    };

    const apiCalls = [];
    const apiClient = {
      postJson(payload) {
        apiCalls.push(payload);
        return Promise.resolve({});
      },
    };
    const toasts = [];
    const appStateMock = {
      txHistory: [{
        id: 101,
        type: 'spent',
        recurringSourceId: 1,
        categoryName: 'ค่าไฟ/ผ่อนบ้าน',
        amount: 500,
        isoDate: '2026-06-03T10:00',
        barcodeNote: 'รายจ่ายประจำ: ทุกเดือน',
      }],
    };

    const cancelPromise = cancelRecurringPayment({
      id: 1,
      currentUserProfileId: 'user_1',
      getRecurringItems: () => items,
      saveRecurringItems: (storeRef, profileId, nextItems) => {
        store.set(`my_recurring_list_${profileId}`, JSON.stringify(nextItems));
      },
      updateDashboardFn() {},
      updateRecurringSummaryFn() {},
      renderRecurringListFn() {},
      showToast(message, type) {
        toasts.push({ message, type });
      },
      apiClient,
      appState: appStateMock,
      localStorageRef: storage,
      budgetGroups: [],
      saveBudgetGroupsFn() {},
    });

    await Promise.resolve();
    resolveConfirmDialog(true);
    await cancelPromise;

    assert.equal(items[0].lastPaidMonth, '');
    assert.equal(appStateMock.txHistory.length, 0);
    assert.equal(store.get('my_tx_history_user_1'), JSON.stringify([]));
    assert.ok(apiCalls.some((call) => call.sheetName === 'user_1_History' && call.action === 'delete'));
    assert.ok(apiCalls.some((call) => call.sheetName === 'user_1_Recurring' && call.action === 'edit'));
    assert.equal(toasts.at(-1).type, 'success');
  } finally {
    globalThis.document = previousDocument;
    globalThis.confirm = previousConfirm;
  }
});

test('SyncQueueManager coalesces queue correctly', () => {
  const manager = new SyncQueueManager({ postJson: async () => ({}) }, null);
  
  // Test case 1: Add + Edit -> Merge data and keep as 'add'
  const q1 = [
    { id: '1', action: 'add', name: 'A', budget: 100, timestamp: 100 },
    { id: '1', action: 'edit', name: 'A updated', timestamp: 101 }
  ];
  const res1 = manager.coalesceQueue(q1);
  assert.equal(res1.length, 1);
  assert.equal(res1[0].action, 'add');
  assert.equal(res1[0].name, 'A updated');

  // Test case 2: Add + Delete -> Remove entirely
  const q2 = [
    { id: '2', action: 'add', name: 'B', timestamp: 100 },
    { id: '2', action: 'delete', timestamp: 101 }
  ];
  const res2 = manager.coalesceQueue(q2);
  assert.equal(res2.length, 0);

  // Test case 3: Edit + Edit -> Merge data and keep as 'edit'
  const q3 = [
    { id: '3', action: 'edit', name: 'C', timestamp: 100 },
    { id: '3', action: 'edit', name: 'C updated', timestamp: 101 }
  ];
  const res3 = manager.coalesceQueue(q3);
  assert.equal(res3.length, 1);
  assert.equal(res3[0].action, 'edit');
  assert.equal(res3[0].name, 'C updated');

  // Test case 4: Edit + Delete -> Change to 'delete'
  const q4 = [
    { id: '4', action: 'edit', name: 'D', timestamp: 100 },
    { id: '4', action: 'delete', timestamp: 101 }
  ];
  const res4 = manager.coalesceQueue(q4);
  assert.equal(res4.length, 1);
  assert.equal(res4[0].action, 'delete');
});

test('SyncQueueManager handles successful batch sync', async () => {
  const mockStore = {
    events: {},
    publish(event, data) {
      this.events[event] = data;
    }
  };
  
  let postPayload = null;
  const mockApiClient = {
    postJson: async (payload) => {
      postPayload = payload;
      return { status: 'Success' };
    }
  };

  const manager = new SyncQueueManager(mockApiClient, mockStore);
  
  // Set up local storage mock environment
  const previousLocalStorage = globalThis.localStorage;
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) { return store.get(key) || null; },
    setItem(key, val) { store.set(key, val); }
  };
  
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true
  });

  try {
    manager.enqueue({ id: '5', action: 'add', name: 'E' });
    
    // Wait for sync to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.ok(postPayload);
    assert.equal(postPayload.action, 'batch');
    assert.equal(postPayload.operations.length, 1);
    assert.equal(postPayload.operations[0].id, '5');
    
    // The queue should now be empty
    assert.equal(manager.getQueue().length, 0);
    assert.ok(mockStore.events['sync:success']);
    assert.equal(mockStore.events['sync:success'].syncedCount, 1);
  } finally {
    globalThis.localStorage = previousLocalStorage;
    if (previousNavigator) {
      Object.defineProperty(globalThis, 'navigator', previousNavigator);
    } else {
      delete globalThis.navigator;
    }
  }
});
