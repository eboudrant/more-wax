# feat(scanner): full-screen camera scanner replacing modal add flow

**Date:** 2026-03-18
**Branch:** new_design_1
**Type:** Feature

## Intent

Replace the modal-based "add record" flow (method picker → separate screens) with a full-screen camera-first scanner inspired by Stitch design exports. The scanner provides a unified camera feed with BARCODE/PHOTO/SEARCH mode toggle, and results appear as a bottom sheet over the live camera view.

### Prompts summary

1. Refresh the camera design based on Stitch export mockups — full-screen scanner with barcode/photo/search segmented toggle, persistent camera across modes, and results as a bottom sheet overlay.
2. Fix scanner layout when camera is unavailable — keep the frame visible with fallback UI instead of hiding it.
3. Fix bottom sheet footer buttons clipped — switch sheet to flexbox layout so footer stays pinned below scrollable body.
4. Change default collection sort to "Recently Added" in both state and UI dropdown.
5. Fix carousel swipe multiplier — items moving 3x faster than touch due to percentage calculation on a 300%-wide track.
6. Remove estimated collection value from the dashboard home page.

## Changes

### New: Full-screen scanner view (`index.html`, `styles.css`)
- Added `#view-scanner` as a fixed overlay (z-60) with live video feed, dimming overlay, top bar (close/title/flashlight), scanner frame with gold corner accents and animated scan line, bottom controls area (shutter button, upload link, mode toggle), search panel, and bottom sheet with drag-to-dismiss
- Scanner frame uses vignette effect (`box-shadow: 0 0 0 9999px`) and switches between 4:3 (barcode) and square (photo) aspect ratios
- Mode toggle is a pill-shaped segmented control with active state using gold gradient
- Bottom sheet uses flex layout with scrollable body and sticky footer, cubic-bezier animation
- Desktop: scanner constrained to 430px centered column

### Rewritten: Scanner controller (`add-modal.js`)
- `openScanner()` / `closeScanner()` replace the old modal open/close, with history API support for back-button dismissal
- `switchScannerMode(mode)` toggles between barcode (scan line + Quagga), photo (shutter + upload), and search (input panel) — camera stays running across all modes
- `openSheet()` / `closeSheet()` manage the bottom sheet with touch drag-to-dismiss
- `showResultsInSheet()` renders Discogs results as cards with album art, metadata, and add button
- `showConfirmInSheet()` shows the full release details with cover capture/upload, metadata table, genre tags, notes, and save button
- Legacy aliases (`openAddModal`, `closeAddModal`) kept for compatibility

### Refactored: Camera module (`camera.js`)
- Persistent camera stream shared across all scanner modes — only Quagga polling starts/stops, camera stays alive
- `startQuaggaPolling()` uses `decodeSingle()` on canvas frames (250ms interval) instead of Quagga LiveStream, requiring 3 consistent reads before triggering results
- Camera error fallback keeps frame visible and only hides scan line

### Adapted: Photo search (`photo-search.js`)
- `processSearchPhotoForScanner()` uses shared camera for capture, tries Quagga barcode detection first, falls back to Claude Vision identification
- Progressive Discogs search strategy: barcode → catalog+artist+title → artist+title → artist only
- Manual search fallback rendered inline in sheet body

### Cleaned up: Search module (`search.js`)
- Removed dead code (old modal-targeting functions `doSearch`, `fetchAndShowResults`, `selectRelease`, `renderResultsList`) — all search logic now in `add-modal.js`

### Other changes
- Default sort changed from "Artist A-Z" to "Recently Added" (`state.js`, `index.html`)
- Carousel swipe multiplier fixed from `* 100` to `* 33.3333` for 1:1 touch tracking (`detail.js`)
- Removed estimated collection value from dashboard (`dashboard.js`)
- Old `#add-modal` HTML block removed from `index.html`

## Files modified

| File | Change |
|------|--------|
| `static/index.html` | Added `#view-scanner` HTML, updated entry points, removed `#add-modal`, reordered sort dropdown |
| `static/styles.css` | Added scanner CSS (~100 lines): frame, sheet, toggle, scan line animation, desktop constraint |
| `static/js/add-modal.js` | Complete rewrite as scanner controller with bottom sheet |
| `static/js/camera.js` | Refactored to persistent camera with Quagga polling |
| `static/js/photo-search.js` | Adapted for scanner context with shared camera |
| `static/js/search.js` | Removed dead code, functions moved to add-modal.js |
| `static/js/state.js` | Added `scannerMode`, `quaggaPollTimer`, `scannerOpen`; changed default sort |
| `static/js/init.js` | Removed old modal event listener |
| `static/js/detail.js` | Fixed swipe multiplier |
| `static/js/dashboard.js` | Removed estimated value |
