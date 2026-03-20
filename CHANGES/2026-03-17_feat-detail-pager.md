# feat(detail): carousel pager with swipe, keyboard, and pull-to-dismiss

**Date:** 2026-03-17
**Branch:** main
**Type:** Feature

## Intent

Add a carousel-style pager to the detail modal so users can navigate through records without closing and reopening. On mobile, swipe left/right reveals the adjacent record sliding in from the side. On desktop, arrow buttons and keyboard arrows provide the same navigation. A pull-to-dismiss gesture lets users close the modal by swiping down when scrolled to the top.

### Prompts summary

1. Restore the detail pager feature that was lost during a merge — add swipe left/right, keyboard arrow, and button navigation to the detail modal following the current gallery sort/filter order.
2. Redesign swipe as a true carousel — during the gesture the next/previous record should be visible sliding in, not just a fade transition.
3. Fix layout issues — cover art too large on mobile and broken layout on desktop due to panel width being 100% instead of 33.3333% of the track.
4. Fix vertical scrolling blocked by `overflow: hidden` on the detail body — changed to `overflow-x: clip; overflow-y: auto`.
5. Remove the sticky header bar and make the nav/close buttons float as a sticky overlay on top of the cover image.
6. Remove the X/Y position counter text and hide the previous/next arrow buttons on mobile (swipe is used instead).
7. Fix arrow buttons rendering as ovals by removing Bootstrap `btn` classes that added extra padding.
8. Ensure the close button is always right-aligned including on mobile when nav arrows are hidden.
9. Reduce extra vertical padding after the delete button.
10. Add pull-to-dismiss — when scrolled to the top, swiping down slides the modal content away and closes it. Fix the dismiss animation to be a clean continuous slide-down rather than a conflicting fade.

## Changes

### `static/js/detail.js`

**Architecture**: Refactored from single-panel rendering to a 3-panel carousel.

**`_renderPanelHtml(r)`**: New function. Returns HTML string for a single `.detail-panel` containing cover, title/artist, tags, metadata, rating, prices, notes, and remove button. Returns an empty panel div when `r` is null (boundary slots).

**`_renderDetailBody(r)`**: Now builds a `.detail-overlay-bar` (sticky floating nav + close buttons with negative bottom margin to overlap cover) and a `.detail-track` containing three panels (prev, current, next). Nav arrows use `d-none d-sm-flex` to hide on mobile. Close button uses plain `.detail-overlay-btn` class (no Bootstrap btn classes).

**Navigation state**: `_detailList` (snapshot of `sortedFiltered()`), `_detailIndex`, `_detailSwipe` (touch state object), `_detailAnimating` (lock flag), `_detailListenersAttached`.

**`showDetail(id)`**: Snapshots `sortedFiltered()`, finds record index, renders carousel, reuses existing Bootstrap Modal instance via `getInstance()`, attaches listeners, triggers auto-refresh if needed.

**`_updateDetailNav()`**: Enables/disables prev/next buttons based on boundary position.

**`_navigateDetail(dir)`**: Slides the track from center (`-33.3333%`) to target panel (`-66.6666%` for next, `0%` for prev) via CSS transition. On `transitionend`, re-renders track centered on new record. Guarded by `_detailAnimating` flag.

**`_detailKeyHandler(e)`**: ArrowLeft/ArrowRight mapped to `_navigateDetail(-1/1)`.

**Touch handling — 3 gesture modes**:
- `_detailTouchStart`: Records start position, checks `body.scrollTop <= 0` for pull-to-dismiss eligibility.
- `_detailTouchMove`: Locks direction on first >10px movement. `'h'` mode: translates track proportionally with 20% boundary dampening. `'pull'` mode: translates `modal-content` down with 50% dampening and fades opacity. `'v'` mode: no interference (normal scroll).
- `_detailTouchEnd`: Horizontal — commits navigation if >60px, else snaps back with transition. Pull — dismisses if >100px (slides content to `window.innerHeight`, then hides modal instantly by temporarily removing `.fade` class to bypass Bootstrap animation), else snaps back.

**`_attachDetailListeners(modalEl)`**: Guards double-attach. Registers keydown on document, touch events on `detail-body`. Cleans up all listeners and resets state on `hidden.bs.modal`.

### `static/styles.css`

**`.detail-overlay-bar`**: Replaces `.detail-close-btn`. `position: sticky; top: 0; z-index: 10`, `justify-content: flex-end` (close button always right), `margin-bottom: -48px` (overlaps cover), `pointer-events: none` on container with `auto` on children. `.detail-nav` gets `margin-right: auto` to push arrows left.

**`.detail-overlay-btn`**: 32×32px circle, `border-radius: 50%`, `rgba(0,0,0,.55)` background, no padding, no Bootstrap btn inheritance. Hover darkens to `.75`.

**`.detail-nav`**: Flex container with 6px gap. `.btn:disabled` at 25% opacity.

**`#detail-body`**: `overflow-x: clip; overflow-y: auto` — clips horizontal carousel overflow while allowing vertical scroll.

**`.detail-track`**: `display: flex; width: 300%; transform: translateX(-33.3333%); will-change: transform`. `.animating` class adds `transition: transform 280ms cubic-bezier(.4,0,.2,1)`.

**`.detail-panel`**: `width: 33.3333%; flex-shrink: 0; min-width: 0`.

**`.detail-cover`**: Added `max-height: 50vh; object-fit: contain; background: #000` globally. Desktop override changed to `max-height: 340px`.

**`#detail-modal .detail-info`**: Bottom padding reduced from 16px to 8px.
