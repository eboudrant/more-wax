# fix: scanner showing on desktop load, README cleanup

**Date:** 2026-03-20
**Type:** Bug fix / Docs

## Intent

Fix the scanner view appearing on desktop page load, hide the Add button on devices without a camera, and clean up the README for open source release.

### Prompts summary

1. Fix scanner UI showing on desktop instead of dashboard on page load
2. Hide Add button on desktop when no webcam is available
3. Make Docker the recommended install method in README
4. Add bold callout that a Discogs token is required
5. Clarify that an Anthropic API key is optional and only needed for photo search
6. Remove Server and Client code tree sections from README
7. Remove API endpoints section from README
8. Add "Built with" section crediting Claude Code and Google Stitch
9. Clean up leftover test files in data/ directory
10. Security audit — confirmed no secrets in git history

## Changes

### Fixed: scanner showing on desktop page load
- Root cause: CSS media query had `#view-scanner { display: flex !important }` for desktop, which overrode the `display:none` inline style
- Fix: scoped the rule to `#view-scanner.open` and toggle the `open` class in JS open/close functions
- Switched from Tailwind `hidden`/`flex-col` classes to explicit inline `display` style to avoid Tailwind specificity conflicts

### New: hide Add button when no camera available
- On desktop (non-touch devices), check `enumerateDevices()` for `videoinput`
- If no webcam found, hide Add from desktop nav, mobile nav, and dashboard
- Touch devices always show Add (camera is expected even before permission is granted)

### Updated: README
- Docker is now Option A (recommended), setup wizard is Option B
- Bold callout: Discogs personal access token is required
- Bold callout: Anthropic API key is optional, only for photo search
- Removed server and client code tree sections (too much internal detail for users)
- Removed API endpoints section
- Added "Built with" section: Claude Code and Google Stitch

### Cleaned up: data/ directory
- Removed leftover test files: collection.db, test.db, test2.db, test.json, test2.json, test_cert.txt

## Files modified

| File | Change |
|------|--------|
| `static/styles.css` | Fixed: `#view-scanner` → `#view-scanner.open` in desktop media query; separated search panel transform from sheet |
| `static/js/add-modal.js` | Fixed: toggle `open` class and use inline `display` style for scanner visibility |
| `static/js/init.js` | New: `_checkCamera()` hides Add buttons on desktop without webcam |
| `static/index.html` | Fixed: removed `flex-col` class, use inline `display:none` on scanner div |
| `README.md` | Updated: Docker recommended, bold API key callouts, removed code trees and API endpoints, added Built With |
