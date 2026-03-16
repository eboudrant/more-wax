// ─────────────────────────────────────────────────────────────────
//  DETAIL MODAL — pager with swipe / keyboard / arrow navigation
// ─────────────────────────────────────────────────────────────────
let _detailList  = [];   // snapshot of sortedFiltered() when modal opens
let _detailIndex = -1;   // current position in _detailList
let _detailSwipe = null; // touch tracking state

function _renderDetailBody(r) {
  const cover    = r.local_cover || r.cover_image_url;
  const coverHtml = cover
    ? `<img src="${esc(cover)}" class="detail-cover mb-3"
            onerror="this.style.display='none'">`
    : `<div class="cover-placeholder-large mb-3">
         <i class="bi bi-vinyl display-1"></i>
       </div>`;

  const genres = parseList(r.genres);
  const styles = parseList(r.styles);
  const hasPrices = r.price_median || r.price_high || r.price_low;

  document.getElementById('detail-title').textContent = r.title;
  document.getElementById('detail-body').innerHTML = `
    <div class="row g-4">
      <div class="col-md-4 text-center">${coverHtml}</div>
      <div class="col-md-8">
        <h4 class="mb-0">${esc(r.title)}</h4>
        <h5 class="text-muted mb-3">${esc(r.artist)}</h5>

        ${metaRow('Year',    r.year)}
        ${metaRow('Label',   r.label)}
        ${metaRow('Cat #',   r.catalog_number)}
        ${metaRow('Format',  r.format)}
        ${metaRow('Country', r.country)}
        ${metaRow('Barcode', r.barcode)}
        <div id="detail-rating-area">${typeof ratingStars === 'function' ? ratingStars(r.rating_average, r.rating_count) : ''}</div>
        <div id="detail-price-area">${hasPrices ? priceRow(r) : (r.discogs_id ? '<div class="meta-row" style="color:var(--muted);font-size:.82rem"><i class="bi bi-arrow-repeat me-1"></i>Fetching prices…</div>' : '')}</div>

        ${genres.length ? `
          <div class="meta-row">
            <span class="label">Genres</span>
            <span class="value">${genres.map(g => `<span class="genre-pill">${esc(g)}</span>`).join('')}</span>
          </div>` : ''}
        ${styles.length ? `
          <div class="meta-row">
            <span class="label">Styles</span>
            <span class="value">${styles.map(s => `<span class="genre-pill">${esc(s)}</span>`).join('')}</span>
          </div>` : ''}

        ${r.notes ? `
          <div class="mt-3">
            <div class="label mb-1" style="color:var(--muted);font-size:.82rem">Notes</div>
            <div style="font-size:.88rem">${esc(r.notes)}</div>
          </div>` : ''}

        <div class="mt-4 d-flex gap-2 flex-wrap">
          ${r.discogs_id
            ? `<a href="https://www.discogs.com/release/${r.discogs_id}" target="_blank"
                  class="btn btn-sm btn-ghost">
                 <i class="bi bi-box-arrow-up-right me-1"></i>View on Discogs
               </a>`
            : ''}
          <button class="btn btn-sm btn-danger" onclick="confirmDelete(${r.id})">
            <i class="bi bi-trash me-1"></i>Remove
          </button>
        </div>
      </div>
    </div>`;
}

// ── Navigation state ────────────────────────────────────────────

function _updateDetailNav() {
  const pos  = document.getElementById('detail-pos');
  const prev = document.getElementById('detail-prev');
  const next = document.getElementById('detail-next');
  if (!pos) return;
  pos.textContent = `${_detailIndex + 1} / ${_detailList.length}`;
  prev.disabled = _detailIndex <= 0;
  next.disabled = _detailIndex >= _detailList.length - 1;
}

