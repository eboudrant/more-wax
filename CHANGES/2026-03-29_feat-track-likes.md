# feat: like/unlike individual tracks

**Date:** 2026-03-29
**Type:** Feature

## Intent

Allow users to like/unlike individual tracks in the tracklist. Liked tracks are stored per record and can be filtered via smart search.

### Prompts summary

1. Add heart icon toggle per track in detail view tracklist
2. Store liked_tracks array in the record
3. Add is:liked smart filter
4. Add pop animation on toggle
5. Comprehensive tests

## Changes

### `static/js/detail.js`
- `_renderTracklist(tracklist, r)` now renders a heart icon next to each track
- Heart uses inline color (`#f87171` red when liked, `#4e453c` muted when not)
- `_toggleTrackLike(btn, rid, trackId)`: toggles track in `liked_tracks` array
  - Optimistic UI update with pop animation (scale 1.4 → 1)
  - Saves via `PUT /api/collection/{id}` with `liked_tracks` field
  - Reverts on server error
- Track ID uses position (e.g. "A1") or title as fallback
- Duration column has fixed width (`w-10`) for alignment regardless of length

### `server/handler.py`
- Added `liked_tracks` to allowed update fields in `_api_update`

### `static/js/smart-filter.js`
- Added `is:liked` filter: records with any liked tracks

### `tests/test_database.py`
- `TestLikedTracks` class with 6 tests:
  - Initially absent, update, toggle, clear, list response, persistence

### `tests/screenshots/fixtures.js`
- First test record has `liked_tracks: ['A1', 'B1']`
- Tracklist mock updated to use vinyl-style positions (A1, A2, B1, B2) matching liked_tracks

### Screenshot tests
- `detail-liked-tracks.png` — new baseline showing filled hearts for liked tracks (A1, B1) and outline hearts for unliked (A2, B2)
- Updated `detail-modal.png` and `scanner-confirm.png` baselines (tracklist now has 4 tracks)

### Unit tests (`tests/test_database.py`)
- 11 liked tracks tests: initial state, update, toggle, clear, list response, persistence, order preservation, duplicates, special characters, field isolation, per-record independence

## Files modified

| File | Change |
|------|--------|
| `static/js/detail.js` | Heart icons in tracklist, toggle logic, pop animation |
| `server/handler.py` | `liked_tracks` in allowed update fields |
| `static/js/smart-filter.js` | `is:liked` filter |
| `tests/test_database.py` | 11 liked tracks unit tests |
| `tests/screenshots/fixtures.js` | Liked tracks + updated tracklist mock |
| `tests/screenshots/views.spec.js` | Liked tracks screenshot test |
| `tests/screenshots/*/detail-*.png` | Updated baselines |
| `tests/screenshots/*/scanner-confirm.png` | Updated baselines |
