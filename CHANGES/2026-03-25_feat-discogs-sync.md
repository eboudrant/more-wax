# feat: Discogs collection sync + source tracking + collection toggle

**Date:** 2026-03-25
**Type:** Feature

## Intent

Import records from the user's Discogs collection that aren't in More'Wax yet. One-way sync with a review UI where the user selects which records to import. Duplicate pressings are detected via master_id matching (same album, different pressing) and fuzzy artist+title fallback. Also tracks how each record was added and allows adding/removing records from the Discogs collection directly from the detail view.

### Prompts summary

1. Sync data with Discogs — import titles on Discogs but not scanned in More'Wax
2. Track source of each record (barcode, photo, search, discogs_sync)
3. Review and select which records to import, with duplicate detection
4. Use master_id for accurate duplicate pressing detection
5. Backfill master_id on startup (collection API bulk + individual release fallback)
6. Allow user to skip, keep both, or replace duplicate pressings
7. Add/remove from Discogs collection button in detail view
8. Group Discogs settings together in settings modal
9. Show sync readiness status in settings
10. Bug fixes: race conditions, input validation, XSS, stale DOM updates

## Changes

### `server/database.py`
- Schema migration framework: `_migrate()` runs migrations in order
- Migration 1.0 → 1.1: adds `add_source = "barcode"` to all existing records
- `CURRENT_SCHEMA = "1.1"` constant

### `server/discogs.py`
- `discogs_fetch_collection()`: paginates through user's Discogs collection with `master_id`
- `discogs_check_collection()`: checks if a release is in the user's collection
- `discogs_remove_from_collection()`: removes a release by instance_id
- `discogs_release_full()`: now returns `master_id`
- `_discogs_request()`: handles empty response bodies (204 No Content)

### `server/sync.py` (new)
- Thread-safe sync state machine with `_sync_lock`
- `backfill_master_ids()`: startup background job — bulk via collection API, individual release fallback
- `sync_start_fetch()`: fetches collection, backfills master_ids, computes diff with duplicate detection (master_id + fuzzy name)
- `sync_start_import()`: atomic duplicate check + add under DB lock, deep-copies diff data, clears diff after import, normalizes input types
- `sync_get_state()`: returns status without diff (too large for polling)

### `server/handler.py`
- Sync routes: `POST /api/sync/fetch`, `GET /api/sync/status`, `POST /api/sync/import`
- Collection routes: `GET /api/discogs/in-collection/{id}`, `DELETE /api/discogs/collection/{id}`
- Added `add_source` and `master_id` to allowed fields in `_api_add`
- Input validation on sync import (list type check, string normalization)
- Settings endpoint: `sync_missing_master_ids` count

### `server.py`
- Startup: chains `discogs_fetch_identity` → `backfill_master_ids` in background thread

### `static/js/sync.js` (new)
- Full-screen sync overlay: fetching → diff review → importing → complete
- New records section with select all / deselect all
- Duplicate section with expand/compare, skip/keep both/replace actions
- Discogs links on all items (new and duplicate)
- XSS-safe: all user data escaped

### `static/js/detail.js`
- Discogs collection toggle button (+/- icon) with async check on open
- `_discogsCollectionState` cache, stale-safe DOM updates via `data-discogs-id`
- Source tag display (barcode, photo, search, synced)
- Toggle button only on main panel (not peek panels)
- Server confirmation before showing toast

### `static/js/add-modal.js`
- Sets `add_source` based on scanner mode

### `static/js/settings.js`
- Grouped Discogs settings (token, format filter, import)
- Sync readiness status (missing master_ids count)

### `static/index.html`
- Sync overlay HTML, settings restructured (Discogs → Claude AI → Auth → Data)
- `sync.js` script tag

### `tests/test_sync.py` (new)
- 16 unit tests: diff computation, duplicate detection (master_id + fuzzy), import, replace, skip, concurrent rejection, input normalization, schema migration

## Files modified

| File | Change |
|------|--------|
| `server/database.py` | Schema migration 1.0 → 1.1, add_source field |
| `server/discogs.py` | Collection fetch, check, remove, master_id, empty body handling |
| `server/sync.py` | New — sync state machine, backfill, import with race condition fixes |
| `server/handler.py` | Sync + collection routes, input validation, settings |
| `server.py` | Startup backfill thread |
| `static/js/sync.js` | New — sync overlay UI with duplicate handling |
| `static/js/detail.js` | Discogs toggle button, source tag |
| `static/js/add-modal.js` | Set add_source on save |
| `static/js/settings.js` | Grouped Discogs settings, sync status |
| `static/index.html` | Sync overlay, restructured settings |
| `tests/test_sync.py` | New — 16 unit tests for sync module |
| `tests/screenshots/` | Updated baselines (settings, sync diff/complete/in-sync) |
