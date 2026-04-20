# fix: empty-state subtitle not translated

**Date:** 2026-04-19
**Type:** Fix

## Intent

The collection empty-state subtitle was rendered via `data-i18n` (textContent), but the translation value contains `<strong>{addLabel}</strong>`. On load, `translateDOM()` set textContent to the raw HTML string, so users saw literal `<strong>…</strong>` markup and an unreplaced `{addLabel}` placeholder.

### Prompts summary

1. During a code review, identified that the empty-state subtitle renders raw HTML as text and never substitutes the `{addLabel}` variable; asked to fix it.

## Changes

### `static/index.html`
- Replaced `data-i18n="collection.empty.subtitle"` with an `id="collection-empty-subtitle"` so the subtitle is rendered from JS, letting variable interpolation run.

### `static/js/collection.js`
- When the empty state is shown, set `innerHTML` of the subtitle using `t('collection.empty.subtitle', { addLabel })` where `addLabel` is the translated "Add" wrapped in the `<strong>` tag.

## Files modified

| File | Change |
|------|--------|
| `static/index.html` | Subtitle rendered from JS instead of via `data-i18n` |
| `static/js/collection.js` | Populate empty-state subtitle with interpolated translation |
