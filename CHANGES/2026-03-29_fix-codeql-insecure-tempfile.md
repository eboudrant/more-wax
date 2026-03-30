# fix: replace insecure mktemp with mkstemp in tests

**Date:** 2026-03-29
**Type:** Security

## Intent

Fix 3 High-severity CodeQL `py/insecure-temporary-file` alerts in test_sync.py.

### Prompts summary

1. Fix CodeQL insecure temporary file alerts in tests

## Root cause

`tempfile.mktemp()` generates a filename without creating the file, leaving a window where another process could create a file with that name (TOCTOU race condition).

## Fix

### `tests/test_sync.py`
- Replaced all 3 `tempfile.mktemp()` calls with `tempfile.mkstemp()` + `os.close(fd)`
- `mkstemp` atomically creates the file, eliminating the race condition
- Added `import os`

## Alerts resolved

| Alert | File | Line |
|-------|------|------|
| #10 | tests/test_sync.py | 20 |
| #11 | tests/test_sync.py | 504 |
| #12 | tests/test_sync.py | 764 |

## Files modified

| File | Change |
|------|--------|
| `tests/test_sync.py` | `mktemp` → `mkstemp` (3 occurrences) |
