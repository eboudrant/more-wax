# Setup Wizard — Implementation Plan

## Overview
Add an in-app setup wizard that lets users configure API tokens from the browser. The server starts without tokens and shows a guided setup flow. Tokens are persisted to `data/.env` (inside Docker volume) so they survive container restarts.

## Changes

### 1. Config: multi-source .env loading (`server/config.py`)
- Load env files in order: `data/.env` first, then `./.env` (project root)
- Both use `os.environ.setdefault()` so real env vars always win
- Add a `reload_config()` function that re-reads both files and updates module-level vars (`DISCOGS_TOKEN`, `ANTHROPIC_API_KEY`, `VISION_MODEL`)
- Add a `save_token(key, value)` function that writes/updates a key in `data/.env`

### 2. Server: start without DISCOGS_TOKEN (`server.py`)
- Remove the early `return` when `DISCOGS_TOKEN` is missing
- Print a message: "No Discogs token — open the app to run the setup wizard"
- Server starts normally, serves the UI, and the wizard handles setup

### 3. New API endpoint: `POST /api/setup` (`server/handler.py`)
- Accepts JSON: `{ "discogs_token": "...", "anthropic_api_key": "..." }`
- **Validates** the Discogs token by calling `GET /oauth/identity` with it
  - If invalid → 400 with error message
  - If valid → save to `data/.env` via `config.save_token()`
- If `anthropic_api_key` is provided, saves it too (no validation needed — Claude API doesn't have a simple ping endpoint)
- Calls `config.reload_config()` to hot-reload
- Triggers `discogs_fetch_identity()` in background thread
- Returns `200` with the new status payload

### 4. Client: setup wizard UI (`static/js/setup.js`, new file)
- Full-screen overlay (z-index above everything)
- Shown when `/api/status` returns `discogs_token_set: false`
- **Step 1 — Discogs token (required)**
  - Logo + welcome message
  - Explains what Discogs is and why the token is needed
  - Link to https://www.discogs.com/settings/developers
  - Text input for token
  - "Connect" button → calls `POST /api/setup` with token
  - Shows validation state (loading spinner, success check, error message)
- **Step 2 — Anthropic API key (optional)**
  - Explains what Claude Vision does (cover photo identification)
  - Shows cost estimate (~$0.007/photo)
  - Link to https://console.anthropic.com/
  - Text input for key
  - "Save" button + "Skip" link
- **Done state**
  - Success message, "Start browsing" button
  - Reloads collection and hides wizard

### 5. Client: init.js integration
- After `_checkStatus()`, if `!discogs_token_set` → show wizard instead of error banner
- Remove the old `_showSetupError()` for missing token case (keep it for invalid token)
- After wizard completes, re-check status and proceed normally

### 6. Update `/api/status` response
- Add `setup_complete: bool` — true when DISCOGS_TOKEN is set
- Client uses this to decide wizard vs normal flow

### 7. Tests
- Python unit test: `test_setup_endpoint` — validates token saving and reload
- Screenshot test: `setup-wizard.png` — wizard visible on empty state
- Update `mockEmptyApi` fixture to include the wizard-related status field

### 8. Security considerations
- `POST /api/setup` only writes to `data/.env`, never to system env or project `.env`
- Tokens are never logged or echoed back in API responses
- The endpoint is always available (no auth gate) since it's needed before any auth exists
- Once Discogs is connected, the wizard doesn't show again (status check gates it)

## File changes summary
| File | Change |
|------|--------|
| `server/config.py` | Add `data/.env` loading, `reload_config()`, `save_token()` |
| `server.py` | Remove early exit on missing token |
| `server/handler.py` | Add `POST /api/setup` route, update `/api/status` |
| `static/js/setup.js` | New — wizard UI |
| `static/js/init.js` | Show wizard instead of error banner when no token |
| `static/index.html` | Add `<script src="js/setup.js">`, wizard container div |
| `tests/test_config.py` | New — unit tests for save_token/reload |
| `tests/screenshots/views.spec.js` | Add wizard screenshot test |
| `tests/screenshots/fixtures.js` | Update mock status for wizard |
