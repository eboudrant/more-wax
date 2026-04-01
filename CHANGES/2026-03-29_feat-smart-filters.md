# feat: smart filters with autocomplete in collection search

**Date:** 2026-03-29
**Type:** Feature

## Intent

Add quick-access filters for common collection cleanup tasks. Instead of cluttering the UI with filter chips, smart filters are accessed by typing `is:` in the filter input, showing an autocomplete dropdown.

### Prompts summary

1. Add smart filters for missing tracklist, missing cover, no rating, no price, duplicates
2. Use keyword autocomplete instead of UI chips to avoid cluttering the interface

## Changes

### `static/js/collection.js`
- Added `SMART_FILTERS` array with 5 filters: `is:missing-tracklist`, `is:missing-cover`, `is:no-rating`, `is:no-price`, `is:duplicate`
- Each filter has a key, label, and filter function
- `_showSmartSuggestions(inputEl)` renders a dropdown below the filter input with matching filters and live counts
- `_hideSmartSuggestions()` removes the dropdown
- `sortedFiltered()` checks for smart filter prefix before falling back to text search
- `is:duplicate` detects records sharing the same `master_id`

### `static/index.html`
- Filter input placeholder updated to "Filter… (try is:)"
- Added `oninput`/`onblur`/`onfocus` handlers for smart filter autocomplete
- Added `autocomplete="off"` to prevent browser interfering with the dropdown

## Files modified

| File | Change |
|------|--------|
| `static/js/collection.js` | Smart filters logic, autocomplete dropdown |
| `static/index.html` | Filter input handlers, placeholder hint |
