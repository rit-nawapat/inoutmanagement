# Mobile Add Page Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the mobile `บันทึกรายการ` page so the viewport stays locked, the form body itself no longer scrolls, and only the category/account/budget option blocks scroll internally without visible scrollbars.

**Architecture:** Keep the existing viewport-height model driven by `syncViewportMetrics()` and the single-page app shell. Shift mobile scrolling responsibility away from `#tx-form-body` and into three bounded internal scroll regions that wrap the existing selection grids. Verify the new contract with the repo's existing `node:test` string-based UI assertions instead of adding a new browser test stack.

**Tech Stack:** Vanilla JavaScript ES modules, static `index.html`, responsive CSS in `style.css`, `node:test` assertions in `test/core.test.mjs`.

---

## File Structure

- Modify: `F:\Project\income-outcom management\index.html`
  Responsibility: Add lightweight wrapper containers around the mobile selection grids so labels stay fixed while only the overflowable grid region scrolls.

- Modify: `F:\Project\income-outcom management\style.css`
  Responsibility: Remove mobile scroll behavior from `#tx-form-body` and define reusable mobile-only internal scroll-region rules for the wrapped option blocks.

- Modify: `F:\Project\income-outcom management\test\core.test.mjs`
  Responsibility: Lock in the HTML/CSS contract with string-based tests that check for wrapper IDs, mobile scroll-region classes, and the removal of form-body scrolling.

---

### Task 1: Lock The Intended Mobile Scroll Contract In Tests

**Files:**
- Modify: `F:\Project\income-outcom management\test\core.test.mjs`
- Test: `F:\Project\income-outcom management\test\core.test.mjs`

- [ ] **Step 1: Write the failing test for the new mobile scroll wrappers**

Add these assertions inside the existing `test('mobile add page uses a compact one-page layout and removes OCR controls', ...)` block after the current grid assertions:

```js
  assert.match(htmlSource, /id="category-grid-scroll"/);
  assert.match(htmlSource, /id="account-grid-scroll"/);
  assert.match(htmlSource, /id="tx-budget-group-grid-scroll"/);
  assert.match(htmlSource, /class="mobile-option-scroll no-scrollbar"/);
```

- [ ] **Step 2: Write the failing test for the updated CSS scroll contract**

Replace the part of `test('mobile viewport CSS locks the add page to measured visual viewport height', ...)` that currently expects `#tx-form-body` to scroll with these assertions:

```js
  assert.match(cssSource, /#tx-form-body\s*\{[\s\S]*overflow:\s*visible/);
  assert.doesNotMatch(cssSource, /#tx-form-body\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-option-scroll\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(cssSource, /\.mobile-option-scroll\s*\{[\s\S]*-webkit-overflow-scrolling:\s*touch/);
  assert.match(cssSource, /\.mobile-option-scroll\s*\{[\s\S]*min-height:\s*0/);
  assert.match(cssSource, /#category-grid-scroll/);
  assert.match(cssSource, /#account-grid-scroll/);
  assert.match(cssSource, /#tx-budget-group-grid-scroll/);
```

- [ ] **Step 3: Run the focused test file to verify it fails**

Run:

```bash
node --test --test-isolation=none test/core.test.mjs
```

Expected:

```text
FAIL
```

The failing output should mention missing wrapper IDs in `index.html` and the old `#tx-form-body` mobile `overflow-y: auto` rule still being present in `style.css`.

- [ ] **Step 4: Commit the failing-test checkpoint**

Run:

```bash
git add test/core.test.mjs
git commit -m "test: cover mobile add page scroll containers"
```

Expected:

```text
1 file changed
```

---

### Task 2: Move Mobile Scrolling From The Form Body Into The Option Blocks

**Files:**
- Modify: `F:\Project\income-outcom management\index.html`
- Modify: `F:\Project\income-outcom management\style.css`
- Test: `F:\Project\income-outcom management\test\core.test.mjs`

- [ ] **Step 1: Wrap each mobile selection grid with a dedicated scroll container**

In `index.html`, replace the three existing grid-only sections with the wrapped versions below.

For the category section:

