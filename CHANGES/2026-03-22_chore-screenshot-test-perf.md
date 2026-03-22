# chore: screenshot test performance optimizations

**Date:** 2026-03-22
**Type:** Chore

## Intent

Speed up the screenshot test suite which had become a CI bottleneck due to sequential execution and excessive hardcoded waits.

### Prompts summary

1. Investigate and optimize the screenshot test workflow, which is the main CI bottleneck

## Parallel test execution (`playwright.config.js`)

- Added `fullyParallel: true` so mobile and desktop projects run concurrently instead of sequentially

## Replace hardcoded waits with explicit waits (`tests/screenshots/views.spec.js`)

- Replaced scattered `waitForTimeout` calls (300–2000 ms) with `waitForSelector` and `waitForLoadState('networkidle')`
- Introduced a single `TRANSITION` constant (400 ms) for CSS transition settle, replacing inconsistent values across tests
- Total local test time drops from ~45 s to ~18 s

## CI caching (`.github/workflows/ci.yml`)

- Cache `node_modules` via `actions/cache@v4` keyed on `package-lock.json`
- Cache Playwright browser binaries (`~/.cache/ms-playwright`) to skip re-downloads on cache hit

## Files modified

| File | Change |
|------|--------|
| `playwright.config.js` | Added `fullyParallel: true` |
| `tests/screenshots/views.spec.js` | Replaced hardcoded waits with explicit waits and `TRANSITION` constant |
| `.github/workflows/ci.yml` | Added npm and Playwright browser caching |
