# Mobile Add Page Scroll Design

**Goal:** Fix the mobile `บันทึกรายการ` page so it always fits the visible viewport, does not show scrollbars, and only allows scrolling inside specific option blocks that may overflow, such as category and selection grids.

**Architecture:** Keep the existing single-page mobile shell and viewport-metric system, but change the add-page layout contract. The page container remains locked to the viewport height, the overall add form stops acting as a scroll container, and only selected sub-sections become bounded internal scroll regions on mobile.

**Tech Stack:** Vanilla JavaScript ES modules, Vite, static `index.html`, responsive CSS in `style.css`, existing viewport syncing in `app.js`.

---

## Problem Statement

The current mobile add page uses multiple nested `overflow: hidden` and `overflow-y: auto` containers. Right now `#tx-form-body` is the main scroll container for the form. That causes two UX problems:

1. The page behavior does not match the intended mobile interaction.
2. The user cannot reliably scroll the specific selection area they expect on some mobile viewport sizes.

The desired interaction is:

- the add page should still fill the visible mobile screen,
- the page should not expose browser scrollbars,
- the full form should not become the main scrolling surface,
- and only specific option blocks should scroll when their content exceeds the available space.

---

## Proposed UX

### Page-Level Behavior

- The add page remains pinned to the mobile viewport height derived from the existing `visualViewport` logic.
- The overall mobile shell, main content area, and add page keep document scrolling disabled on mobile.
- The add page content is laid out so core fields remain visible without requiring the user to scroll the whole form.

### Scroll Behavior

- `#tx-form-body` no longer scrolls on mobile.
- Scroll is moved to bounded option blocks only.
- These blocks should hide visible scrollbars while still supporting touch scroll.
- Each scrollable block must support momentum scrolling on iOS and normal touch scrolling on Android.

### Target Scroll Regions

The initial mobile scrollable regions should be:

- `#category-grid`
- `#account-grid`
- `#tx-budget-group-grid`

If one of these blocks does not overflow in a given state, it should behave like a normal static block.

---

## Layout Plan

### Mobile Container Contract

- Keep `#page-add` fixed to the computed add-page height.
- Keep `#tx-options-card` as a non-page-scrolling flex container.
- Remove mobile scrolling responsibility from `#tx-form-body`.

### Content Distribution

- Preserve the current top summary/input area as fixed-height content within the add page.
- Preserve the save button as part of the normal add-page layout, not as a sticky global footer.
- Allocate the remaining space to the option area, but only allow the option grids themselves to scroll.

### Scroll Block Sizing

- Each target scroll region gets a bounded mobile height or max-height.
- Heights should be based on available layout space, not hard-coded to one phone size.
- Use compact but readable spacing so more content fits before scrolling is needed.

---

## CSS / DOM Change Plan

### CSS Changes

- Remove `overflow-y: auto` from mobile `#tx-form-body`.
- Keep page-level mobile `overflow: hidden` on the shell and add-page frame.
- Add reusable mobile styles for internal scroll regions:
  - `overflow-y: auto`
  - hidden scrollbar styling
  - `-webkit-overflow-scrolling: touch`
  - bounded `max-height` / `min-height: 0` behavior for flex layouts

### Markup Adjustments

- Keep the existing section structure if possible.
- If needed, wrap each target grid in a small container that can receive scroll sizing without affecting headings or labels.
- Avoid broad HTML restructuring unless CSS alone cannot produce stable behavior.

### JavaScript Impact

- Reuse the current viewport metric sync in `app.js`.
- No new scroll management logic should be required unless layout measurement proves necessary after CSS changes.
- Page switching logic should continue to mark `body.is-add-page`, but the add-page overflow model will be updated to reflect the new CSS contract.

---

## Error Handling and Edge Cases

- When the on-screen keyboard opens, the add page should continue using the visible viewport height already computed by `syncViewportMetrics()`.
- If a target option section has very little content, it must not reserve awkward empty space just to preserve a scroll area.
- If categories, accounts, or budget groups grow unusually large, the containing block should stay usable without breaking the save button or top summary area out of the viewport.

---

## Testing Strategy

- Verify the add page on narrow and short mobile viewport sizes.
- Verify that the page itself does not scroll on mobile.
- Verify that category, account, and budget-group blocks can scroll independently when overflowing.
- Verify that scrollbars remain visually hidden while touch scrolling still works.
- Verify that switching away from and back to the add page still resets the main content position correctly and does not trap scroll focus.

---

## Implementation Boundaries

- Keep the change focused on the mobile add-page layout.
- Do not redesign desktop behavior unless a shared selector needs safe responsive adjustments.
- Do not add new dependencies.
- Prefer CSS-first changes and only add JavaScript if viewport-driven sizing cannot be achieved cleanly with the existing structure.
