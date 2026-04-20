# feat: Listens section in the detail panel

**Date:** 2026-04-20
**Type:** Feature

## Intent

Phase 2 of the Listens feature. Surface the listen history for a record inside the detail modal — pluralized count, last 5 timestamps (locale-aware, UTC-safe), a "Log a listen" button, and a per-row delete. Backend endpoints from PR #104.

### Prompts summary

1. Build the detail-panel side of the Listens feature. Reuse existing `apiGet`/`apiPost`/`apiDelete` helpers. Render the section between Notes and the Discogs extras block. Load data lazily after render.
2. Required: a Playwright screenshot test for the populated section, plus interactive verification via Chrome MCP against a real dev backend (empty state, populated state, log + delete, locale switch, cascade delete).

## Changes

### `static/js/detail.js`
- Inserted a slot (`<div id="detail-listens-${r.id}">`) between Notes and the Discogs extras block in `_renderPanelHtml` (non-peek only — prev/next peek panels don't load listens to avoid extra API calls).
- Added `_renderListensSection(r, listens)` — header, pluralized count badge, list of up to 5 timestamps, per-row delete, "Log a listen" button.
- Added `_formatListenTime(iso)` using `Intl.DateTimeFormat(getLocale(), {dateStyle: 'medium', timeStyle: 'short'})` with a fallback to the raw ISO string.
- Added `_loadListensForDetail`, `_logListenForDetail`, `_deleteListenForDetail` — all re-render the section in place on success.
- Hooked `_loadListensForDetail(r)` into `_renderDetailBody` so the section repopulates on initial open, swipe-nav, and the locale-changed re-render shipped in PR #103.

### `static/locales/{en,ja,fr,de}.json`
- Added 9 keys: `detail.listens.title`, `.empty`, `.count` (plural), `.logBtn`, `.delete`, `.logged`, `.logError`, `.loadError`, `.deleteError`.

### `tests/screenshots/fixtures.js`
- Added `/api/listens` mock: GET returns three fixed-timestamp rows for record 1 (empty for others), POST returns a deterministic 201 row, DELETE returns `{success: true}`.

### `tests/screenshots/views.spec.js`
- New "Detail Modal › listens section shows history and log button" test asserts the section is visible, lists 3 rows, contains "Log a listen", and snapshots the section.

### `tests/screenshots/{desktop,mobile}/detail-{modal,liked-tracks,listens}.png`
- `detail-modal.png` and `detail-liked-tracks.png` regenerated (now contain the Listens section).
- `detail-listens.png` is new.

### `playwright.config.js`
- Pinned `timezoneId: 'UTC'` and `locale: 'en-US'` so `Intl.DateTimeFormat` output is byte-stable across dev machines and CI (Docker containers default to UTC; explicit pin prevents drift).

## Manual verification (Chrome MCP)

Against a dev backend at `localhost:9769` with a seeded record:

| Scenario | Result |
|---|---|
| Section renders with 2 existing listens | ✓ Header, badge "2 listens", formatted timestamps, Log button |
| Click "Log a listen" | ✓ Count → 3, new timestamp prepended |
| Click row delete icon | ✓ Count → 2, row removed |
| `setLocale('fr')` with section open | ✓ Header → "Écoutes", badge → "2 écoutes", button → "Ajouter une écoute" |
| Record with zero listens | ✓ No list rendered, badge reads "Never played", Log button present |
| `DELETE /api/collection/:id` | ✓ Cascaded — `GET /api/listens?record_id=X` returns `[]` after |

## Files modified

| File | Change |
|------|--------|
| `static/js/detail.js` | Render + load + log + delete for the Listens section |
| `static/locales/en.json` | 9 new keys |
| `static/locales/fr.json` | 9 new keys |
| `static/locales/de.json` | 9 new keys |
| `static/locales/ja.json` | 9 new keys |
| `tests/screenshots/fixtures.js` | Mock `/api/listens` (GET / POST / DELETE) |
| `tests/screenshots/views.spec.js` | New listens-section test |
| `tests/screenshots/{desktop,mobile}/detail-modal.png` | Regenerated baseline |
| `tests/screenshots/{desktop,mobile}/detail-liked-tracks.png` | Regenerated baseline |
| `tests/screenshots/{desktop,mobile}/detail-listens.png` | New baseline |
| `playwright.config.js` | Pin timezone + locale for deterministic snapshots |
