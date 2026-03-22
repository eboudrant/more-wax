# fix: deterministic screenshot tests

**Date:** 2026-03-22
**Type:** Fix

## Intent

Dashboard screenshot tests failed intermittently because Random Picks rendered in a different order each run due to Math.random in the Fisher-Yates shuffle.

### Prompts summary

1. Fix flaky dashboard screenshot tests caused by non-deterministic Random Picks order
2. Verify zero-diff stability across multiple runs

## Deterministic test fixtures (`tests/screenshots/fixtures.js`)

- Override `Math.random` to return a constant (`0.999`) via `page.addInitScript`, making Fisher-Yates shuffle a no-op so records always appear in collection order

## Files modified

| File | Change |
|------|--------|
| `tests/screenshots/fixtures.js` | Constant Math.random for deterministic snapshots |
| `tests/screenshots/mobile/error-apikey-required.png` | Regenerated baseline |
| `tests/screenshots/desktop/error-apikey-required.png` | Regenerated baseline |
