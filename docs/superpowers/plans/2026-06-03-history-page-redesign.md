# History Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `ประวัติธุรกรรม` page feel like a true history view: history is the main content, recurring items are a compact supporting summary, and the existing recurring-only page stays available.

**Architecture:** Keep the recurring-only page as the place for full recurring management. On the history page, render a small recurring preview card plus the transaction timeline. Extend the existing ledger renderers with targetable containers and add a grouped history layout so the page reads like an actual timeline instead of two equal-sized panels.

**Tech Stack:** Vite, vanilla JavaScript ES modules, existing DOM helpers, existing ledger/profile/flow services.

---

### Task 1: Make the history page visually history-first

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Keep the page title explicit**

The page heading should stay:

```html
<h3 class="text-xs font-bold text-slate-600">ประวัติธุรกรรม</h3>
```

- [ ] **Step 2: Replace the second large recurring panel with a compact recurring preview**

Use a slimmer card in `page-history` that shows:

- recurring count
- total monthly recurring spend
- up to 3 recurring items previewed as a short list
- a button that jumps to the full recurring page (`switchPage('list')`)

Example structure:

```html
<div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
  <div class="flex items-center justify-between gap-3 mb-3">
    <div>
      <h2 class="text-sm font-bold text-slate-800">รายการประจำ</h2>
      <p class="text-[10px] text-slate-500 mt-0.5">สรุปภาระที่ต้องจ่ายทุกเดือน</p>
    </div>
    <button onclick="switchPage('list')" class="text-[11px] font-bold text-indigo-600">ดูทั้งหมด</button>
  </div>
  <div id="recurring-preview-history" class="space-y-2"></div>
</div>
```

- [ ] **Step 3: Give the history timeline more breathing room**

Keep the transaction list as the main block under the recurring preview:

```html
<div id="history-list" class="space-y-2 w-full pb-6"></div>
```

### Task 2: Add a compact recurring preview renderer and grouped history rendering

**Files:**
- Modify: `src/ledger-service.mjs`

- [ ] **Step 1: Add a compact recurring preview renderer**

Create a new helper that renders just the first few recurring items into a preview container:

```js
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
  // Render count, total, and up to maxItems items
}
```

- [ ] **Step 2: Group history by day so it reads like a timeline**

Update `renderHistory` so it can optionally group items by date. Use date headers like:

```js
if (currentGroupLabel !== nextGroupLabel) {
  listSection.appendChild(createEl('div', {
    className: 'px-1 pt-2 text-[10px] font-bold text-slate-400',
    text: nextGroupLabel,
  }));
}
```

The history renderer should still work with the existing `createHistoryRow` cards, but the date headers make it feel like a timeline.

- [ ] **Step 3: Keep the old recurring list renderer intact**

Do not remove `renderRecurringList`. The recurring-only page should still work as the full management screen.

### Task 3: Render the history-first page

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add a history preview wrapper**

Add a wrapper function in `app.js`:

```js
function renderRecurringPreviewHistory() {
    renderRecurringPreviewService({
        storage: localStorage,
        profileId: currentUserProfileId,
    });
}
```

- [ ] **Step 2: Make the history page render preview + timeline**

Update `switchPage('history')` to call:

```js
renderRecurringPreviewHistory();
renderHistory();
```

- [ ] **Step 3: Keep list page behavior unchanged**

The `list` page should still call the existing full recurring renderers.

### Task 4: Verify the redesign

**Files:**
- Modify: `test/core.test.mjs`

- [ ] **Step 1: Add a unit test for the new recurring preview renderer**

Verify it writes a compact preview into the target container and does not depend on the full recurring list container.

- [ ] **Step 2: Run the test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Build the app**

Run:

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 4: Manual check**

Open `ประวัติธุรกรรม` and confirm:

- recurring is compact and secondary
- history is the main block
- the page feels like a timeline rather than two equal panels

