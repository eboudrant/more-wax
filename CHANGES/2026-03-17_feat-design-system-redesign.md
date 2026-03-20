# feat(ui): complete design system redesign — Tailwind CSS, dashboard, editorial aesthetic

**Date:** 2026-03-17
**Branch:** ui_tweaks
**Type:** Design System Overhaul

## Intent

Replace Bootstrap 5 with Tailwind CSS and implement a new "Digital Archivist" design system featuring a warm gold-on-charcoal palette, Noto Serif + Manrope typography, glassmorphism navigation, surface-based hierarchy (no borders), and an editorial gallery layout. Add a new Dashboard home view with collection stats and recently archived records. Add client-side hash-based view routing for SPA navigation.

### Prompts summary

1. Implement the design system from the Stitch export covering 4 screens: Dashboard (new), Collection Gallery, Record Details, and Add to Collection.
2. Switch from Bootstrap 5 CSS/JS to Tailwind CSS CDN with inline config mapping all design tokens.
3. Add Google Fonts (Noto Serif for headlines, Manrope for body text).
4. Build a custom modal system to replace Bootstrap Modal with the same API surface.
5. Add hash-based view routing for dashboard and collection views.
6. Create a Dashboard view with collection value stats, total pressings count, search bar, and recently archived grid.
7. Redesign the Collection Gallery with "Vaulted Selection" header, editorial subtitle, bottom-border-only filter input, and responsive 2/3/4-column grid.
8. Redesign the Record Detail modal with editorial layout — large Noto Serif title, italic artist, merged genre/style chips, bento-style Discogs Value card with gold median price, technical specs card, and carousel pager.
9. Restyle the Add to Collection modal with method cards, search results as horizontal cards, and gold gradient primary CTA.
10. Add glassmorphism header and bottom navigation bar.
11. Migrate all remaining Bootstrap utility classes in photo-search.js and search.js to Tailwind equivalents.

## Changes

### `static/index.html`

**Head**: Replaced Bootstrap CSS CDN with Tailwind CDN script and inline `tailwind.config` defining all design tokens — colors (`bg`, `surface`, `surface-high`, `surface-highest`, `primary`, `primary-container`, `on-primary`, `on-surface`, `on-surface-v`, `outline-v`, `surface-low`), font families (`headline: Noto Serif`, `body/sans: Manrope`), and border-radius scale. Added Google Fonts link for Noto Serif (400, 700, 700 italic) and Manrope (400–800). Removed Bootstrap JS bundle script. Added script tags for new modules: `modal.js`, `router.js`, `dashboard.js`.

**Header**: Converted to sticky glassmorphism bar with `bg-bg/80 backdrop-blur-xl`. Added vinyl center label logo SVG inline. Added desktop nav links (hidden below `md` breakpoint) with `nav-link-top` class. Added record count badge.

**View containers**: Restructured body into `#view-dashboard` and `#view-collection` containers. Dashboard contains bento stats grid (collection value card spanning 2 cols, total pressings card with "Add New Vinyl" CTA), search bar, recently archived section with `recordCardHtml()` cards, and "Authenticated Metadata" info block. Collection container holds toolbar, filter input, sort dropdown, `#collection-grid`, and `#collection-empty` state.

**Bottom nav**: New fixed `#bottom-nav` (visible below `md`) with Home, Collection, and Add items using `bottom-nav-item` class. Active state uses gold gradient pill.

**Modals**: Converted from Bootstrap `modal`/`modal-dialog`/`modal-content` classes to custom `app-modal`/`app-modal-dialog`/`app-modal-content` classes. Detail modal uses `app-modal-scrollable` with `app-modal-lg`.

### `static/js/modal.js` (new)

Custom modal system replacing Bootstrap Modal. IIFE module exposing `AppModal.show(id, options)`, `AppModal.hide(id)`, `AppModal.getInstance(id)`. Features: backdrop creation with click-to-close (configurable `staticBackdrop` option), body scroll lock using `position: fixed` technique preserving scroll position, Escape key handler, `data-dismiss="modal"` attribute delegation, CSS transition orchestration (opacity + translateY), and `modal:hidden` CustomEvent dispatch on close.

### `static/js/router.js` (new)

Hash-based SPA view router. `navigateTo(view)` toggles visibility of `#view-dashboard` and `#view-collection` containers, updates `history.replaceState`, sets active state on both bottom nav items (`.bottom-nav-item[data-view]`) and top nav links (`.nav-link-top[data-view]`), and calls `renderDashboard()` or `renderCollection()`. Listens to `hashchange` for browser back/forward. Helper `_getViewFromHash()` defaults to `dashboard`.