```html
                                <div class="space-y-1.5 option-block option-block-category">
                                    <div class="flex items-center justify-between">
                                        <span class="max-md:text-sm max-md:font-extrabold max-md:text-slate-800 max-md:normal-case text-[10px] font-bold uppercase tracking-wider text-slate-400">หมวดหมู่</span>
                                    </div>
                                    <div id="category-grid-scroll" class="mobile-option-scroll no-scrollbar">
                                        <div class="w-full max-md:grid max-md:grid-cols-4 max-md:gap-1.5 md:flex md:overflow-x-auto md:no-scrollbar md:snap-x md:gap-2 lg:flex-wrap" id="category-grid"></div>
                                    </div>
                                </div>
```

For the account section:

```html
                                <div class="space-y-1.5 md:space-y-2 md:pt-3.5 md:pb-1 md:border-t md:border-slate-100 option-block option-block-account">
                                    <div class="flex items-center justify-between">
                                        <span class="max-md:text-sm max-md:font-extrabold max-md:text-slate-800 max-md:normal-case text-[10px] font-bold uppercase tracking-wider text-slate-400">ช่องทางชำระเงิน</span>
                                    </div>
                                    <div id="account-grid-scroll" class="mobile-option-scroll no-scrollbar">
                                        <div class="w-full max-md:grid max-md:grid-cols-2 max-md:gap-2.5 md:flex md:flex-wrap md:gap-3 lg:gap-4 py-0.5" id="account-grid"></div>
                                    </div>
                                </div>
```

For the budget-group section:

```html
                                <div id="tx-budget-group-section" class="space-y-1.5 md:space-y-2 md:pt-3.5 md:pb-1 md:border-t md:border-slate-100 option-block option-block-budget">
                                    <span class="max-md:block hidden max-md:text-sm max-md:font-extrabold max-md:text-slate-800 max-md:normal-case text-[10px] font-bold uppercase tracking-wider text-slate-400">กระเป๋าที่ต้องการใช้</span>

                                    <button id="tx-budget-summary-row" type="button" onclick="openBudgetSelectorModal()" class="w-full text-left max-md:hidden md:bg-transparent md:p-0">
                                        <div class="flex items-center justify-between">
                                            <div class="space-y-0.5">
                                                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">กระเป๋าที่ต้องการใช้</span>
                                                <span id="tx-budget-summary-text" class="md:hidden block text-xs font-medium text-slate-500">ยังไม่มีกระเป๋าให้เลือก</span>
                                            </div>
                                            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 md:hidden"></i>
                                        </div>
                                    </button>
                                    <div id="tx-budget-group-grid-scroll" class="mobile-option-scroll no-scrollbar">
                                        <div class="w-full max-md:grid max-md:grid-cols-2 max-md:gap-2.5 md:flex md:flex-wrap md:gap-3 lg:gap-4 py-0.5" id="tx-budget-group-grid"></div>
                                    </div>
                                </div>
```

- [ ] **Step 2: Remove mobile scrolling from `#tx-form-body` and define reusable internal scroll-region CSS**

In `style.css`, replace the current mobile `#tx-form-body` rule and the single `#category-grid` mobile rule with this block:

```css
  #tx-form-body {
    flex: 1 1 auto !important;
    min-height: 0;
    overflow: visible;
    display: flex;
    flex-direction: column;
  }

  .option-block {
    min-height: 0;
  }

  .mobile-option-scroll {
    min-height: 0;
    overflow: visible;
  }

  body.is-add-page .mobile-option-scroll {
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  body.is-add-page #category-grid-scroll {
    flex: 0 1 auto;
    max-height: clamp(64px, 16vh, 144px);
  }

  body.is-add-page #account-grid-scroll,
  body.is-add-page #tx-budget-group-grid-scroll {
    flex: 1 1 auto;
    max-height: clamp(92px, 20vh, 180px);
  }

  #category-grid {
    min-height: 48px;
    align-content: start;
  }

  #account-grid,
  #tx-budget-group-grid {
    align-content: start;
  }
```

- [ ] **Step 3: Keep the add-page frame locked while ensuring the save button still stays in-flow**

