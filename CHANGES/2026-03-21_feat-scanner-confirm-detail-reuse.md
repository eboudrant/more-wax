# feat: scanner confirm view reuses detail layout, back-button fix

**Date:** 2026-03-21
**Type:** Feature / Bug Fix

## Intent

Improve the scanner add flow: reuse the collection detail page for the confirm view, fix back-button losing results, display full format info in search results, and fix dashboard recently added not updating after adding a record.

### Prompts summary

1. Fix back button losing search results after viewing a match detail
2. Display full release format info (e.g., "Vinyl, LP, Album, Black Clear Smoke") in results list
3. Reuse the collection detail page layout for the confirm view
4. Make the ADD button prominent and remove DELETE button from confirm view
5. Make cover image square instead of rectangular
6. Make bottom sheet full height on mobile
7. Fix X close button being oval instead of circular
8. Remove non-functional pull handle from sheet (triggers pull-to-refresh on mobile)
9. Fix recently added section not updating after adding a record

## Back-button fix (`add-modal.js`)

- Added `_sheetView` state tracking (`'results'` | `'confirm'`)
- Browser/phone back button on confirm view now returns to results list instead of closing the sheet entirely
- State is reset on sheet close

## Confirm view reuses detail layout (`add-modal.js`, `detail.js`)

- `showConfirmInSheet()` now calls `_renderPanelHtml()` from detail.js to render the full detail layout (cover, tags, price card, rating, tracklist, format details, identifiers, companies)
- Copy button and delete button are hidden when record has no collection `id` (not yet added)
- Snap cover / upload buttons and personal notes textarea remain below the detail panel
- "Add to Collection" button is full-width and prominent in the sticky footer
- "Back to results" link below

## Format display in results list (`add-modal.js`)

- `_buildFormatString()` already handles `formats` array from Discogs API
- Search results now show full format details (e.g., "Vinyl, LP, Album, Reissue")

## Sheet UI improvements (`add-modal.js`, `index.html`)

- Sheet uses `max-height: 100dvh` and opens at `translateY(0)` for full-height on mobile
- Removed pull handle bar and all drag-to-dismiss logic (prevented pull-to-refresh conflicts)
- Close button changed from `p-3` to `w-10 h-10` fixed dimensions for a perfect circle

## Dashboard fix (`add-modal.js`)

- Swapped order: `loadCollection()` now completes before `closeScanner()` so the dashboard re-renders with fresh data including the newly added record

## Tests updated (`views.spec.js`, `fixtures.js`)

- Added "confirm view shows detail layout with add button" test — verifies `.detail-panel`, `#save-btn`, and "Back to results" are present
- Added "back button returns to results list" test — verifies returning to results list with "Matches Found" header
- Updated Discogs release mock to return `discogs_release_full` shape (with `discogs_extra`, prices, rating)
- Updated search results mock to include `formats` array for format display
- Used fire-and-forget pattern for `scannerSelectRelease()` (async function)

## Files modified

| File | Change |
|------|--------|
| `static/js/add-modal.js` | Back-button state tracking, confirm view reuses `_renderPanelHtml`, full-height sheet, removed pull handle/drag, fixed save order, circular close button |
| `static/js/detail.js` | Skip copy button and delete button when `r.id` is missing |
| `static/index.html` | Sheet `max-height: 100dvh`, removed pull handle element |
| `tests/screenshots/views.spec.js` | Added confirm view and back-to-results tests |
| `tests/screenshots/fixtures.js` | Updated release mock shape, added `formats` to search results |
