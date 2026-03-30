# feat: UX polish — title tap, scrim close, search clear

**Date:** 2026-03-29
**Type:** Enhancement

## Intent

Small UX improvements for smoother navigation and interaction.

### Prompts summary

1. Click More'Wax title to scroll to top or go home
2. Click scrim (outside modal) to close detail and settings modals
3. Clear home search field when navigating to collection
4. Add X button to clear collection filter

## Changes

### `static/js/router.js`
- Added `_titleTap()` — if scrolled down, smooth scroll to top; if at top, navigate to dashboard

### `static/js/modal.js`
- Added scrim click handler — clicking outside the dialog (on the overlay area) closes the modal
- Respects `staticBackdrop` option (auth confirm dialog stays open)
- Handler cleaned up on modal hide

### `static/index.html`
- Title div gets `cursor-pointer` and `onclick="_titleTap()"`
- Home search clears after transferring value to collection filter
- Collection filter has an X clear button (appears when text is present, hidden when empty)

### Screenshot tests
- Added `collection-filtered.png` baseline (mobile + desktop) showing filter with text and X clear button

## Files modified

| File | Change |
|------|--------|
| `static/js/router.js` | `_titleTap()` scroll-to-top or go home |
| `static/js/modal.js` | Scrim click to close modals |
| `static/index.html` | Title tap, search clear, filter X button |
| `tests/screenshots/views.spec.js` | Filter with clear button test |
| `tests/screenshots/*/collection-filtered.png` | New baselines |
