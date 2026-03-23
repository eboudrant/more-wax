# feat: settings screen, format filter, data export, schema versioning

**Date:** 2026-03-22
**Type:** Feature

## Intent

Add a settings screen accessible from the dashboard so users can update API tokens, choose AI model, set search format filter, and export their collection. Also add schema versioning to the database for future migrations.

### Prompts summary

1. Add settings screen with cog icon on dashboard status card, modal with token management, AI model selector, format filter, and data export
2. Support filtering Discogs search by format: Vinyl, CD, or All (default Vinyl)
3. Add JSON export endpoint with schema versioning
4. Add schema version to collection.json for future migrations

## Changes

### Settings UI (`static/js/settings.js`, `static/index.html`)
- New settings modal with sections: Connections (masked tokens with change button), AI Model (dropdown), Search (format filter), Data (export button)
- Tokens masked as `••••xxxx`, revealed via "Change" button with inline validation (debounced, same pattern as setup wizard)
- Model dropdown populated from server-side `SUPPORTED_MODELS` list
- Format filter dropdown: Vinyl, CD, All formats
- Export button triggers browser download of collection JSON

### Settings API (`server/handler.py`)
- `GET /api/settings` returns masked tokens, model, supported models list, format filter
- `POST /api/settings` accepts partial updates with validation (tokens validated against live APIs)
- `GET /api/export` returns collection JSON with schema version, timestamp, and content-disposition header
- `/api/status` response extended with `vision_model` and `format_filter`

### Format filter (`server/discogs.py`, `server/config.py`)
- `FORMAT_FILTER` config variable (default: `Vinyl`, options: Vinyl, CD, All)
- Search adds `format=Vinyl` or `format=CD` to Discogs API query (barcode search unaffected)

### Dashboard (`static/js/dashboard.js`)
- Cog icon added to Connections card header, opens settings modal

### Schema versioning (`server/database.py`)
- `schema_version: "1.0"` added to collection.json root
- Existing databases migrated on load (version field added if missing)
- Export includes schema version and timestamp

### Tests
- Settings mock route added to fixtures
- Screenshot test for settings modal (mobile + desktop)
- Status mock updated with new fields

## Files modified

| File | Change |
|------|--------|
| `server/config.py` | Add `FORMAT_FILTER`, `SUPPORTED_MODELS` |
| `server/database.py` | Add schema versioning, `db_export()` |
| `server/discogs.py` | Add `format_filter` param to search |
| `server/handler.py` | Add settings, export endpoints; format filter in search |
| `static/index.html` | Add settings modal HTML, settings.js script tag |
| `static/js/settings.js` | New — settings modal logic |
| `static/js/dashboard.js` | Add cog icon to Connections card |
| `.env.example` | Add `FORMAT_FILTER` option |
| `tests/screenshots/fixtures.js` | Add settings mock, update status mock |
| `tests/screenshots/views.spec.js` | Add settings modal test |
| `tests/screenshots/*/settings-modal.png` | New baselines |
