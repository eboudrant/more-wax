# feat: backend for listen events

**Date:** 2026-04-20
**Type:** Feature

## Intent

First phase of the Listens feature — a way to log each time you play a record. This PR ships the storage layer and REST endpoints; frontend integration (detail panel, dashboard button) follows in subsequent PRs.

### Prompts summary

1. Kick off a "listening session" feature to track plays, reusing the scanner entry later. Split backend into its own PR.
2. Confirm v1 decisions: dedicated "Now Playing" button on dashboard (not a scanner sub-mode), listen badges in detail only, cascade listen deletion when a record is removed.

## Changes

### `server/config.py`
- Added `LISTENS_FILE = DATA_DIR / "listens.json"`.

### `server/listens.py` (new)
- Thread-safe store mirroring `server/database.py` conventions (file lock, atomic write via tmp + rename, schema-versioned payload).
- Schema 1.0: `{"schema_version", "listens", "next_id"}`. Each listen: `{"id", "record_id", "listened_at"}` (ISO8601 UTC).
- Public API:
  - `listens_list(record_id=None)` — newest first, optional filter.
  - `listens_add(record_id)` — appends with server-side timestamp, returns the new row.
  - `listens_delete(listen_id)` — removes one.
  - `listens_delete_for_record(record_id)` — cascade for record deletion, returns count.

### `server/handler.py`
- `GET /api/listens[?record_id=N]` → list (400 on non-integer filter).
- `POST /api/listens` body `{record_id}` → 201 with new row, 400 if `record_id` missing/non-int, 404 if the record doesn't exist.
- `DELETE /api/listens/:id` → `{success: bool}`.
- `DELETE /api/collection/:id` now cascades to `listens_delete_for_record` after a successful record delete.

### `tests/test_listens.py` (new)
- 11 unit tests: add/list ordering, filter, auto-increment, delete, cascade, persistence.

## Files modified

| File | Change |
|------|--------|
| `server/config.py` | Added `LISTENS_FILE` path |
| `server/listens.py` | New thread-safe listens store |
| `server/handler.py` | New listens endpoints + cascade on record delete |
| `tests/test_listens.py` | Unit tests for the listens store |
