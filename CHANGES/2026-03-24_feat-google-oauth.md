# feat: Google OAuth authentication gate

**Date:** 2026-03-24
**Type:** Feature

## Intent

Protect the app when exposed to the internet. Single-user gate using Google OAuth — disabled by default for LAN use, automatically enabled when Google credentials are configured. Includes lock-out prevention, clear button to disable auth, and safe fallback for local access.

### Prompts summary

1. Add auth using Google account for internet hosting
2. Single-user gate, not multi-user
3. Will use reverse proxy (Cloudflare Tunnel) for trusted HTTPS
4. First-login-locks behavior for allowed email
5. Add clear button to disable auth from settings
6. Ensure user never gets locked out (local access bypasses auth)
7. Remove HTTP→HTTPS redirect (incompatible with Cloudflare Tunnel)
8. Add README section for publishing on internet with OAuth setup guide

## Changes

### `server/auth.py` (new)
- Google OAuth Authorization Code flow with PKCE (stdlib only)
- `/auth/login` — redirects to Google consent screen
- `/auth/callback` — exchanges code for token, validates email, creates session
- `/auth/logout` — clears session cookie and file
- `/auth/status` — returns auth state (always public)
- Session management: file-based in `data/sessions/`, in-memory cache, 7-day expiry
- Hourly cleanup thread for expired sessions
- X-Forwarded-Proto/Host support for reverse proxy

### `server/handler.py`
- `_check_auth()` middleware on all `do_GET/POST/PUT/DELETE`
- Auth routes dispatched before the gate
- Static assets and covers remain public (login page needs them)
- API endpoints return 401 when not authenticated
- `_send_html()` helper for OAuth error pages
- Settings endpoint extended with Google OAuth fields
- `POST /api/settings` with `clear_google_auth` action removes OAuth config and all sessions
- Lock-out prevention: local/private IP requests always bypass auth

### `server/config.py`
- Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`

### `server.py`
- Session cleanup thread started on boot

### `static/js/auth.js` (new)
- Checks `/auth/status` on page load before app init
- Shows full-screen login overlay with Google Sign-In button
- User avatar + dropdown menu with sign-out in header

### `static/js/api.js`
- All fetch wrappers check for 401 → redirect to `/auth/login`

### `static/js/settings.js`
- Google Client ID, Client Secret, Allowed Emails fields
- Same masked display and validate-on-type pattern

### `static/index.html`
- Auth avatar placeholder in header
- Authentication section in settings modal
- `auth.js` script tag

## How it works

1. **Auth disabled (default):** No `GOOGLE_CLIENT_ID` → everything works as before
2. **Auth enabled:** Set Google OAuth credentials in settings → app requires sign-in
3. **First-login-locks:** If `ALLOWED_EMAILS` is blank, the first Google login auto-saves that email — subsequent logins from other emails are rejected
4. **Session:** HttpOnly cookie, 7-day expiry, stored as hashed JSON files in `data/sessions/`
5. **Reverse proxy:** Respects `X-Forwarded-Proto` and `X-Forwarded-Host` headers

## Files modified

| File | Change |
|------|--------|
| `server/auth.py` | New — OAuth flow, sessions, PKCE |
| `server/config.py` | Google OAuth config vars |
| `server/handler.py` | Auth middleware, routes, settings |
| `server.py` | Session cleanup thread |
| `static/js/auth.js` | New — login overlay, avatar |
| `static/js/api.js` | 401 redirect handling |
| `static/js/settings.js` | Google OAuth credential fields |
| `static/index.html` | Auth UI elements |
| `tests/screenshots/` | Updated settings modal baselines |