function _navigateDetail(dir) {
  const newIdx = _detailIndex + dir;
  if (newIdx < 0 || newIdx >= _detailList.length) return;

  const body = document.getElementById('detail-body');
  const slideOut = dir > 0 ? 'detail-slide-out-left' : 'detail-slide-out-right';
  const slideIn  = dir > 0 ? 'detail-slide-in-right' : 'detail-slide-in-left';

  body.classList.add(slideOut);
  setTimeout(() => {
    _detailIndex = newIdx;
    const r = _detailList[_detailIndex];
    _renderDetailBody(r);
    _updateDetailNav();

    body.classList.remove(slideOut);
    body.classList.add(slideIn);
    setTimeout(() => body.classList.remove(slideIn), 200);

    // Auto-refresh prices/rating if missing
    if (r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average)) {
      _refreshDetailPrices(r);
    }
  }, 150);
}

// ── Show detail (entry point) ───────────────────────────────────

async function showDetail(id) {
  const r = collection.find(x => x.id === id);
  if (!r) return;

  // Snapshot the current sort/filter order for paging
  _detailList  = sortedFiltered();
  _detailIndex = _detailList.findIndex(x => x.id === id);
  if (_detailIndex === -1) { _detailList = [r]; _detailIndex = 0; }

  _renderDetailBody(r);
  _updateDetailNav();

  const modalEl = document.getElementById('detail-modal');
  // Reuse existing instance or create new one
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.show();

  // Set up keyboard + swipe listeners (cleaned up on hide)
  _attachDetailListeners(modalEl);

  // Auto-refresh prices/rating if any are missing
  if (r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average)) {
    _refreshDetailPrices(r);
  }
}

// ── Keyboard navigation ─────────────────────────────────────────

function _detailKeyHandler(e) {
  if (e.key === 'ArrowLeft')  { e.preventDefault(); _navigateDetail(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); _navigateDetail(1); }
}

// ── Touch / swipe navigation ────────────────────────────────────

function _detailTouchStart(e) {
  if (e.touches.length !== 1) return;
  _detailSwipe = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, dx: 0, swiping: false };
}

