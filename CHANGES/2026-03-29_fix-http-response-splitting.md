# fix: HTTP response splitting in OAuth redirect (CodeQL #7)

**Date:** 2026-03-29
**Type:** Security

## Intent

CodeQL flagged the OAuth redirect `Location` header as vulnerable to HTTP response splitting — a malicious `Host` or `X-Forwarded-Host` header containing CR/LF characters could inject additional HTTP headers into the response.

### Prompts summary

1. Fix CodeQL alert #7 — HTTP response splitting in auth redirect

## Changes

### `server/auth.py`
- Added `_sanitize_header()` — strips `\r` and `\n` from any value before it enters an HTTP header
- `_get_redirect_uri()`: sanitizes both `proto` and `host` values extracted from request headers
- Proto validated against whitelist (`http`/`https` only) — unknown values fall back to server TLS state
- OAuth redirect URL sanitized with `_sanitize_header()` before `send_header("Location", ...)`

## Files modified

| File | Change |
|------|--------|
| `server/auth.py` | `_sanitize_header()`, proto whitelist, Location header sanitization |
