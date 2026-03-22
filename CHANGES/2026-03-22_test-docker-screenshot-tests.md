# test: platform-independent screenshot tests via Docker

**Date:** 2026-03-22
**Type:** Test

## Intent

Screenshot tests previously generated baselines on-the-fly in CI because macOS and Linux render fonts differently, making the comparison step effectively a no-op. This change runs Playwright inside a Docker container so snapshots are identical on any host OS.

### Prompts summary

1. Investigate why CI screenshot tests always pass without actually comparing against baselines
2. Add separate mobile and desktop snapshot baselines
3. Add testing instructions to the README
4. Seed Math.random for deterministic Random Picks in tests
5. Post screenshot failure summary as PR comment

## Docker-based test runner (`Dockerfile.test`)

- New `Dockerfile.test` based on `mcr.microsoft.com/playwright:v1.58.2-noble` with Python, openssl, and ffmpeg added
- Playwright version pinned to `1.58.2` in both `Dockerfile.test` and `package.json` to keep them in sync
- npm scripts updated: `test:screenshots:build`, `test:screenshots`, and `test:screenshots:update` all run via Docker

## Platform-independent snapshots (`playwright.config.js`)

- `snapshotPathTemplate` set to `{snapshotDir}/{projectName}/{arg}{ext}` — removes OS-specific suffixes
- Baselines organized into `tests/screenshots/mobile/` and `tests/screenshots/desktop/` subdirectories
- `maxDiffPixels: 0` — zero tolerance since Docker ensures identical rendering
- Old `views.spec.js-snapshots/*-darwin.png` files removed

## Deterministic test fixtures (`tests/screenshots/fixtures.js`)

- Seeded `Math.random` via `page.addInitScript` so Random Picks always render in the same order

## Simplified CI workflow (`.github/workflows/ci.yml`)

- Replaced Node/Python setup, npm install, Playwright install, and snapshot generation logic with a single `docker build` + `docker run`
- Removed the "generate baseline on first run" workaround that skipped actual comparison
- Test artifacts (diff images, HTML report) uploaded on failure
- Added `actions/github-script` step to post failure summary as a PR comment listing failed tests with link to artifacts
- `permissions: pull-requests: write` granted for the comment step

## README testing section (`README.md`)

- Added Testing section before Contributing with build, run, and baseline regeneration commands

## Files modified

| File | Change |
|------|--------|
| `Dockerfile.test` | New — Playwright + Python test image |
| `package.json` | Pinned Playwright to 1.58.2, Docker-based npm scripts |
| `playwright.config.js` | Platform-independent snapshot path template |
| `.github/workflows/ci.yml` | Simplified to Docker build + run, PR failure comments |
| `README.md` | Added Testing section |
| `tests/screenshots/fixtures.js` | Seeded Math.random for deterministic snapshots |
| `tests/screenshots/mobile/*.png` | New — 12 mobile baselines |
| `tests/screenshots/desktop/*.png` | New — 12 desktop baselines |
| `tests/screenshots/views.spec.js-snapshots/` | Deleted — old platform-specific baselines |
