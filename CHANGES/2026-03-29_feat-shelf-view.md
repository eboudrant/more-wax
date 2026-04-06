# feat: shelf view (experimental, feature-flagged)

**Date:** 2026-03-29
**Type:** Feature

## Intent

Add a realistic vinyl shelf view to the collection — records displayed as thin vertical spines (like browsing a record store), with a 3D rotation reveal on hover showing the full cover art. Stacks push aside to make room.

### Prompts summary

1. Vinyl spine view with realistic widths (3px at scale)
2. Hover reveals cover with 3D rotateY animation
3. Stack push with overlap (cover sits on top of neighbors)
4. Separate reveal element to avoid flex layout issues
5. Ship behind feature flag (off by default)
6. Modularize collection.js into focused modules

## Changes

### Modularization — `collection.js` split into 3 files

| File | Lines | Purpose |
|------|-------|---------|
| `collection.js` | 120 | Core: load, sort, filter, render dispatch, view toggle |
| `smart-filter.js` | 85 | `is:` autocomplete, ghost text, dropdown (extracted, no logic changes) |
| `view-shelf.js` | 115 | Shelf spines, 3D reveal, hover logic (new) |

### `static/js/collection.js`
- Added `'shelf'` as third view mode (grid → wall → shelf cycle)
- Feature flag: `localStorage.shelfViewEnabled === 'true'` to enable
- Auto-resets to grid if shelf was saved but flag is off
- View mode config via lookup tables (`_VIEW_MODES`, `_VIEW_ICONS`, `_VIEW_LABELS`)
- Resize listener recalculates shelf/wall layout on window resize

### `static/js/view-shelf.js` (new)
- `_coverUrl(r)` — shared helper for cover image URL resolution
- `_renderShelf(container, items)`:
  - Closed-form math for row/height sizing (no loop)
  - Cached `spines` array per row (avoids querySelectorAll on every hover)
  - Hover creates a separate absolutely-positioned reveal element
  - Reveal rotates in with `perspective(800px) rotateY(90deg → 0deg)`
  - Stacks push left/right with 25% of cover width as shift
  - `relatedTarget` checks prevent hover flickering between spine and reveal
  - `clearTimeout` tracking prevents orphaned timers
  - Click on spine or reveal opens record detail

### `static/js/smart-filter.js` (extracted from collection.js)
- Pure extraction, no logic changes

### `static/index.html`
- Added `<script>` tags for `smart-filter.js` and `view-shelf.js` before `collection.js`

## How to enable

Open browser console on the collection page:
```js
localStorage.setItem('shelfViewEnabled', 'true');
location.reload();
```

To disable:
```js
localStorage.removeItem('shelfViewEnabled');
location.reload();
```

## Known issues (why it's flagged)

- Hover can be jittery when moving quickly across many spines
- Reveal animation timing needs tuning for smooth transitions
- Push amount may need adjustment for different collection sizes
- No mobile support (desktop only)

## Files modified

| File | Change |
|------|--------|
| `static/js/collection.js` | Slimmed to core — view toggle, sort, filter, render dispatch |
| `static/js/smart-filter.js` | New — extracted smart filter autocomplete |
| `static/js/view-shelf.js` | New — shelf view with 3D reveal |
| `static/index.html` | Script tags for new modules |
