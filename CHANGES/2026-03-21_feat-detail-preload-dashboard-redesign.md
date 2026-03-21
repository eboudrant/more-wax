# feat: detail preloading, dashboard redesign, UI fixes

**Date:** 2026-03-21
**Type:** Feature / UI

## Intent

Eliminate flickering when navigating between detail pages by pre-fetching cached data, redesign the dashboard with random picks and status info, and fix several UI issues.

### Prompts summary

1. Fix flickering when tracklist loads after main content on detail pages
2. Ensure detail panel respects min-height on desktop and full height on mobile
3. Fix search icon position and overlap on dashboard
4. Replace dashboard Total Pressings card with random picks and recently added sections
5. Add refresh button for random picks, remove "View Entire Collection" link
6. Shorten search placeholder, match filter styling
7. Replace Authenticated Metadata card with connections and collection stats
8. Fix bottom nav icons shifting when switching tabs
9. Remove collection header titles, make filter/sort compact and sticky
10. Make cover sizes uniform on desktop

## Detail preloading

### Pre-fetch cached `discogs_extra` before rendering (`detail.js`)
- Added `_preloadExtra(r)` that fetches full record from `/api/collection/{id}` (which includes cached `discogs_extra` via `db_get()`)
- `showDetail()` awaits preload before first render — cached tracklist/credits appear inline immediately
- `_navigateDetail()` starts preload in parallel with the 280ms slide animation, awaits result before DOM swap
- Records viewed for the first time still lazy-load from Discogs API; subsequent views are instant

### Mobile full-height detail panel (`styles.css`)
- Added `min-height: 100dvh` to `#detail-body` on mobile viewports
- Desktop keeps `min-height: 60vh`

### Cleanup
- Removed unused `_renderPeekHtml()` function
- Added `.catch(() => {})` safety on prefetch await in navigation handler

## Dashboard redesign

### Removed Total Pressings section (`index.html`)
- Record count already visible in header badge ("436 records")

### Random Picks section (`index.html`, `dashboard.js`)
- Shows 6 random records from the collection, shuffled on page load
- Refresh button next to heading cycles through the full shuffled collection before repeating
- Desktop: 6 columns (single row); tablet: 3 columns; mobile: 2 columns

### Recently Added section (`index.html`, `dashboard.js`)
- Shows the last 4 records added (sorted by ID descending)

### Connections & Stats cards (`dashboard.js`)
- Replaced "Authenticated Metadata" blurb with live status from `/api/status`
- Connections card: Discogs (username + green/red dot), Claude AI (cover identification status)
- Collection Stats card: estimated total value, average rating, pricing coverage
- Side-by-side on desktop, stacked on mobile

### Search field restyled (`index.html`)
- Matches collection filter style (compact underline, not full-width hero input)
- Clickable search button instead of icon-only decoration
- No search-as-you-type — triggers on Enter or button click
- Shortened placeholder to "Search your vault…"

## Collection view

### Removed header titles (`index.html`, `collection.js`)
- Removed "Vaulted Selection" heading and "Curating N pressings" subtitle
- Removed `#collection-subtitle` element and JS update code

### Compact sticky filter bar (`index.html`)
- Filter input and sort dropdown on a single line
- Sort labels shortened: "Recent", "Artist", "Title", "Year", "Price"
- Sticky below header with frosted glass background

## Bottom nav fix (`styles.css`)

- Items use `flex: 1` with consistent padding — no size change on active state
- Active state only changes color/opacity, removing the pill background that caused layout shift

## Tests updated

### Screenshot test fixes (`views.spec.js`, `fixtures.js`)
- Replaced `#dash-count` test with `#dash-picks` / `#dash-recent` / `#nav-badge` assertions
- Fixed `showDetail()` evaluate call — fire-and-forget async to avoid "execution context destroyed"
- Added mock route for `/api/collection/*/details` endpoint
- Updated all screenshot baselines

## Files modified

| File | Change |
|------|--------|
| `static/js/detail.js` | Added `_preloadExtra()`, async prefetch in `showDetail` and `_navigateDetail`, removed `_renderPeekHtml` |
| `static/js/dashboard.js` | Rewritten: random picks with shuffle/rotation, recently added, connections & stats rendering |
| `static/js/collection.js` | Removed `#collection-subtitle` reference |
| `static/index.html` | Dashboard redesign, collection header removal, sticky filter, search restyle, bottom nav cleanup |
| `static/styles.css` | Bottom nav fix, mobile detail min-height |
| `tests/screenshots/views.spec.js` | Updated dashboard test, fixed detail modal test |
| `tests/screenshots/fixtures.js` | Added `/api/collection/*/details` mock route |
