# fix: re-render open detail and settings modals on language switch

**Date:** 2026-04-20
**Type:** Fix

## Intent

The `locale-changed` event handler only re-rendered the dashboard and collection views. If the detail modal or settings modal was open when the user switched languages, the modal content stayed in the old language because its HTML is built by JS from `t()` at render time (not via `data-i18n`, which `translateDOM()` handles).

The language switcher itself lives inside the Settings modal, so this is the most likely scenario to hit in practice.

### Prompts summary

1. Code review flagged that open modals don't re-translate when the user switches languages from inside the Settings modal; asked to fix.

## Changes

### `static/js/init.js`
- `locale-changed` handler: if the detail modal is open, re-render it via `_renderDetailBody(_detailList[_detailIndex])`. If the settings modal is open, call `_renderSettings()`.
- Uses `AppModal.getInstance(id)` which returns null when the modal is not visible.

### Out of scope

Sync overlay, setup wizard, and scanner sheet are not covered — they're phase- or state-dependent and would require bigger changes. Those are less commonly open during a language switch.

## Files modified

| File | Change |
|------|--------|
| `static/js/init.js` | Re-render detail and settings modals on `locale-changed` |
