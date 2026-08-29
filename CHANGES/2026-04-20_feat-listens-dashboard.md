# feat: Now Playing button + picker + Recent Listens strip on dashboard

**Date:** 2026-04-20
**Type:** Feature

## Intent

Phase 3 (final) of the Listens feature. The dashboard now has the **primary** entry point for logging a listen: a "Now Playing" call-to-action that opens a record picker. Below it, a small cover strip shows the most recent listens across the collection. Depends on the backend in PR #104 and the detail-panel section in PR #105.

### Prompts summary

1. Build the dashboard side of the Listens feature. Entry point: a dedicated "Now Playing" button (not a scanner sub-mode).
2. Required: Playwright screenshot tests + (when Chrome MCP is reachable) interactive verification.
3. No auto-merge — UI PR, user wants to review.

## Changes

### `static/index.html`
- New `<section id="dash-now-playing-section">` inserted above `dash-picks-section`: a full-width primary button, and a "Recent Listens" strip (`#dash-recent-listens`).
- New `<div id="picker-modal">` at the modal collection: title, filter input, responsive grid (`#picker-grid`).

### `static/js/dashboard.js`
- `renderDashboard()`: added `dash-now-playing-section` to the show/hide set and calls `_renderRecentListens()`.
- `_renderRecentListens()`: GETs `/api/listens`, joins with local `collection`, renders up to 8 covers. Shows an empty-state message when there are no listens.
- `openNowPlayingPicker()`, `_pickerFilterChanged()`, `_renderPickerGrid(q)`: open the modal, render a 2-/3-column grid of records, support client-side substring filter on title/artist/label.
- `_pickerLog(recordId)`: POST `/api/listens`, close the modal, toast the logged title, re-render the recent strip.

### `static/locales/{en,ja,fr,de}.json`
- 9 new keys: `dash.nowPlaying.title`, `.btn`, `dash.recentListens.title`, `.empty`, `picker.title`, `.placeholder`, `.noResults`, `.logged`, `.logError`.

### `tests/screenshots/fixtures.js`
- Extended `/api/listens` mock: GET without `record_id` now returns the flattened listens list, newest first, so the Recent Listens strip populates in tests.

### `tests/screenshots/views.spec.js`
- `Dashboard › now playing section shows button and recent listens` — asserts the section renders and covers populate.
- `Dashboard › picker modal opens with collection grid` — clicks the Now Playing button, snapshots the modal.

### `tests/screenshots/{desktop,mobile}/*.png`
- Regenerated `dashboard.png`, `dashboard-empty.png`, and several setup-wizard baselines (the new section shifts the underlying dashboard page).
- New baselines: `dashboard-now-playing.png`, `picker-modal.png`.

## Verification

- **Playwright (Docker):** `npm run test:screenshots` → 73 passed, 3 skipped. Covers: section visibility, button label, recent covers populated, picker opens, collection grid renders.
- **Chrome MCP:** Attempted against a seeded `localhost:9769` dev backend but blocked by a local Chrome enterprise policy error for every `http://localhost:*` and `http://127.0.0.1:*` navigation in this session — could not run. The picker + recent strip are covered by the Playwright screenshots above; eyeball review welcome.

## Files modified

| File | Change |
|------|--------|
| `static/index.html` | Now Playing section + picker modal markup |
| `static/js/dashboard.js` | Render recent listens; picker open/filter/log |
| `static/locales/en.json` | 9 new keys |
| `static/locales/fr.json` | 9 new keys |
| `static/locales/de.json` | 9 new keys |
| `static/locales/ja.json` | 9 new keys |
| `tests/screenshots/fixtures.js` | Unfiltered `/api/listens` GET returns flattened list |
| `tests/screenshots/views.spec.js` | 2 new dashboard tests |
| `tests/screenshots/{desktop,mobile}/dashboard{,-empty,-now-playing}.png` | Regenerated / new baselines |
| `tests/screenshots/{desktop,mobile}/picker-modal.png` | New baseline |
| `tests/screenshots/{desktop,mobile}/setup-wizard-*.png` | Regenerated baselines (underlying dashboard shifted) |