In the same mobile media query, confirm these rules remain true after the edit:

```css
  body.is-add-page #tx-options-card {
    flex: 1 1 auto;
    min-height: 0;
    max-height: none;
    padding: 0.6rem 0.75rem !important;
    gap: 0.5rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  body.is-add-page #btn-save {
    flex: 0 0 var(--mobile-save-height);
    height: var(--mobile-save-height);
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    margin-top: auto !important;
    margin-bottom: 0 !important;
    border-radius: 0.875rem;
  }
```

No sticky or fixed positioning should be introduced for `#btn-save`.

- [ ] **Step 4: Run the focused test file again to verify it passes**

Run:

```bash
node --test --test-isolation=none test/core.test.mjs
```

Expected:

```text
PASS
```

The output should include the two UI contract tests passing alongside the existing suite.

- [ ] **Step 5: Commit the implementation checkpoint**

Run:

```bash
git add index.html style.css test/core.test.mjs
git commit -m "fix: limit mobile add-page scrolling to option blocks"
```

Expected:

```text
3 files changed
```

---

### Task 3: Verify Real Behavior On A Local Mobile-Sized Viewport

**Files:**
- Modify: `F:\Project\income-outcom management\docs\superpowers\plans\2026-06-05-mobile-add-page-scroll-implementation.md`
- Test: `F:\Project\income-outcom management\index.html`
- Test: `F:\Project\income-outcom management\style.css`

- [ ] **Step 1: Start the local app**

Run:

```bash
npm run dev
```

Expected:

```text
VITE
Local:
```

Keep the dev server running for the remaining verification steps.

- [ ] **Step 2: Verify the mobile add page in a narrow viewport**

Manual verification checklist:

```text
1. Open the app in a mobile-sized viewport around 390x844.
2. Navigate to บันทึกรายการ.
3. Confirm the page itself does not scroll.
4. Confirm the save button remains visible in the add-page layout.
5. Confirm category chips can scroll when there are enough items to overflow.
6. Confirm account and budget blocks scroll independently when their content exceeds their bounds.
7. Confirm no visible scrollbar track appears while touchpad or touchscreen scrolling still works.
```

- [ ] **Step 3: Verify a short viewport edge case**

Repeat the same checks with a shorter viewport such as `360x640`.

Expected:

```text
The add page still fits inside the viewport shell, and overflow is absorbed by the wrapped option blocks instead of the whole form.
```

- [ ] **Step 4: Record any CSS tuning needed before merge**

If one block feels too cramped or too tall, adjust only these `max-height` values and re-run the focused test suite:

```css
  body.is-add-page #category-grid-scroll {
    max-height: clamp(64px, 16vh, 144px);
  }

  body.is-add-page #account-grid-scroll,
  body.is-add-page #tx-budget-group-grid-scroll {
    max-height: clamp(92px, 20vh, 180px);
  }
```

Then run:

```bash
node --test --test-isolation=none test/core.test.mjs
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the verification/tuning checkpoint**

Run:

```bash
git add index.html style.css test/core.test.mjs
git commit -m "test: verify mobile add-page option scroll behavior"
```

Expected:

```text
working tree clean
```

---

## Self-Review

### Spec Coverage

- Viewport stays locked: covered by Task 2 CSS rules that preserve the existing page frame contract.
- `#tx-form-body` no longer scrolls: covered by Task 1 tests and Task 2 CSS change.
- Only category/account/budget blocks scroll: covered by Task 1 tests and Task 2 wrappers/CSS.
- Hidden scrollbars with mobile touch scrolling: covered by Task 1 tests and Task 2 reusable `.mobile-option-scroll` rule.
- Mobile viewport verification on short and tall screens: covered by Task 3 manual checks.

### Placeholder Scan

- No `TODO`, `TBD`, or vague "add tests later" language remains.
- Each code-changing step includes concrete snippets and exact commands.

### Type / Naming Consistency

- Wrapper IDs are consistent across all tasks:
  - `category-grid-scroll`
  - `account-grid-scroll`
  - `tx-budget-group-grid-scroll`
- Shared CSS helper name is consistent across all tasks:
  - `mobile-option-scroll`
