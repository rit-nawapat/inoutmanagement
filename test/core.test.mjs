import test from 'node:test';
import assert from 'node:assert/strict';

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
import { backspaceCalculator, calculateCalculator, clearCalculator, inputDigitCalculator, inputOperatorCalculator, quickPriceCalculator, resetCalculatorScanState } from '../src/calculator-service.mjs';
import { applyTransactionSave, buildEditDraft, buildTransactionRecord } from '../src/transaction-service.mjs';
import { createEl, sanitizeIconName, setText } from '../src/dom-helpers.mjs';
import { createHistoryRow, createRecurringRow } from '../src/render-helpers.mjs';

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
    assert.equal(historyRow.tagName, 'div');
    assert.match(collectText(historyRow), /เงินสด/);
    assert.match(collectText(historyRow), /สลิป: <script>/);
  } finally {
    globalThis.document = previousDocument;
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
  assert.equal(guessCategoryFromText('ชำระค่าไฟฟ้าและน้ำประปา'), 'bills');
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
  assert.equal(uiRecord.categoryIcon, 'utensils');
  assert.equal(uiRecord.accountIcon, 'banknote');
});

test('applyTransactionSave updates existing rows or prepends new ones', () => {
  const existing = [{ id: 1, amount: 10 }, { id: 2, amount: 20 }];
  assert.deepEqual(applyTransactionSave(existing, { id: 2, amount: 99 }, 2), [{ id: 1, amount: 10 }, { id: 2, amount: 99 }]);
  assert.deepEqual(applyTransactionSave(existing, { id: 3, amount: 30 }, null), [{ id: 3, amount: 30 }, { id: 1, amount: 10 }, { id: 2, amount: 20 }]);
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
  assert.equal(result.guessedCategoryId, 'bills');
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
  assert.equal(state.expression, '7');

  backspaceCalculator(state);
  assert.equal(state.expression, '0');

  resetCalculatorScanState(state);
  assert.equal(state.currentScannedBarcode, '');
  assert.equal(state.currentSlipRefNo, '');

  clearCalculator(state);
  assert.equal(state.expression, '0');
});
