# fix: enforce minimum TLS 1.2 for HTTPS server

**Date:** 2026-03-29
**Type:** Security

## Intent

Fix CodeQL `py/insecure-protocol` alert #9 flagging potential use of insecure TLS versions.

### Prompts summary

1. Fix CodeQL "Use of insecure SSL/TLS version" alert in server.py

## Fix

### `server.py`
- Added `ctx.minimum_version = ssl.TLSVersion.TLSv1_2` to the HTTPS server SSL context
- Ensures TLS 1.0 and 1.1 (both deprecated) are never negotiated

## Files modified

| File | Change |
|------|--------|
| `server.py` | Explicit TLS 1.2 minimum version on SSL context |
