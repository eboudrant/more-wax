# fix: iterdir-based path resolution to satisfy CodeQL taint analysis

**Date:** 2026-03-29
**Type:** Security

## Intent

Previous fixes still flagged by CodeQL because user-provided strings flowed into `Path()` constructors. Rewritten to walk the directory tree using only trusted `iterdir()` entries and a whitelist of allowed base directories.

### Prompts summary

1. CodeQL alerts #22, #23 still appearing — `base` parameter flagged as tainted
2. Rewrite to never pass user input to Path constructors — use iterdir to find files by matching entry names

## Changes

### `server/handler.py` — `_safe_resolve` rewritten (v3)
- Added `_ALLOWED_BASES` class dict mapping string keys to trusted resolved Paths
- `_safe_resolve(base_key: str, untrusted: str)` — accepts a key, not a Path
- String-level rejection of `..`, absolute paths
- Walks the directory tree segment-by-segment using `iterdir()` — only `entry.name` string comparison, no Path construction from user input
- Final `relative_to()` containment check on trusted-only Paths
- Callers pass `"static"` or `"data"` instead of `STATIC_DIR` / `DATA_DIR`

### `server/images.py` — digit-only sanitization
- `safe_id` now allows only digits (not alphanumeric)
- Containment check: `dest_path.resolve()` must start with `COVERS_DIR.resolve()`

### Tests updated
- `TestSafeResolve`: registers temp dir in `_ALLOWED_BASES`, passes string key
- `TestUploadCoverPaths`: uses `mock.patch("server.images.COVERS_DIR", tmp_dir)` for proper `.resolve()` support
- `test_record_id_sanitised`: updated for digit-only sanitization
- `test_tmp_record_skips_db_update`: non-numeric IDs default to `"0"`

## Files modified

| File | Change |
|------|--------|
| `server/handler.py` | `_safe_resolve` v3 — iterdir walk + allowed bases whitelist |
| `server/images.py` | Digit-only record ID, containment check |
| `tests/test_handler.py` | Updated `_safe_resolve` tests for new API |
| `tests/test_images.py` | Updated cover upload tests for new sanitization |
