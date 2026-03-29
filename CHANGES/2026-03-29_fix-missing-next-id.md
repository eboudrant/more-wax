# fix: crash when adding record due to missing next_id

**Date:** 2026-03-29
**Type:** Fix

## Intent

Fix a 502 error when saving a record to the collection caused by a missing `next_id` field in `collection.json`.

### Prompts summary

1. 502 error when adding a record in production — `KeyError: 'next_id'`

## Root cause

The `collection.json` file was missing the `next_id` field, likely caused by a sync import or external edit. The `_db_add_unlocked` function accessed `data["next_id"]` without checking if the key existed.

## Fix (`server/database.py`)

- `_load()` now ensures `next_id` exists on every load — recomputes from the highest existing record ID if missing, and saves the recovered value
- `_db_add_unlocked()` has the same safety check as a belt-and-suspenders fallback
- Both compute `max(existing_ids) + 1`, or `1` for an empty collection

## Tests (`tests/test_database.py`)

- `test_missing_next_id_recovered_on_load` — DB file without `next_id` auto-recovers
- `test_missing_next_id_empty_records` — empty records starts at 1
- `test_next_id_persisted_after_recovery` — recovered value saved to disk

## Files modified

| File | Change |
|------|--------|
| `server/database.py` | Auto-recover missing `next_id` on load and add |
| `tests/test_database.py` | 3 new tests for `next_id` recovery |
