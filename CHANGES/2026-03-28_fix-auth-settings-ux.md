# fix: rewrite authentication settings UX

**Date:** 2026-03-28
**Type:** Fix

## Intent

The authentication settings had multiple UX issues: auto-validation on debounce triggered unintended redirects, the enable dialog button didn't work due to modal z-index conflicts, invalid credentials could activate auth and lock users out, and Chrome autofill didn't trigger validation.

### Prompts summary

1. Validation should happen on blur, not debounce while typing
2. Enable auth should require explicit button click, not auto-enable on field fill
3. Validate Google credentials with Google before enabling auth
4. Add confirmation dialog for enable and disable auth
5. Disable auth button wasn't clearing credentials (missing handler)
6. Fix `classList.toggle('hidden', undefined)` bug hiding auth setup form
7. Add screenshot tests for auth states

## Changes

### `static/js/settings.js` — complete rewrite of auth section
- Removed auto-save on debounce/blur for Google credentials
- Two states: setup form (fields + Enable button) vs active state (status + Disable)
- "Enable Authentication" button validates both credentials with Google before saving
- Shows loading spinner during validation, error message on failure
- Confirmation dialog via `AppModal` for both enable and disable
- Both dialogs do `location.reload()` on confirm for clean state
- Fixed `classList.toggle('hidden', undefined)` → `!!` cast to boolean
- Removed unused `_authJustEnabled` flag

### `static/index.html` — restructured auth section
- Auth active state: shield icon, allowed emails input, disable button
- Auth setup form: two plain inputs, Enable Authentication button, error display
- Added `#auth-confirm-modal` for confirmation dialogs
- Removed per-field toggle/mask/change buttons for Google credentials

### `server/handler.py`
- Added `clear_google_auth` action to POST `/api/settings` — clears both credentials, allowed emails, and all sessions
- Google credential validation: Client ID format check + full OAuth validation against Google

### `static/js/api.js`
- Minor cleanup

### Tests
- Added `mockAuth` fixture for simulating auth required/not required states
- Added `mockSettingsWithAuth` fixture for auth active settings view
- Added screenshot tests: auth login overlay, settings with auth active
- Fixed settings screenshot: element screenshot of `#settings-body` with unconstrained parents for full content capture
- Explicit `google_client_id_set: false` in default settings mock (fixes `classList.toggle` with undefined)

## Files modified

| File | Change |
|------|--------|
| `static/js/settings.js` | Rewritten auth settings — explicit enable, validation, dialogs |
| `static/index.html` | Restructured auth section, added confirm modal |
| `server/handler.py` | `clear_google_auth` handler, credential validation |
| `static/js/api.js` | Minor cleanup |
| `tests/screenshots/fixtures.js` | Auth and settings mocks |
| `tests/screenshots/views.spec.js` | Auth screenshot tests, fixed settings screenshot |
| `.claude/launch.json` | Dev server on port 9765 |
