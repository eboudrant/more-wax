# test: platform-independent screenshot tests via Docker

**Date:** 2026-03-22
**Type:** Test

## Intent

Screenshot tests previously generated baselines on-the-fly in CI because macOS and Linux render fonts differently, making the comparison step effectively a no-op. This change runs Playwright inside a Docker container so snapshots are identical on any host OS.

### Prompts summary

1. Investigate why CI screenshot tests always pass without actually comparing against baselines
2. Add separate mobile and desktop snapshot baselines
3. Add testing instructions to the README

## Docker-based test runner (`Dockerfile.test`)

- New `Dockerfile.test` based on `mcr.microsoft.com/playwright:v1.58.2-noble` with Python, openssl, and ffmpeg added
- Playwright version pinned to `1.58.2` in both `Dockerfile.test` and `package.json` to keep them in sync
- npm scripts updated: `test:screenshots:build`, `test:screenshots`, and `test:screenshots:update` all run via Docker

## Platform-independent snapshots (`playwright.config.js`)

- `snapshotPathTemplate` set to `{snapshotDir}/{projectName}/{arg}{ext}` — removes OS-specific suffixes
- Baselines organized into `tests/screenshots/mobile/` and `tests/screenshots/desktop/` subdirectories
- Old `views.spec.js-snapshots/*-darwin.png` files removed

## Simplified CI workflow (`.github/workflows/ci.yml`)

- Replaced Node/Python setup, npm install, Playwright install, and snapshot generation logic with a single `docker build` + `docker run`
- Removed the "generate baseline on first run" workaround that skipped actual comparison
- Test artifacts uploaded on failure for debugging

## README testing section (`README.md`)

- Added Testing section before Contributing with build, run, and baseline regeneration commands

## Files modified

| File | Change |
|------|--------|
| `Dockerfile.test` | New — Playwright + Python test image |
| `package.json` | Pinned Playwright to 1.58.2, Docker-based npm scripts |
| `playwright.config.js` | Platform-independent snapshot path template |
| `.github/workflows/ci.yml` | Simplified to Docker build + run |
| `README.md` | Added Testing section |
| `tests/screenshots/mobile/*.png` | New — 12 mobile baselines |
| `tests/screenshots/desktop/*.png` | New — 12 desktop baselines |
| `tests/screenshots/views.spec.js-snapshots/` | Deleted — old platform-specific baselines |
