# feat: smart filters with inline ghost text in collection search

**Date:** 2026-03-29
**Type:** Feature

## Intent

Add quick-access filters for common collection cleanup tasks. Typing `is:` in the filter shows an inline ghost suggestion (like Gmail search) that can be accepted with Tab, plus a subtle dropdown listing all available filters with live counts.

### Prompts summary

1. Add smart filters for missing tracklist, missing cover, no rating, no price, duplicates
2. Use inline ghost text with Tab completion instead of UI chips
3. Add subtle dropdown showing all options with counts
4. Monospace font when smart filter is active
5. Only highlight the hovered dropdown item

## Changes

### `static/js/collection.js`
- Added `SMART_FILTERS` array with 5 filters: `is:missing-tracklist`, `is:missing-cover`, `is:no-rating`, `is:no-price`, `is:duplicate`
- `_updateSmartHint()` renders inline ghost text after the cursor showing the first matching filter
- `_smartFilterTab()` accepts the ghost suggestion on Tab keypress
- `_showSmartDropdown()` / `_hideSmartDropdown()` render a subtle dropdown below the input with all matching filters and live counts
- `_updateSmartFont()` toggles monospace font on the input when typing/selecting a smart filter
- `sortedFiltered()` checks for smart filter prefix before falling back to text search
- `is:duplicate` detects records sharing the same `master_id`

### `static/index.html`
- Filter input handlers: `oninput` updates ghost hint + dropdown, `onkeydown` handles Tab completion, `onblur` hides hint + dropdown
- `autocomplete="off"` to prevent browser interfering

### `static/styles.css`
- `.smart-filter-item` — dim by default (`#4e453c`), gold on hover (`#fddcb1`)

### Screenshot tests
- Added `collection-smart-filter.png` baseline (mobile + desktop) showing dropdown with smart filter options and counts

## Files modified

| File | Change |
|------|--------|
| `static/js/collection.js` | Smart filters, ghost text, dropdown, monospace toggle |
| `static/index.html` | Filter input event handlers |
| `static/styles.css` | Dropdown item hover styling |
| `tests/screenshots/views.spec.js` | Smart filter dropdown test |
| `tests/screenshots/*/collection-smart-filter.png` | New baselines |
