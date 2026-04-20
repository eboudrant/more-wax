# fix: use correct view name after sync import

**Date:** 2026-04-20
**Type:** Fix

## Intent

After a sync import, the overlay called `navigateTo('home')`. There is no `'home'` view — `VIEWS` only contains `['dashboard', 'collection']` in `router.js`. The router currently falls through to `'dashboard'` as the default, so the bug was silent, but the intent is clearly `'dashboard'`.

### Prompts summary

1. Code review flagged the `'home'` string as an invalid view name that works only by accident via the default fallback; asked to fix.

## Changes

### `static/js/sync.js`
- `closeSyncOverlay()`: `navigateTo('home')` → `navigateTo('dashboard')`

## Files modified

| File | Change |
|------|--------|
| `static/js/sync.js` | Use valid view name `'dashboard'` after import completes |
