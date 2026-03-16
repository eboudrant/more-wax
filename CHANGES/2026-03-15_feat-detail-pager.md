# feat(detail): swipe/keyboard pager navigation in detail modal

**Date:** 2026-03-15
**Branch:** main
**Type:** Feature

## Intent

User requested the ability to swipe left/right on the detail page to navigate between records, turning the detail modal into a pager. The navigation should respect the current sort and filter order of the gallery grid.

### Prompts summary

1. Add swipe left/right navigation to the detail modal so it acts as a pager through the collection, following the current gallery sort and filter order.
2. Remove the redundant close button from the modal footer since the header already has one.

## Changes

### `static/index.html`

Added navigation controls to the detail modal header:
- Previous/next arrow buttons (`#detail-prev`, `#detail-next`) using `bi-chevron-left` / `bi-chevron-right` icons, styled as ghost buttons.
- Position counter (`#detail-pos`) showing current index and total (e.g., "3 / 47").
- Buttons call `_navigateDetail(-1)` and `_navigateDetail(1)` on click.
- Removed the `modal-footer` with its redundant "Close" button (the header X button is sufficient).

### `static/js/detail.js`

Full rewrite to add pager navigation while preserving all existing functionality (price/rating refresh, card badge updates, delete confirmation).

**Navigation state:**
- `_detailList`: Snapshot of `sortedFiltered()` taken when the modal opens, so paging follows the same order as the gallery grid.
- `_detailIndex`: Current position within that list.
- `_detailSwipe`: Touch tracking state object (startX, startY, dx, swiping flag).

**`_updateDetailNav()`**: Updates the position counter text and disables prev/next buttons at boundaries (first/last record).

**`_navigateDetail(direction)`**: Core navigation function.
- Validates bounds (clamps, no wrap-around).
- Applies CSS slide-out animation (`detail-slide-out-left` or `detail-slide-out-right`, 150ms).
- After the slide-out completes, renders the new record via `_renderDetailBody()`, updates nav state, applies slide-in animation (`detail-slide-in-right` or `detail-slide-in-left`, 200ms).
- Triggers auto-refresh for prices/rating on the new record if any are missing.

**`showDetail(id)`** (updated):
- Snapshots `sortedFiltered()` into `_detailList` and finds current index.
- Falls back to a single-element list if the record isn't in the filtered set.
- Reuses existing Bootstrap Modal instance instead of always creating a new one (prevents stacking).
- Calls `_updateDetailNav()` to set initial position counter.
- Attaches keyboard and swipe listeners.

**Keyboard navigation:**
- `_detailKeyHandler(e)`: Listens for `ArrowLeft` (previous) and `ArrowRight` (next) while the modal is open.
- Attached on modal show, removed on `hidden.bs.modal` event.

**Touch / swipe navigation:**
- `_detailTouchStart(e)`: Records initial touch position (single finger only).
- `_detailTouchMove(e)`: Computes horizontal delta. Locks to horizontal swipe if `|dx| > |dy|` after 10px threshold — ignores vertical scroll gestures. Applies live `translateX()` transform for drag feedback. Dampens translation to 20% at boundaries (first/last record).
- `_detailTouchEnd()`: If `|dx| > 60px`, triggers navigation in the appropriate direction; otherwise snaps back by clearing the transform.

**`_attachDetailListeners(modalEl)`**: Manages listener lifecycle.
- Guards against double-attaching via `modalEl._detailListenersAttached` flag.
- Attaches keyboard listener to `document`, touch listeners to `#detail-body`.
- Registers a one-time `hidden.bs.modal` handler that removes all listeners and resets the flag.

### `static/styles.css`

**Detail nav controls:**
- `.detail-nav`: Flex container with gap, shrink-proof, right margin before the title.
- `.detail-nav .btn`: Compact padding for arrow buttons.
- `.detail-nav .btn:disabled`: 25% opacity, no pointer events.
- `.detail-nav-pos`: Small muted text, fixed min-width for stability, centered.
- `.modal-title`: Added `flex: 1; min-width: 0` so the title truncates instead of pushing nav off-screen.

**Slide animations (4 keyframes):**
- `slideOutLeft`: `translateX(0) → translateX(-40px)`, opacity 1 → 0, 150ms ease-in.
- `slideOutRight`: `translateX(0) → translateX(40px)`, opacity 1 → 0, 150ms ease-in.
- `slideInRight`: `translateX(40px) → translateX(0)`, opacity 0 → 1, 200ms ease-out.
- `slideInLeft`: `translateX(-40px) → translateX(0)`, opacity 0 → 1, 200ms ease-out.
- `#detail-body` has `will-change: transform, opacity` for GPU-accelerated transitions.

## Interaction model

| Input | Action |
|-------|--------|
| Tap `<` button | Navigate to previous record |
| Tap `>` button | Navigate to next record |
| Swipe left (>60px) | Navigate to next record |
| Swipe right (>60px) | Navigate to previous record |
| ArrowLeft key | Navigate to previous record |
| ArrowRight key | Navigate to next record |
| Swipe at boundary | Dampened drag feedback (20%), no navigation |
| Vertical scroll in modal | Not intercepted, normal scroll behavior |
