# feat: in-app setup wizard for API tokens

**Date:** 2026-03-22
**Type:** Feature

## Intent

Replace the manual `.env` file setup with an in-app wizard that guides users through connecting Discogs and Claude on first launch. Tokens are validated inline, persisted to `data/.env` (inside Docker volume), and hot-reloaded without restart. Invalid tokens trigger the wizard automatically.

### Prompts summary

1. Add an in-app setup wizard for configuring API tokens seamlessly
2. Consolidate configuration into `data/.env` instead of the project root `.env`
3. Server should start without tokens and show the wizard instead of exiting
4. Validate tokens as the user types with debounce
5. When a Discogs or Anthropic token becomes invalid, re-open the wizard with an error message
6. Add a back button on step 2 and fix button contrast
7. Update README to reflect the new setup flow

## Config migration (`server/config.py`)

- Configuration now loads exclusively from `data/.env` (persists in Docker volumes)
- One-time migration: copies `./env` to `data/.env` on first startup if `data/.env` doesn't exist
- Added `save_token(key, value)` to write/update keys in `data/.env` and hot-reload config
- Added `_load_config()` for re-reading config without server restart
- All modules (`discogs.py`, `images.py`, `handler.py`) now read config dynamically via `server.config` module reference instead of import-time constants

## Server starts without tokens (`server.py`)

- Removed early `return` when `DISCOGS_TOKEN` is missing — server now starts and serves the UI
- Prints info message pointing users to the setup wizard
- Background validation of both Discogs identity and Anthropic API key at startup

## Setup API endpoints (`server/handler.py`)

- `POST /api/setup` — validates and saves tokens, returns updated status
- `POST /api/setup/validate` — validates tokens without saving (for inline validation)
- Discogs tokens validated against `/oauth/identity`
- Anthropic keys validated against `/v1/models` (free, no tokens consumed)
- `/api/status` now includes `anthropic_key_valid` field

## Setup wizard UI (`static/js/setup.js`)

- Two-step modal dialog: Discogs token (required) → Anthropic key (optional, skippable)
- Inline validation with 500ms debounce — green checkmark or red X appears as user types/pastes
- Back button on step 2 to return to step 1
- Error messages displayed inline for invalid tokens
- On success, dismisses wizard and loads collection

## Token recovery flow (`static/js/init.js`, `static/js/photo-search.js`)

- Missing Discogs token → wizard opens at step 1
- Invalid Discogs token (detected on startup) → wizard opens with error message
- Invalid Anthropic key (detected on startup) → wizard opens at step 2 with error message
- Cover identification failure (401/501 at runtime) → wizard opens at step 2

## README updates

- Removed prerequisites section (no more manual `.env` setup)
- Updated quick start to mention the setup wizard
- Configuration section explains tokens are set via wizard, env vars can override

## Tests

- Updated `test_images.py` mock patches for dynamic config references
- Added wizard screenshot tests (step 1, step 2, invalid token state)
- Removed obsolete error banner tests (replaced by wizard tests)
- Updated fixtures with setup/validate mock routes and `anthropic_key_valid` status field

## Files modified

| File | Change |
|------|--------|
| `server/config.py` | Consolidated to `data/.env`, added `save_token()` and `_load_config()` |
| `server.py` | Removed early exit, added background Anthropic key check |
| `server/handler.py` | Added `POST /api/setup`, `POST /api/setup/validate`, Anthropic validation, `anthropic_key_valid` in status |
| `server/discogs.py` | Dynamic config via `server.config` module, added `discogs_validate_token()` |
| `server/images.py` | Dynamic config via `server.config` module |
| `static/js/setup.js` | New — setup wizard UI with inline validation |
| `static/js/init.js` | Show wizard for missing/invalid tokens instead of banner |
| `static/js/photo-search.js` | Open wizard on cover identification auth failure |
| `static/index.html` | Added `setup.js` script tag |
| `README.md` | Updated setup flow and configuration docs |
| `tests/test_images.py` | Updated mock patches for dynamic config |
| `tests/screenshots/views.spec.js` | Wizard tests, removed banner tests |
| `tests/screenshots/fixtures.js` | Added setup/validate mocks, `anthropic_key_valid` |