### `static/js/dashboard.js` (new)

`renderDashboard()` computes client-side stats from the global `collection` array: total record count, sum of `price_median` values formatted as currency, and the 8 most recently added records (sorted by descending ID). Populates `#dash-value`, `#dash-count`, `#dash-recent` (using `recordCardHtml()`), and `#collection-subtitle`.

### `static/js/helpers.js`

**`recordCardHtml(r)`**: New shared card template used by both collection grid and dashboard. Renders album art with `rounded-lg aspect-square object-cover shadow-2xl` and `hover:scale-[1.02]` transition. Title in Noto Serif (`font-headline font-bold`), artist in Manrope, year and label on a metadata line with dot separator. Includes rating badge and price badge. Click handler calls `openDetail(id)`.

### `static/js/state.js`

Added `currentView = 'dashboard'` to track active view for the router.

### `static/js/init.js`

Changed to `async` function. Awaits `loadCollection()` before calling `navigateTo(_getViewFromHash())`. Changed `hidden.bs.modal` event listener to `modal:hidden` for custom modal system.

### `static/js/detail.js`

**`_renderPanelHtml(r)`**: Complete rewrite with Tailwind classes. Editorial layout — large cover image (`max-h-[60vh]` on desktop, full-width on mobile), Noto Serif title, italic artist in `text-on-surface-v`, merged genre/style chips as `bg-surface-high rounded px-3 py-1` tags. Copy and Discogs link buttons as icon-only overlay buttons.

**`_editorialPriceCard(r)`**: New function rendering bento-style Discogs Value card with `bg-surface rounded-xl p-6`, large gold median price, low/high/for-sale stats row, and star rating.

**`_specRow(label, value)`**: New helper for technical specs rows with `border-b border-outline-v/10` separator.

**Modal integration**: All `bootstrap.Modal` references replaced with `AppModal`. `openDetail()` calls `AppModal.show('detail-modal')`. `confirmDelete()` uses `AppModal.hide('detail-modal')`.

**Carousel pager**: Preserved 3-panel carousel with `_detailList`, `_detailIndex`, `_navigateDetail()`, touch/swipe handlers, keyboard navigation, and pull-to-dismiss. Desktop arrow buttons use `detail-overlay-btn` class (hidden on mobile via `hidden sm:flex`).

### `static/js/collection.js`

**`renderCollection()`**: Uses `recordCardHtml(r)` from helpers instead of inline card template. Updates `#collection-subtitle` text. Empty state uses `classList.add/remove('hidden')`.

**`setSort()`**: Simplified — removed Bootstrap `.sort-btn` class toggling.

### `static/js/add-modal.js`

Complete rewrite with Tailwind classes. `openAddModal()` uses `AppModal.show('add-modal', { staticBackdrop: true })`. Method cards use `.method-card` class. All step templates converted from Bootstrap grid/utility classes to Tailwind equivalents (`flex`, `gap-*`, `rounded-xl`, `bg-surface-high`). Confirm step uses `grid grid-cols-1 sm:grid-cols-[160px_1fr]` layout. Buttons use `.btn-primary-new` and `.btn-ghost-new`. Spinners use Tailwind `animate-spin` instead of Bootstrap `spinner-border`.

### `static/js/search.js`

Complete rewrite with Tailwind classes. Search results styled as horizontal cards with cover thumbnail + metadata (`bg-surface-low rounded-xl` with `hover:bg-surface`). Spinner uses `animate-spin`. Error states use Tailwind typography utilities.

### `static/js/photo-search.js`

Replaced all Bootstrap utility classes (`me-1`, `mt-2`, `spinner-border`, `form-control`, `input-group`, `btn btn-accent`) with Tailwind equivalents (`mr-1`, `mt-3`, `animate-spin`, bottom-border input, `flex gap-2`, `btn-primary-new`).

### `static/styles.css`

Complete rewrite. Updated `:root` CSS custom properties to new palette (`--bg: #131313`, `--surface: #201f1f`, `--surface2: #2a2a2a`, `--accent: #fddcb1`). New sections: custom modal system (`.app-modal`, `.app-modal-backdrop`, transitions, full-screen on mobile below 639px), detail overlay buttons, carousel track CSS, new button classes (`.btn-primary-new` with gold gradient, `.btn-ghost-new`), method card styling, navigation styles (`.bottom-nav-item` with gold gradient active state, `.nav-link-top`), and badge styles (`.record-price-badge`, `.record-rating-badge`). Kept camera/barcode CSS, toast CSS, scrollbar styling, and Quagga canvas rules.
