# fix: audit log shows real client IP behind reverse proxy

**Date:** 2026-03-25
**Type:** Fix

## Intent

The audit log was recording `127.0.0.1` for all requests routed through Cloudflare Tunnel instead of the actual client IP.

### Prompts summary

1. Audit log shows 127.0.0.1 instead of real IP when behind Cloudflare Tunnel

## Changes

### `server/auth.py`
- Added `_get_client_ip(handler)` helper that reads `Cf-Connecting-Ip` or `X-Forwarded-For` headers, falling back to `client_address[0]`
- `handle_callback` and `handle_logout` now use the helper instead of `handler.client_address[0]`

## Files modified

| File | Change |
|------|--------|
| `server/auth.py` | Real client IP extraction from proxy headers |
