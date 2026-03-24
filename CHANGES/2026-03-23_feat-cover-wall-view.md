# feat: cover wall view for desktop collection

**Date:** 2026-03-23
**Type:** Feature

## Intent

Add a dense "wall of covers" browsing mode for desktop that shows album covers in a tight grid. Hovering a cover flips it with a 3D animation to reveal title, artist, and a link to open the detail modal.

### Prompts summary

1. Add a desktop view where the collection is a wall of covers, flip on hover to show details

## Changes

### Toggle button (`static/index.html`)
- Added view-mode toggle icon next to sort dropdown, visible only on desktop (`hidden md:inline-flex`)
- Grid icon (`bi-grid-3x3-gap`) when in wall mode, wall icon (`bi-grid-3x3`) when in grid mode

### Wall card template (`static/js/helpers.js`)
- New `wallCardHtml(r)` function generates a 3D flip card: front = cover image, back = title + artist + "View" label
- Uses same cover resolution logic as `recordCardHtml()` (local_cover → cover_image_url → vinyl icon fallback)

### Wall rendering logic (`static/js/collection.js`)
- New `_viewMode` state persisted in `localStorage`
- `toggleViewMode()` switches between `'grid'` and `'wall'`, re-renders collection
- `renderCollection()` switches grid classes and card template based on mode
- Wall grid: `grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1` for a dense layout
- Wall mode only activates on desktop (≥768px); mobile always uses card grid

### 3D flip animation (`static/styles.css`)
- CSS `perspective` + `transform-style: preserve-3d` on `.wall-card`
- `rotateY(180deg)` on hover with 500ms cubic-bezier transition
- `backface-visibility: hidden` on both faces
- Back face: dark semi-transparent overlay with centered text

### Tests (`tests/screenshots/views.spec.js`)
- New test: desktop wall view renders correctly after clicking toggle

## Files modified

| File | Change |
|------|--------|
| `static/index.html` | Toggle button in filter/sort bar |
| `static/js/helpers.js` | `wallCardHtml()` function |
| `static/js/collection.js` | View mode state, toggle, conditional rendering |
| `static/styles.css` | `.wall-card` 3D flip CSS |
| `tests/screenshots/views.spec.js` | Wall view screenshot test |