function _detailTouchMove(e) {
  if (!_detailSwipe || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - _detailSwipe.startX;
  const dy = e.touches[0].clientY - _detailSwipe.startY;

  // Lock to horizontal once we determine direction (ignore if mostly vertical)
  if (!_detailSwipe.swiping) {
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { _detailSwipe = null; return; }
    if (Math.abs(dx) > 10) _detailSwipe.swiping = true;
    else return;
  }

  e.preventDefault();  // prevent scroll while swiping horizontally
  _detailSwipe.dx = dx;

  // Drag feedback — dampen at boundaries
  const atBoundary = (dx > 0 && _detailIndex <= 0) || (dx < 0 && _detailIndex >= _detailList.length - 1);
  const clamped = atBoundary ? dx * 0.2 : dx;
  document.getElementById('detail-body').style.transform = `translateX(${clamped}px)`;
}

function _detailTouchEnd() {
  if (!_detailSwipe) return;
  const body = document.getElementById('detail-body');
  const dx = _detailSwipe.dx;
  _detailSwipe = null;

  body.style.transform = '';

  if (Math.abs(dx) > 60) {
    _navigateDetail(dx < 0 ? 1 : -1);
  }
}

// ── Listener management ─────────────────────────────────────────

function _attachDetailListeners(modalEl) {
  // Avoid double-attaching
  if (modalEl._detailListenersAttached) return;
  modalEl._detailListenersAttached = true;

  document.addEventListener('keydown', _detailKeyHandler);
  const body = document.getElementById('detail-body');
  body.addEventListener('touchstart', _detailTouchStart, { passive: true });
  body.addEventListener('touchmove', _detailTouchMove, { passive: false });
  body.addEventListener('touchend', _detailTouchEnd, { passive: true });

  modalEl.addEventListener('hidden.bs.modal', function _onHide() {
    document.removeEventListener('keydown', _detailKeyHandler);
    body.removeEventListener('touchstart', _detailTouchStart);
    body.removeEventListener('touchmove', _detailTouchMove);
    body.removeEventListener('touchend', _detailTouchEnd);
    modalEl.removeEventListener('hidden.bs.modal', _onHide);
    modalEl._detailListenersAttached = false;
  });
}

// ── Price/rating refresh ────────────────────────────────────────

async function _refreshDetailPrices(r) {
  try {
    const prices = await getReleasePrices(r.discogs_id);
    if (prices.error) throw new Error(prices.error);

    let changed = false;
    for (const k of ['price_low', 'price_median', 'price_high', 'price_currency', 'num_for_sale', 'rating_average', 'rating_count']) {
      if (prices[k]) { r[k] = prices[k]; changed = true; }
    }

    if (changed) {
      // Persist fresh prices + rating to backend
      await apiPut(`/api/collection/${r.id}`, {
        price_low: r.price_low || '', price_median: r.price_median || '',
        price_high: r.price_high || '', price_currency: r.price_currency || 'USD',
        num_for_sale: r.num_for_sale || '',
        rating_average: r.rating_average || '', rating_count: r.rating_count || ''
      });

      // Update the price + rating areas in the modal if it's still open
      const priceArea = document.getElementById('detail-price-area');
      if (priceArea) priceArea.innerHTML = priceRow(r);
      const ratingArea = document.getElementById('detail-rating-area');
      if (ratingArea && typeof ratingStars === 'function') ratingArea.innerHTML = ratingStars(r.rating_average, r.rating_count);

      // Update just this card's badges in-place (no full re-render)
      _updateCardBadge(r);
    }
  } catch (e) {
    console.warn('Could not refresh prices:', e.message);
    const priceArea = document.getElementById('detail-price-area');
    if (priceArea && !priceArea.querySelector('.price-badge')) {
      priceArea.innerHTML = '';
    }
    if (e.message?.includes('429')) throw e;
  }
}

function _updateCardBadge(r) {
  const card = document.querySelector(`[data-record-id="${r.id}"]`);
  if (!card) return;
  const metaRowEl = card.querySelector('.record-meta-row');
  if (!metaRowEl) return;

  // Update price badge
  const cur = r.price_currency || 'USD';
  const priceBadge = card.querySelector('.record-price-badge');
  const newPriceBadge = r.price_median && !isNaN(parseFloat(r.price_median))
    ? `<span class="record-price-badge">${cur}&nbsp;${parseFloat(r.price_median).toFixed(0)} <span style="font-size:.7em;opacity:.7;font-weight:400">med</span></span>`
    : r.price_low && !isNaN(parseFloat(r.price_low))
      ? `<span class="record-price-badge" style="opacity:.75">${cur}&nbsp;${parseFloat(r.price_low).toFixed(0)} <span style="font-size:.7em;opacity:.7;font-weight:400">low</span></span>`
      : '';
  if (priceBadge) priceBadge.outerHTML = newPriceBadge;
  else if (newPriceBadge) metaRowEl.insertAdjacentHTML('beforeend', newPriceBadge);

  // Update rating badge (if rating feature is present)
  if (typeof ratingBadge === 'function') {
    const rBadge = card.querySelector('.record-rating-badge');
    const newRatingBadge = ratingBadge(r);
    if (rBadge) rBadge.outerHTML = newRatingBadge;
    else if (newRatingBadge) {
      const yearEl = card.querySelector('.record-year');
      if (yearEl) yearEl.insertAdjacentHTML('afterend', newRatingBadge);
    }
  }
}

async function confirmDelete(id) {
  if (!confirm('Remove this record from your collection?')) return;
  await apiDelete(`/api/collection/${id}`);
  bootstrap.Modal.getInstance(document.getElementById('detail-modal'))?.hide();
  await loadCollection();
  toast('Record removed from collection', 'success');
}
