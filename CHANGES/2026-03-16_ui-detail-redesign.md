# refactor(ui): redesign detail modal and switch to black theme

**Date:** 2026-03-16
**Branch:** ui_tweaks
**Type:** UI Redesign

## Intent

Overhaul the detail modal layout for a cleaner, more immersive look — full-bleed cover image at the top, floating close button, merged genre/style tags under the title, and streamlined action buttons. Also switch the entire app from a navy color scheme to a pure black theme with neutral grey accents, and redesign the logo as a white vinyl center label.

### Prompts summary

1. Add a copy-to-clipboard button for the release title and artist name on the detail page, placed as an icon next to the title.
2. Fix clipboard not working over non-HTTPS (IP address) — the initial `navigator.clipboard` API and `document.execCommand('copy')` fallback both failed inside the Bootstrap modal's focus trap. Fixed by temporarily disabling the modal's focus enforcement and appending the textarea inside the modal element.
3. Lighten the artist name text color on the detail page — switch from Bootstrap's `text-muted` to a lighter grey.
4. Remove the duplicate title from the modal header since the title is already shown in the body.
5. Remove the sticky modal header bar entirely and make the close button a floating sticky overlay on top of the cover image.
6. Make the cover image full-bleed at the top of the modal with no padding or cropping, and have the close button overlap it with a semi-transparent dark circle background.
7. Add responsive cover sizing — cap the cover height on desktop/landscape while keeping it full-width on mobile.
8. Fix the "View on Discogs" button text not being vertically centered — added flexbox alignment to `.btn-ghost`.
9. Merge genres and styles into a single row of deduplicated tag pills placed directly under the artist name, removing the separate meta rows.
10. Adjust vertical spacing between artist name and tags to match the rest of the layout.
11. Equalize horizontal and vertical padding between tag pills.
12. Switch the color theme from navy to pure black — update all CSS custom properties for background, surface, and border colors.
13. Replace the blue accent colors with light greys throughout the app.
14. Redesign the logo SVG as a white vinyl center label with "More'Wax" as the record name, spindle hole in the center, and subtle separator lines.
15. Right-align the Remove button at the bottom of the detail view.
16. Convert the "View on Discogs" link to an icon-only button next to the copy button in the title area.

## Changes

### `static/js/detail.js`

**`_renderDetailBody()`**: Complete layout restructure. Cover image is now rendered full-bleed at the top of `modal-body` (no row/column grid). A custom close button (`detail-close-btn`) is injected as the first element. Title, artist, and action buttons are wrapped in a flex container. Genres and styles are merged into a deduplicated `tags` array rendered as pills under the artist name. "View on Discogs" moved from the bottom to an icon-only button next to the copy button. Remove button right-aligned. Artist name color changed to `#9ca3af`. Removed `document.getElementById('detail-title')` since the modal header title element no longer exists.

**`_copyDetailInfo(btn, id)`**: New function. Copies "Artist - Title" to clipboard. Uses `navigator.clipboard.writeText()` on secure contexts, falls back to `_fallbackCopy()`. Shows a checkmark icon and green highlight for 1.5s on success.

**`_fallbackCopy(text, cb)`**: New function. Clipboard fallback for non-HTTPS contexts. Temporarily disables Bootstrap modal's focus trap (`modal._config.focus = false`), creates a readonly textarea inside the modal element, selects and executes `document.execCommand('copy')`, then re-enables focus. Only calls success callback if `execCommand` returns `true`.

### `static/index.html`

**Detail modal**: Removed `modal-header` (containing duplicate title and `btn-close`), removed `modal-footer` (containing redundant close button). Modal now contains only `modal-body`.

**Theme color meta tag**: Changed from `#0a0e1a` to `#000000`.

### `static/styles.css`

**CSS custom properties**: Switched from navy to pure black theme:
- `--bg`: `#0a0e1a` → `#000000`
- `--surface`: `#111827` → `#0a0a0a`
- `--surface2`: `#1a2235` → `#161616`
- `--border`: `#253044` → `#2a2a2a`
- `--accent`: `#60a5fa` → `#d1d5db` (light grey)
- `--accent2`: `#3b82f6` → `#9ca3af` (medium grey)

**`#detail-modal .modal-body`**: Set `padding: 0` for full-bleed cover.

**`#detail-modal .detail-info`**: New rule with `padding: 16px` for the info section below the cover.

**`.detail-close-btn`**: New floating close button — `position: sticky`, `top: 8px`, `float: right`, negative bottom margin to overlap with cover, `32x32px` circle with `rgba(0,0,0,.55)` background, white `×` character.

**`.detail-cover`**: Removed `max-height: 260px`, `object-fit: cover`, and `border-radius: 8px`. Now full-width with `border-radius: 0`. Desktop media query (`min-width: 576px`) caps height at `360px` with `object-fit: contain` and black background.

**`.btn-ghost`**: Added `display: inline-flex`, `align-items: center`, `justify-content: center` to fix vertical text centering.

### `static/logo.svg`

Complete redesign. Changed from a full vinyl record (400x400) to just the center label (200x200). White label background (`#f0f0f0`), dark text (`#111`), "MORE'" above and "WAX" below the spindle hole, thin separator lines, "VINYL COLLECTION" subtitle, and a dark spindle hole in the center. Removed all vinyl grooves, gradients, shine effects, and hand-drawn letterform paths.
