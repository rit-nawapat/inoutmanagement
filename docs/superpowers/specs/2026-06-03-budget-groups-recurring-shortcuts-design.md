# Budget Groups + Recurring Shortcuts Design

**Goal:** Add a budget-group system that lets the user split one monthly pool into smaller sub-pools, while also making recurring items faster to pay with a one-tap "paid" shortcut.

**Architecture:** Keep the current transaction, recurring, and profile flow intact, but introduce a new budget domain that sits beside categories and accounts. A budget group can be a top-level pool or a child pool under a parent pool. The transaction form will let the user choose which pool the payment comes from, and recurring items can remember a default budget group so "pay now" is fast. The budget domain should be persisted locally, mirrored to the cloud backend the same way recurring/history data is, and rendered as compact summaries in the dashboard and transaction form.

**Tech Stack:** Vanilla JavaScript ES modules, Vite, localStorage, Apps Script backend, Cloudflare Worker proxy, existing DOM/render helpers.

---

## Problem Statement

The current app can record transactions and recurring bills, but it does not model “money that is set aside for the month” as a first-class concept. The user wants both:

1. A single monthly envelope, such as `7,000` for the whole month.
2. Smaller sub-envelopes inside it, such as `กิน`, `เดินทาง`, and `จิปาถะ`.

The user also wants recurring items to be easier to settle, with a shortcut that marks them paid without needing to open a separate edit flow every time.

---

## Proposed UX

### Budget Groups

- A user can create one top-level budget group, for example `ใช้ทั้งเดือน 7,000`.
- A top-level group can have child groups, for example `กิน 3,000`, `เดินทาง 1,500`, `จิปาถะ 2,500`.
- The top-level group shows the full picture.
- Child groups are the real spending buckets.
- Spending can be assigned to either:
  - the top-level group directly, or
  - one specific child group.

### Recurring Shortcuts

- Each recurring item gets a quick action button labeled `จ่ายแล้ว`.
- A recurring item can remember a `defaultBudgetGroupId`.
- When the user taps `จ่ายแล้ว`, the app:
  - creates the transaction history record,
  - marks the recurring item paid for the month,
  - subtracts the amount from the selected budget group,
  - and falls back to the default group if the user does not choose one manually.

### Transaction Form

- The transaction form gets a budget-group selector.
- The selector should show:
  - `รวมทั้งหมด`
  - top-level budget groups
  - child groups under each top-level group
- If the user chooses a child group, the app records that exact bucket as the source of the money.
- If the user chooses a top-level group, the app treats the transaction as spending from the pool itself.

### Dashboard

- The dashboard shows a compact budget summary:
  - total monthly pool
  - amount already spent
  - remaining balance
- If the user has child groups, the dashboard also shows a short grouped breakdown, not a giant nested UI.

---

## Data Model

### Budget Group

Each group should store:

- `id`
- `name`
- `budget`
- `remaining`
- `parentId` for child groups, or `null` for a top-level group
- `color`
- `order`
- `isArchived`

### Recurring Item

Each recurring item should gain:

- `defaultBudgetGroupId`
- `lastPaidMonth`

### Transaction Record

Each transaction should gain:

- `budgetGroupId`
- `budgetGroupName`
- `budgetGroupType` with values `root` or `child`

This lets history show where the money came from without guessing from category alone.

---

## Data Flow

### When the user saves a normal transaction

1. The form reads the selected budget group.
2. The transaction is stored with the selected group metadata.
3. The matching budget group balance is reduced.
4. Dashboard, history, and budget summaries refresh.
5. The record is synced to the backend.

### When the user pays a recurring item

1. The user taps `จ่ายแล้ว`.
2. If a default budget group exists, the app uses it automatically.
3. If not, the app asks the user to choose a budget group before saving.
4. The app creates a transaction history record.
5. The recurring item is marked as paid for the current month.
6. The chosen budget group balance is reduced.
7. The recurring list and history refresh.

### When the user edits or deletes a transaction

1. The app restores the previous budget-group effect before applying the new one.
2. The selected budget group is updated again for the edited record.
3. The history list and dashboard refresh.

---

## UI Plan

### Budget Selection in the Form

- Add a compact section under category/account selection.
- Use pill or segmented chips for the common groups.
- Keep the selector compact so it does not crowd the calculator area.

### Recurring Item Shortcut

- In the recurring list, keep the current action buttons but add a prominent `จ่ายแล้ว` shortcut.
- If the item already has a default budget group, the button can act immediately.
- If the item does not have a default budget group, the button opens a small chooser modal.

### History Rows

- Show budget group metadata as a small tag in the history row.
- The tag should be secondary to the category and amount.

---

## Backend / Sync

- Budget groups should be persisted per profile.
- The same profile-based storage pattern used for history and recurring items should be reused.
- The Apps Script backend should store budget group data in a dedicated sheet so it can be fetched and updated consistently.
- The Cloudflare Worker proxy stays unchanged and continues to forward requests between the frontend and Apps Script.

---

## Error Handling

- If a recurring item is paid without a selected budget group and no default exists, the app should stop and ask the user to choose one.
- If a budget group balance would go negative, the app should warn the user before saving.
- If a budget group has been archived, it should not appear in the default selector but should remain visible in history records.

---

## Testing Strategy

- Add unit tests for:
  - budget-group creation and nesting
  - recurring item quick-pay using its default budget group
  - transaction save/edit keeping budget balances consistent
  - fallback behavior when a recurring item has no default budget group
- Keep the existing tests for recurring storage, transaction save, OCR parsing, and render helpers.

---

## Implementation Boundaries

- Keep `app.js` as the wiring layer.
- Put budget-group logic into a focused service module instead of adding more shared state to `app.js`.
- Reuse the existing DOM helper patterns for safe rendering.
- Do not merge budget groups into categories or accounts; they are a separate concept.

---

## Open Questions

- Should budget groups be visible on the dashboard as cards, chips, or a dropdown?
- Should the app allow spending from a child group to also reduce the parent group automatically, or should the parent only be a summary?
- Should recurring items be able to point to a child group only, or may they point to either a parent or a child group?

