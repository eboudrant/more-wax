# fix: OAuth security hardening and audit logging

**Date:** 2026-03-24
**Type:** Fix

## Intent

Harden the Google OAuth implementation after a security audit. Add audit logging with circular buffer for forensic review.

### Prompts summary

1. Audit the auth implementation for security issues
2. Fix all actionable findings
3. Add audit logging with circular buffer
4. Mask emails in logs and audit trail

## Changes

### `server/auth.py`
- **XSS prevention:** HTML-escape all user data in error pages via `html.escape()`
- **Full session hash:** Use complete 64-char SHA256 hex digest (was truncated to 32)
- **Secure cookie flag:** Always set when reverse proxy headers present or HTTPS active
- **First-login race condition:** Added `_first_login_lock` for atomic check-and-set
- **Redirect URI validation:** Store `redirect_uri` in OAuth state dict, reuse on callback
- **Rate limiting:** `/auth/callback` limited to 10 attempts/minute per IP
- **Email masking:** `_mask_email()` shows `em...@gmail.com` in all logs and audit
- **Audit log:** `data/auth.log` with 512KB rotation, logs LOGIN_OK, ACCESS_DENIED, LOGOUT, RATE_LIMITED, FIRST_LOGIN_LOCK, SESSIONS_CLEARED

### `server/handler.py`
- **Session invalidation:** Changing ALLOWED_EMAILS now clears all sessions
- **Request timestamps:** `log_message` includes HH:MM:SS UTC timestamp

### `static/js/auth.js`
- **XSS prevention:** Replaced `innerHTML` with DOM API (`createElement` + `textContent`) for user avatar rendering

## Files modified

| File | Change |
|------|--------|
| `server/auth.py` | Security fixes, audit logging, email masking |
| `server/handler.py` | Session invalidation on config change, request timestamps |
| `static/js/auth.js` | Safe DOM rendering for user data |
