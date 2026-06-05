# History + Recurring Single-Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `history` view clearly titled "ประวัติธุรกรรม" and show both recurring items and transaction history on the same page without breaking the existing recurring-only page.

**Architecture:** Keep the existing recurring-only page in place, but give the history page its own recurring summary/list container and its own history container. Make the render helpers accept target container IDs so the same data can be rendered into either page. This keeps the data flow simple and avoids duplicating logic.

**Tech Stack:** Vite, vanilla JavaScript ES modules, existing DOM helpers, existing ledger/profile/flow services.

---

### Task 1: Update history page markup and labels

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update the page title and section heading**

Change the existing history heading text from:

```html
<h3 class="text-xs font-bold text-slate-600">รายการธุรกรรมทั้งหมด</h3>
```

to:

```html
<h3 class="text-xs font-bold text-slate-600">ประวัติธุรกรรม</h3>
```

- [ ] **Step 2: Add a recurring summary block inside the history page**

Add a recurring summary card above the history list using unique IDs so the same render logic can target both the recurring-only page and the combined page:

```html
<section id="page-history" class="hidden flex-col space-y-4 w-full max-w-4xl mx-auto h-fit">
    <div class="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200">
        <h3 class="text-xs font-bold text-slate-600">ประวัติธุรกรรม</h3>
        <span id="history-count" class="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">0 รายการ</span>
    </div>

    <div class="bg-[#5b3df0] text-white p-5 rounded-3xl shadow-lg grid grid-cols-2 gap-3 relative overflow-hidden shrink-0">
        <div class="col-span-1 border-r border-indigo-400/30 pr-3">
            <span class="text-[10px] text-indigo-200 block mb-1">รายรับเดือนนี้</span>
            <span class="text-xl font-bold" id="req-dash-income-history">฿0</span>
        </div>
        <div class="col-span-1 pl-1">
            <span class="text-[10px] text-indigo-200 block mb-1">รายจ่ายประจำ</span>
            <span class="text-xl font-bold text-[#ffb4a2]" id="req-dash-spent-history">฿0</span>
        </div>
        <div class="col-span-2 border-t border-indigo-400/30 pt-3 mt-1">
            <span class="text-[10px] text-indigo-200 block mb-1">เงินเหลือใช้จริง (หลังหักภาระประจำ)</span>
            <span class="text-3xl font-extrabold" id="req-dash-remain-history">฿0</span>
        </div>
    </div>

    <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div class="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-slate-100 gap-3 shrink-0">
            <div>
                <h2 class="text-base font-bold text-slate-800">รายจ่ายที่จ่ายทุกเดือน</h2>
                <p class="text-[10px] text-slate-500 mt-0.5">ระบบจะรีเซ็ตสถานะเป็น "ยังไม่จ่าย" อัตโนมัติทุกต้นเดือน</p>
            </div>
            <button onclick="openRecurringModal()" class="bg-[#0f172a] text-white px-4 py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 w-full md:w-auto cursor-pointer transition-colors hover:bg-slate-800">
                <i data-lucide="plus" class="w-4 h-4"></i> เพิ่มรายการประจำ
            </button>
        </div>
        <div class="overflow-y-auto p-1 md:p-0 no-scrollbar" id="recurring-list-container-history"></div>
    </div>

    <div id="history-list" class="space-y-2 w-full pb-6"></div>
</section>
```

### Task 2: Make ledger rendering targetable

**Files:**
- Modify: `src/ledger-service.mjs`

- [ ] **Step 1: Extend recurring summary rendering to accept custom target IDs**

Update the summary renderer so it can write to either the existing recurring page or the combined history page:

```js
export function updateRecurringSummary(txHistory, storage, profileId, doc = globalThis.document, targetIds = {}) {
  const incomeId = targetIds.incomeId || 'req-dash-income';
  const spentId = targetIds.spentId || 'req-dash-spent';
  const remainId = targetIds.remainId || 'req-dash-remain';
  // keep existing calculation logic, then write into those IDs
}
```

- [ ] **Step 2: Extend recurring list rendering to accept a custom container**

Make the list renderer default to the old container, but allow the history page to pass a second container:

```js
export function renderRecurringList({
  storage,
  profileId,
  onPay,
  onToggleFav,
  onEdit,
  onDelete,
  doc = globalThis.document,
  lucide = globalThis.lucide,
  containerId = 'recurring-list-container',
} = {}) {
  const container = doc.getElementById(containerId);
  if (!container) return;
  // render exactly as before
}
```

- [ ] **Step 3: Keep history rendering targetable without breaking the existing list**

Leave the history renderer behavior the same, but ensure it can still target `history-list` on the combined page:

```js
export function renderHistory({
  txHistory,
  onEdit,
  onDelete,
  doc = globalThis.document,
  lucide = globalThis.lucide,
  containerId = 'history-list',
  countId = 'history-count',
} = {}) {
  const listSection = doc.getElementById(containerId);
  const countEl = doc.getElementById(countId);
  // existing rendering logic
}
```

### Task 3: Render both sections when the history page is active

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Render both recurring and history content on the history page**

Update the page switcher so the history page renders the combined view:

```js
if (pageId === 'history') {
    renderRecurringListHistory();
    updateRecurringSummaryHistory();
    renderHistory();
}
```

- [ ] **Step 2: Add small wrapper functions for the combined page**

Add wrappers that call the existing ledger service with the combined-page container IDs:

```js
function updateRecurringSummaryHistory() {
    updateRecurringSummaryService(
        appState.txHistory,
        localStorage,
        currentUserProfileId,
        document,
        {
            incomeId: 'req-dash-income-history',
            spentId: 'req-dash-spent-history',
            remainId: 'req-dash-remain-history',
        }
    );
}

function renderRecurringListHistory() {
    renderRecurringListService({
        storage: localStorage,
        profileId: currentUserProfileId,
        onPay: payRecurringItem,
        onToggleFav: toggleFavRecurring,
        onEdit: openRecurringModal,
        onDelete: deleteRecurringItem,
        containerId: 'recurring-list-container-history',
    });
}
```

- [ ] **Step 3: Keep the existing recurring-only page working**

Do not remove the existing `list` page behavior. It should still render into `recurring-list-container` with the original IDs so the dedicated recurring view remains available.

### Task 4: Verify the combined page

**Files:**
- Modify: `test/core.test.mjs` if a render-target test is needed

- [ ] **Step 1: Add a render-target test if the helper signatures change**

If the render helpers accept new target IDs, add a focused unit test to confirm the custom IDs are honored.

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Build the app**

Run: `npm run build`
Expected: build completes successfully.

- [ ] **Step 4: Manual browser check**

Open the app, switch to `ประวัติธุรกรรม`, and confirm the page shows:
- recurring summary
- recurring list
- transaction history
- correct heading text

