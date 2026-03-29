# feat: display app version, build date, and git revision

**Date:** 2026-03-29
**Type:** Feature

## Intent

Show version information in the dashboard status card so users know which build they're running, especially useful for Docker deployments.

### Prompts summary

1. Add version shown in status card with timestamp and git revision for Docker builds
2. Format as: More'Wax `latest`, built on March 29, 2026, `a1b2c3d`
3. Move version to Connections card (not Collection Stats), right-aligned
4. Use Docker-like version in test fixtures instead of "dev"

## Changes

### `server/version.py` (new)
- Module with `VERSION`, `BUILD_DATE`, `GIT_REVISION` constants
- Defaults to `dev` / empty when running from source
- Stamped at Docker build time via `sed` in Dockerfile

### `Dockerfile`
- Added `BUILD_VERSION`, `BUILD_DATE`, `GIT_REVISION` build args
- `sed` step replaces defaults in `server/version.py` with actual values

### `.github/workflows/docker.yml`
- Passes `build-args` to `docker/build-push-action`: version from metadata, timestamp from commit, SHA from github context

### `server/handler.py`
- `/api/status` now includes `version`, `build_date`, `git_revision` fields

### `static/js/dashboard.js`
- Version line in Connections card (right-aligned): More'Wax `version`, built on `date`, `sha`
- Dev mode shows just "More'Wax `dev`"
- Date formatted with locale-aware long format (e.g. "March 29, 2026")

### `tests/screenshots/fixtures.js`
- Status mocks use Docker-like version (`latest`, build date, git revision) instead of `dev`

### Screenshot tests
- Added `status-card` test: element screenshot of `#dash-status` verifying version and connections render
- Updated dashboard baselines to include version line

## Files modified

| File | Change |
|------|--------|
| `server/version.py` | New — version constants |
| `Dockerfile` | Build args + sed stamp |
| `.github/workflows/docker.yml` | Pass build args |
| `server/handler.py` | Version in `/api/status` |
| `static/js/dashboard.js` | Version display in Connections card |
| `tests/screenshots/fixtures.js` | Docker-like version in mocks |
| `tests/screenshots/views.spec.js` | Status card screenshot test |
| `tests/screenshots/*/status-card.png` | New baselines |
| `tests/screenshots/*/dashboard*.png` | Updated baselines |
