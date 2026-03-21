# feat: automatic HTTP→HTTPS redirect for remote clients

**Date:** 2026-03-21
**Type:** Feature

## Intent

When accessing More'Wax from a phone or other device on the network, automatically redirect HTTP requests to HTTPS so users don't need to remember the HTTPS URL.

### Prompts summary

1. Automatically redirect HTTP to HTTPS when the request comes from a non-localhost client

## HTTP→HTTPS redirect (`server.py`)

- Added `_HttpsRedirectHandler` that subclasses `Handler`
- Non-localhost requests are redirected: GET → 301, POST/PUT/DELETE/OPTIONS → 308 (preserves HTTP method)
- Localhost and 127.0.0.1 requests pass through to `Handler` and are served normally
- Only active when HTTPS server starts successfully; otherwise HTTP serves with plain `Handler`
- `main()` sets the redirect handler's HTTPS port dynamically from environment config

## Files modified

| File | Change |
|------|--------|
| `server.py` | Added `_HttpsRedirectHandler` subclass of `Handler`, updated `main()` to use it when HTTPS is available |
