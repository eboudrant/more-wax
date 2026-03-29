# fix: defensive dict access to prevent KeyError crashes

**Date:** 2026-03-29
**Type:** Fix

## Intent

Audit and harden all dict key accesses on data from external sources (JSON files, API responses) to prevent KeyError crashes if fields are missing due to schema changes, external edits, or API response variations.

### Prompts summary

1. After finding the `next_id` KeyError bug, audit codebase for similar vulnerabilities

## Changes

Replaced unsafe `dict["key"]` accesses with context-appropriate patterns:
- **Required fields** (id, discogs_id): check for None, log warning, skip record
- **Security fields** (code_verifier): check for None, return error
- **Display fields** (artist name): `.get()` with fallback default
- **Cache fields** (expires_at): `.get()` defaulting to "expired" (safe behavior)

### `server/sync.py` (11 fixes)
- `r["discogs_id"]` → `r.get("discogs_id", "")` in dict comprehensions and loops
- `r["id"]` → `r.get("id", 0)` in `db_update` calls during backfill

### `server/auth.py` (4 fixes)
- `cached["expires_at"]` → `cached.get("expires_at", 0)` in session expiry check
- `pending["created_at"]` → `pending.get("created_at", 0)` in state TTL checks
- `pending["code_verifier"]` → `pending.get("code_verifier", "")` in token exchange

### `server/discogs.py` (2 fixes)
- `a["name"]` → `a.get("name", "Unknown")` on artist dicts from Discogs API

### `server/handler.py` (2 fixes)
- `r["discogs_id"]` and `r["id"]` → `.get()` in background price refresh loop

### `server/sync.py` — failed records tracking
- Records that can't be imported (missing `discogs_id`) are collected in a `failed` list
- `sync_get_state()` returns `failed` for client polling
- Completion log includes failed count

### `static/js/sync.js` — failed records UI + subtitle fix
- Completion screen shows list of failed records with artist and title
- "Download as JSON" button saves failed records to a file for debugging
- Fixed `esc()` escaping HTML in subtitle (broke `<br>`, `<span>`, `<ul>` rendering)

### Screenshot tests
- Added `mockSyncWithFailed` fixture simulating import with 2 failed records
- Added `sync-failed.png` baseline (mobile + desktop) showing failed records list with download button

## Files modified

| File | Change |
|------|--------|
| `server/sync.py` | Defensive access + failed records tracking |
| `server/auth.py` | Defensive access on session fields |
| `server/discogs.py` | Defensive access on artist names |
| `server/handler.py` | Defensive access in price refresh |
| `static/js/sync.js` | Failed records display + JSON download + subtitle esc fix |
| `tests/screenshots/fixtures.js` | `mockSyncWithFailed` fixture |
| `tests/screenshots/views.spec.js` | Sync failed screenshot test |
