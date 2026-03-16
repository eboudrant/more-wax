# feat(rating): display Discogs community rating across the app

**Date:** 2026-03-15
**Branch:** add_rating
**Type:** Feature

## Intent

Display the Discogs community release rating throughout the web app — on the gallery grid, detail modal, and add-record confirm step. The rating should be fetched alongside prices and refreshed using the same mechanism, while being mindful of Discogs API rate limits.

### Prompts summary

1. Add the Discogs community release rating to the scan flow, gallery cards, and detail page. Refresh ratings at the same time as prices.
2. Optimize the rating fetch to avoid Discogs API rate limit bans — skip the extra API call when rating is already known, and increase the batch refresh delay.

## Changes

### `server/discogs.py`

**`discogs_release_full()`**: Extracts `community.rating.average` and `community.rating.count` from the Discogs `/releases/{id}` response. Stored as `rating_average` and `rating_count` string fields in the returned dict.

**`discogs_refresh_prices(release_id, fetch_rating=True)`**: Added optional `fetch_rating` parameter. When `True`, makes an additional `/releases/{id}` call to fetch the community rating. When `False`, skips the call to save one API hit per record (used by batch refresh when rating is already known).

### `server/handler.py`

**`_api_add()`**: Added `rating_average` and `rating_count` to the allowed fields whitelist for record creation.

**`_api_update()`**: Added `rating_average` and `rating_count` to the allowed fields whitelist for record updates.

**`_api_refresh_all_prices()`**: Staleness check now includes `not r.get("rating_average")` so records missing a rating are also refreshed. Each record checks `needs_rating` before calling `discogs_refresh_prices()` with `fetch_rating=False` when rating already exists. Batch delay increased from 1.5s to 2.5s to account for the additional API call.

### `static/js/helpers.js`

**`ratingStars(avg, count, compact=false)`**: Renders 5 star icons (full `bi-star-fill` / half `bi-star-half` / empty `bi-star`) in amber (#f59e0b). Default mode shows a `meta-row` with label "Rating", numeric score, and vote count. Compact mode returns an inline span with stars and short score.

**`ratingBadge(r)`**: Returns a compact `<span class="record-rating-badge">` with a filled star icon and numeric score for use in gallery cards.

### `static/js/collection.js`

**`renderCollection()`**: Gallery card meta-row now includes `ratingBadge(r)` between the year and price badge.

**`_backgroundRefreshPrices()`**: Staleness filter includes `!r.rating_average`. Polling delay updated from 1500ms to 2500ms per record to match the increased backend delay.

### `static/js/detail.js`

**`_renderDetailBody()`**: Added `<div id="detail-rating-area">` before the price area, rendering `ratingStars()` in full mode.

**`showDetail()`**: Auto-refresh now also triggers when `!r.rating_average`.

**`_refreshDetailPrices()`**: Iterates over `rating_average` and `rating_count` alongside price fields. Updates `#detail-rating-area` in the modal after refresh. Persists rating fields to backend via `apiPut`.

**`_updateCardBadge()`**: Also updates the `.record-rating-badge` on the gallery card when the rating is refreshed from the detail view.

### `static/js/add-modal.js`

**`renderConfirmStep()`**: Added `ratingStars(r.rating_average, r.rating_count)` before the price row in the confirm step.

### `static/styles.css`

**`.record-rating-badge`**: Amber-themed badge (font-size .66rem, background `rgba(245,158,11,.1)`, border-radius 4px) matching the existing price badge style.

## Rate limit mitigation

The Discogs release endpoint (`/releases/{id}`) is needed for ratings but costs one extra API call per record on top of the two marketplace calls (stats + suggestions). To avoid 429 errors:

1. **`fetch_rating` flag**: Batch refresh only fetches rating when it's missing.
2. **Increased batch delay**: 1.5s to 2.5s per record during background refresh.
3. **Single-record refresh** (detail view): Always fetches rating (3 calls total) since it's one-off and user-initiated.
4. **Initial scan/add**: Rating comes for free from `discogs_release_full()` which already calls `/releases/{id}`.
