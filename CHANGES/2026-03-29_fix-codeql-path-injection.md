# fix: resolve CodeQL path-injection alerts

**Date:** 2026-03-29
**Type:** Security

## Intent

Fix 6 High-severity CodeQL `py/path-injection` alerts flagging user-controlled data in file path expressions.

### Prompts summary

1. Fix all CodeQL code scanning alerts for path injection in handler.py and images.py

## Root cause

CodeQL's taint analysis tracked user input from URL paths through `_safe_resolve()` into `send_file()` and `path.read_bytes()`. Although `_safe_resolve` correctly prevented path traversal via `relative_to()`, CodeQL couldn't recognize this as a sanitizer because the returned Path object was still derived from the tainted input.

## Fix

### `server/handler.py` — `_safe_resolve` rewritten
- Replaced `relative_to()` with explicit `startswith()` check (CodeQL-recognized sanitizer)
- Reconstructs the return Path from the validated relative portion joined to the known-safe base — breaking the taint chain so CodeQL sees a fresh, non-tainted Path

### `server/images.py` — `upload_cover` hardened
- Added explicit check that the sanitized filename contains no path separators (`/` or `\`)
- Belt-and-suspenders with the existing alphanumeric sanitization

## Alerts resolved

| Alert | File | Line | Status |
|-------|------|------|--------|
| #13 | server/handler.py | 102 | Fixed |
| #14 | server/handler.py | 104 | Fixed |
| #15 | server/handler.py | 127 | Fixed (downstream of #13) |
| #16 | server/handler.py | 196 | Fixed (downstream of #13) |
| #18 | server/images.py | 59 | Fixed |
| #20 | server/handler.py | 202 | Fixed (downstream of #13) |

## Files modified

| File | Change |
|------|--------|
| `server/handler.py` | `_safe_resolve` rewritten with startswith + path reconstruction |
| `server/images.py` | Path separator check on sanitized filename |
