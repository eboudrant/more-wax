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

### Updated: README quick start
- Three install options: setup wizard (recommended), Docker, and manual
- Updated clone URL

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
| `README.md` | Updated quick start with three install options |
| `.github/workflows/ci.yml` | Removed `kmp-checks` job |
| `.gitignore` | Removed KMP entries |
| `more-wax-kmp/` | Deleted entirely |
