# fix: bug fixes, code cleanup, and screenshot tests

**Date:** 2026-03-19
**Type:** Bug Fix / Cleanup / Tests

## Intent

Audit the codebase for bugs and security issues, clean up duplicated logic, and add Playwright screenshot regression tests to the CI pipeline.

### Prompts summary

1. Scan the codebase for bugs and potential issues across Python and JavaScript
2. Find opportunities to make the code cleaner and reduce duplication
3. Add screenshot regression tests via GitHub Actions using Playwright

## Bug Fixes

### TOCTOU race condition in duplicate check (`handler.py`, `database.py`)
- `_api_add()` previously released the database lock between `db_find_duplicate()` and `db_add()`, allowing concurrent requests to insert duplicates
- Added `_db_add_unlocked()` so the duplicate check and insert run under a single lock acquisition

### Temp file leak in image conversion (`images.py`)
- `convert_image()` could leak temp files if an unexpected exception occurred during the conversion loop
- Wrapped the entire conversion block in `try/finally` to guarantee cleanup

### Unprotected array access on Claude API response (`images.py`)
- `result["content"][0]["text"]` would crash with `IndexError` if Claude returned an empty or malformed response
- Added bounds check with graceful error return

### Missing CORS headers on static file responses (`handler.py`)
- `send_file()` did not include CORS headers, unlike `send_json()`, causing potential cross-origin issues for cover images
- Added `_cors_headers()` call to `send_file()`

### Corrupted database recovery (`database.py`)
- `_load()` would crash on corrupted JSON or invalid file structure with no recovery path
- Now catches `JSONDecodeError`/`OSError`, backs up the corrupted file, and resets to empty state

### Search race condition in photo search (`photo-search.js`)
- Rapid photo searches could overwrite `_searchResults` unpredictably when earlier async results arrived after newer ones
- Added `_photoSearchToken` counter to discard stale results

## Code Cleanup

### Extracted shared helpers in `images.py`
- `_strip_data_url()` replaces 3 duplicated `img_data.split(",", 1)[1]` calls
- `_decode_base64()` replaces 2 duplicated base64 decode + size validation blocks

### Extracted `_parse_prices()` in `discogs.py`
- Consolidated identical price-parsing logic from `discogs_release_full()` and `discogs_refresh_prices()` into a single helper (~25 lines removed)

### Extracted `_send_discogs_error()` in `handler.py`
- Unified 3 identical `HTTPError`/`Exception` catch blocks for Discogs endpoints into a single method

## Screenshot Tests (new)

### Playwright test suite (`tests/screenshots/views.spec.js`)
- 12 tests across mobile (390×844) and desktop (1280×800) viewports = 24 total
- Dashboard: renders correctly (screenshot), total pressings count visible
- Collection: grid renders (screenshot), filter input visible, sort defaults to "Recently Added"
- Scanner: barcode/photo/search modes (3 screenshots), search results in bottom sheet (screenshot), closes cleanly
- Detail modal: opens with record data (screenshot)
- Navigation: bottom nav switches views (mobile only, skipped on desktop)

### Test infrastructure
- `playwright.config.js`: dual-project config, `webServer` auto-starts Python server, 2% pixel diff tolerance
- `package.json`: Playwright dev dependency with `test:screenshots` scripts
- `.gitignore`: added `node_modules/`, `package-lock.json`, `test-results/`, `playwright-report/`, `blob-report/`

### CI integration (`.github/workflows/ci.yml`)
- Added `screenshot-tests` job: Python 3.13 + Node.js 24, installs Playwright + Chromium
- First run generates Linux baselines (uploaded as artifact for committing); subsequent runs compare against them
- Uploads `playwright-report/` and screenshot diffs as artifacts on failure

## Files modified

| File | Change |
|------|--------|
| `server/handler.py` | Fixed TOCTOU race, added CORS to `send_file()`, extracted `_send_discogs_error()` |
| `server/database.py` | Added `_db_add_unlocked()`, corrupted JSON recovery in `_load()` |
| `server/images.py` | Temp file cleanup, Claude response bounds check, extracted `_strip_data_url()` / `_decode_base64()` |
| `server/discogs.py` | Extracted `_parse_prices()` helper, removed duplicated parsing |
| `static/js/photo-search.js` | Added `_photoSearchToken` to prevent stale search results |
| `tests/screenshots/views.spec.js` | New: 12 Playwright screenshot tests (24 with both viewports) |
| `playwright.config.js` | New: Playwright config with mobile + desktop projects |
| `package.json` | New: Playwright dependency |
| `.github/workflows/ci.yml` | Added `screenshot-tests` job with Linux baseline generation |
| `.gitignore` | Added Node.js and Playwright entries |
