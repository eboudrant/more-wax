# chore: prepare for open source release

**Date:** 2026-03-20
**Branch:** tests_improvments
**Type:** Chore

## Intent

Make the project easy to set up and contribute to for new users and contributors. Add Docker support, an interactive setup wizard, and standard open source community files.

### Prompts summary

1. Add Docker support, a setup wizard, and community docs to prepare for open source release
2. Remove the KMP client — the project is now a pure Python server + vanilla JS frontend
3. Update the README with multiple install paths (wizard, Docker, manual)
4. Add error dialog when Discogs key is missing or invalid
5. Add API key required dialog when tapping photo mode without Anthropic key
6. Clarify .env.example about Personal Access Token vs OAuth keys
7. Add screenshot tests for error dialogs
8. Replace ASCII diagram with Mermaid in README, add screenshots

## Changes

### New: Docker support (`Dockerfile`, `docker-compose.yml`, `.dockerignore`)
- `python:3.13-slim` base with openssl, ffmpeg, and curl
- Non-root `morewax` user, `/app/data` volume for persistence
- Healthcheck via curl on HTTP port
- `docker compose up` starts everything with `.env` file and named volume
- `.dockerignore` excludes `.git`, `node_modules`, test artifacts, `data/`, `.env`

### New: Interactive setup wizard (`setup.sh`)
- Checks Python 3.10+ is installed
- Creates `.env` from `.env.example` if missing
- Prompts for Discogs token (required) and Anthropic API key (optional)
- Validates the Discogs token via the `/oauth/identity` endpoint and shows the authenticated username
- Creates `data/` directory
- Colored output with green/red/yellow status indicators

### New: Community files
- `CONTRIBUTING.md` — dev setup, test commands (`pytest`, `playwright`), linting (`ruff`), PR process
- `SECURITY.md` — vulnerability reporting via `security@morewax.app`, 48-hour acknowledgment, scope definition

### New: Error dialogs
- Setup error banner when Discogs token is missing or invalid, with link to settings page
- API key required dialog when tapping photo mode without an Anthropic key configured
- `/api/status` endpoint returns connection state and key availability
- Playwright tests for all error dialog states (show, dismiss, no-errors-when-configured)

### New: README screenshots
- Playwright script to capture collection and detail views from live data
- Screenshots added to README in a centered side-by-side layout

### Updated: README
- Replaced ASCII architecture diagram with Mermaid flowchart
- Added `/api/status` endpoint to API docs
- Added error handling section documenting setup banners and API key dialog
- Corrected "Bootstrap 5" references to "Tailwind CSS"
- Three install options: setup wizard (recommended), Docker, and manual

### Updated: `.env.example`
- Clarified Discogs token instructions: Personal Access Token, not OAuth Consumer Key/Secret

### Removed: KMP client (`more-wax-kmp/`)
- Deleted the entire Kotlin Multiplatform client directory
- Removed `kmp-checks` CI job from GitHub Actions
- Removed KMP-specific `.gitignore` entries

## Files modified

| File | Change |
|------|--------|
| `Dockerfile` | New: Docker image definition |
| `docker-compose.yml` | New: one-command Docker setup |
| `.dockerignore` | New: excludes non-runtime files from image |
| `setup.sh` | New: interactive setup wizard |
| `CONTRIBUTING.md` | New: contributor guide |
| `SECURITY.md` | New: security policy |
| `README.md` | Updated: quick start, Mermaid diagram, screenshots, error handling docs |
| `.env.example` | Updated: clarified Personal Access Token instructions |
| `server/handler.py` | Updated: added `/api/status` endpoint |
| `static/js/init.js` | Updated: added `_checkStatus()` and `_showSetupError()` |
| `static/js/add-modal.js` | Updated: added `_showApiKeyDialog()`, photo mode gate |
| `static/js/state.js` | Updated: added `_serverStatus` variable |
| `static/index.html` | Updated: added `#setup-error` banner and `#apikey-dialog` markup |
| `tests/screenshots/views.spec.js` | Updated: added 6 error dialog tests |
| `tests/screenshots/fixtures.js` | Updated: added `mockStatus()` helper |
| `docs/screenshot-collection.png` | New: collection view screenshot |
| `docs/screenshot-detail.png` | New: record detail screenshot |
| `take-screenshots.js` | New: Playwright script for README screenshots |
| `.github/workflows/ci.yml` | Removed `kmp-checks` job |
| `.gitignore` | Removed KMP entries |
| `more-wax-kmp/` | Deleted entirely |
