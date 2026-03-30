# fix: security hardening from code review

**Date:** 2026-03-29
**Type:** Security

## Intent

Comprehensive security review found several issues: directory serving without file-type check, injectable Cf-Visitor header parsing, missing IPv6 private range detection, and non-atomic config writes.

### Prompts summary

1. Review all security-related code for bugs and opportunities to improve
2. Fix send_file() to reject non-files (directories, devices)
3. Parse Cf-Visitor header with json.loads instead of string splitting
4. Add IPv6 private ranges to _is_private_ip (fc00::/7, fe80::/10, IPv4-mapped)
5. Make save_token() atomic with temp file + rename
6. Clean up test formatting

## Changes

### `server/handler.py`
- `send_file()`: added `path.is_file()` check before reading — prevents serving directories or special files
- `_is_private_ip()`: added IPv6 support — Unique Local (`fc00::/7`), Link-Local (`fe80::/10`), IPv4-mapped (`::ffff:`), bracketed `[::1]`

### `server/auth.py`
- `_get_redirect_uri()`: replaced string split parsing of `Cf-Visitor` header with `json.loads()` — prevents header injection attacks that could manipulate OAuth redirect URIs

### `server/config.py`
- `save_token()`: atomic write using `tempfile.mkstemp()` + `os.fchmod(0o600)` + `os.replace()` — eliminates the permission race window between write and chmod

### `server/images.py`
- Cleaned up comments referencing old sanitization approach

### Tests
- Added `TestPrivateIp`: 16 tests covering IPv4 private ranges, IPv6 loopback, Unique Local, Link-Local, IPv4-mapped, public addresses, bracketed notation
- Added `_safe_resolve` edge cases: empty path, dot-only, backslash traversal
- Cleaned up unnecessary blank lines in test_images.py

## Files modified

| File | Change |
|------|--------|
| `server/handler.py` | `send_file()` is_file check, IPv6 in `_is_private_ip` |
| `server/auth.py` | JSON parsing for Cf-Visitor header |
| `server/config.py` | Atomic file write for env values |
| `tests/test_handler.py` | 16 IPv6 tests, 3 path edge case tests |
| `tests/test_images.py` | Formatting cleanup |
