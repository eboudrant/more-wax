# feat: Docker Hub CI, empty state, and README cleanup

**Date:** 2026-03-21
**Type:** Feature / Chore

## Intent

Publish Docker images to Docker Hub automatically and improve the first-run experience with an empty state on the dashboard.

### Prompts summary

1. Add GitHub Actions workflow to push Docker images to Docker Hub
2. Add empty state on dashboard suggesting to add records when collection is empty
3. Fix status cards not showing on empty collections
4. Simplify README quick start with Docker Hub instructions, remove setup wizard
5. Add screenshot test for empty state
6. Delete merged git branches

## Changes

- Add `.github/workflows/docker.yml` — builds multi-arch images (amd64 + arm64) on push to main and version tags, pushes to Docker Hub
- Update `docker-compose.yml` — add `image: eboudrant/more-wax:latest` for direct pulls
- Add empty state to dashboard with vinyl icon, message, and add-record button when collection has no records
- Fix `renderDashboard()` to always render status cards even with empty collection
- Update README quick start: Docker run, Docker Compose, and run locally options
- Remove `setup.sh` wizard script
- Add `mockEmptyApi` fixture and empty state screenshot test

## Files modified

| File | Change |
|------|--------|
| `.github/workflows/docker.yml` | New workflow for Docker Hub build and push |
| `docker-compose.yml` | Added `image` field for Docker Hub pulls |
| `static/index.html` | Added `#dash-empty` empty state, added section IDs for toggling |
| `static/js/dashboard.js` | Toggle empty state visibility, render status cards always |
| `README.md` | Simplified quick start options, removed setup wizard reference |
| `setup.sh` | Removed |
| `tests/screenshots/fixtures.js` | Added `mockEmptyApi` helper |
| `tests/screenshots/views.spec.js` | Added empty state screenshot test |
