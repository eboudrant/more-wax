# feat: share record as image card

**Date:** 2026-03-29
**Type:** Feature

## Intent

Generate a shareable image card for any record — cover art, title, artist, release details, track count, QR code, and More'Wax branding. Supports native Web Share API on mobile and PNG download on desktop.

### Prompts summary

1. Add share button to detail view
2. Generate card client-side using Canvas 2D API
3. Proxy Discogs cover images to avoid CORS blocking canvas export
4. Full cover display (no cropping), portrait rectangle layout
5. Remove tracklist, show track count instead
6. Add QR code linking to GitHub repo
7. "More'Wax" branding above QR code

## Changes

### `static/js/detail.js`
- Share button in detail action bar (same style as copy/discogs buttons)
- `_shareRecord(btn, id)`: loads cover via proxy, loads QR code, draws card, exports as PNG
- `_loadShareCover(r)`: proxies Discogs images through `/api/cover-proxy` to avoid CORS
- `_loadQrCode(url)`: generates QR code via qrserver.com API
- Web Share API on mobile (native share sheet), download fallback on desktop

### `static/js/helpers.js`
- `_drawShareCard(canvas, r, coverImg, qrImg)`: Canvas 2D rendering
  - Auto-sizing portrait rectangle (1080px wide, height based on content)
  - Full-width cover (contain, no crop)
  - Title (bold 44px, wraps to 2 lines max)
  - Artist (italic 34px, gold)
  - Release details: year, label, format, country, catalog number
  - Track count
  - QR code + "More'Wax" label (right-aligned next to info block)
- `_roundRect()`, `_wrapText()`: canvas drawing helpers

### `server/handler.py`
- `GET /api/cover-proxy?url=...`: proxies Discogs cover images
  - Only allows `https://i.discogs.com/` URLs (whitelist)
  - 5MB max size, 10s timeout
  - 24h cache headers
  - Returns original content type

### Screenshot tests
- Share card test: generates card via canvas, screenshots the result
- Mock QR code (canvas-drawn pattern) for deterministic baselines
- Updated detail modal baselines (new share button visible)

## Files modified

| File | Change |
|------|--------|
| `static/js/detail.js` | Share button, `_shareRecord()`, cover proxy loader, QR loader |
| `static/js/helpers.js` | `_drawShareCard()` canvas renderer |
| `server/handler.py` | `/api/cover-proxy` endpoint |
| `tests/screenshots/views.spec.js` | Share card screenshot test |
| `tests/screenshots/*/share-card.png` | New baselines |
| `tests/screenshots/*/detail-modal.png` | Updated (share button added) |
