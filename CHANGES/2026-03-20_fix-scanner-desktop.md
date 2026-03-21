# fix: scanner UX on desktop and HTTP

**Date:** 2026-03-20
**Type:** Fix

## Intent

Fix two issues with the scanner on desktop browsers: hide the Add button on HTTP connections since camera requires HTTPS, and scale up the scanner frame on wide screens.

### Prompts summary

1. Hide Add button only on desktop without webcam, keep visible on HTTP and touch devices
2. Scale scanner frame up on desktop so it's not tiny compared to the full-page video

## Changes

### Fixed: Add button visibility (`static/js/init.js`)
- `navigator.mediaDevices` is undefined in insecure contexts (HTTP non-localhost)
- Camera requires HTTPS, so Add is hidden on HTTP connections (no point showing it)
- On desktop with HTTPS, check for a webcam via `enumerateDevices` — hide if none found
- Touch devices always show Add (camera is expected)

### Fixed: Scanner frame too small on desktop (`static/index.html`)
- Frame was capped at `max-w-sm` (384px) — fine on phones, tiny on desktop
- Added responsive breakpoints: `md:max-w-lg` (512px), `lg:max-w-xl` (576px)

### Updated: README
- Clarified that camera features require HTTPS, browsing works on HTTP

## Files modified

| File | Change |
|------|--------|
| `static/js/init.js` | Fixed: camera check hides Add on HTTP, keeps on touch devices |
| `static/index.html` | Fixed: scanner frame scales up on desktop viewports |
| `README.md` | Updated: HTTPS requirement for camera features |
