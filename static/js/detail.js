// ─────────────────────────────────────────────────────────────────
//  DETAIL MODAL — Carousel pager
// ─────────────────────────────────────────────────────────────────

// ── Render a single panel's HTML (returns string) ────────────────
function _renderPanelHtml(r) {
  if (!r) return '<div class="detail-panel"></div>';

  const cover = r.local_cover || r.cover_image_url;
  const coverHtml = cover
    ? `<img src="${esc(cover)}" class="detail-cover" onerror="this.style.display='none'">`
    : `<div class="cover-placeholder-large"><i class="bi bi-vinyl display-1"></i></div>`;

  const genres = parseList(r.genres);
  const styles = parseList(r.styles);
  const tags = [...new Set([...genres, ...styles])];
  const hasPrices = r.price_median || r.price_high || r.price_low;

  return `<div class="detail-panel">
    ${coverHtml}
    <div class="detail-info">
      <div class="d-flex align-items-start gap-2">
        <div class="flex-grow-1">
          <h4 class="mb-0">${esc(r.title)}</h4>
          <h5 class="mb-2" style="color:#9ca3af">${esc(r.artist)}</h5>
          ${tags.length ? `<div class="mb-3 d-flex flex-wrap gap-2">${tags.map(t => `<span class="genre-pill">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <button class="btn btn-sm btn-ghost flex-shrink-0" onclick="_copyDetailInfo(this, ${r.id})" title="Copy artist and title">
          <i class="bi bi-clipboard"></i>
        </button>
        ${r.discogs_id ? `<a href="https://www.discogs.com/release/${r.discogs_id}" target="_blank" class="btn btn-sm btn-ghost flex-shrink-0" title="View on Discogs"><i class="bi bi-box-arrow-up-right"></i></a>` : ''}
      </div>

      ${metaRow('Year',    r.year)}
      ${metaRow('Label',   r.label)}
      ${metaRow('Cat #',   r.catalog_number)}
      ${metaRow('Format',  r.format)}
      ${metaRow('Country', r.country)}
      ${metaRow('Barcode', r.barcode)}
      <div id="detail-rating-area">${ratingStars(r.rating_average, r.rating_count)}</div>
      <div id="detail-price-area">${hasPrices ? priceRow(r) : (r.discogs_id ? '<div class="meta-row" style="color:var(--muted);font-size:.82rem"><i class="bi bi-arrow-repeat me-1"></i>Fetching prices…</div>' : '')}</div>

      ${r.notes ? `
        <div class="mt-3">
          <div class="label mb-1" style="color:var(--muted);font-size:.82rem">Notes</div>
          <div style="font-size:.88rem">${esc(r.notes)}</div>
        </div>` : ''}

      <div class="mt-4 d-flex justify-content-end">
        <button class="btn btn-sm btn-danger" onclick="confirmDelete(${r.id})">
          <i class="bi bi-trash me-1"></i>Remove
        </button>
      </div>
    </div>
  </div>`;
}

// ── Build the 3-panel track (prev | current | next) ─────────────
function _renderDetailBody(r) {
  const prevR = _detailList[_detailIndex - 1] || null;
  const nextR = _detailList[_detailIndex + 1] || null;

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-overlay-bar">
      <div class="detail-nav d-none d-sm-flex">
        <button class="detail-overlay-btn" id="detail-prev" onclick="_navigateDetail(-1)" title="Previous">
          <i class="bi bi-chevron-left"></i>
        </button>
        <button class="detail-overlay-btn" id="detail-next" onclick="_navigateDetail(1)" title="Next">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
      <button type="button" class="detail-overlay-btn" data-bs-dismiss="modal" aria-label="Close">&times;</button>
    </div>
    <div class="detail-track" id="detail-track">
      ${_renderPanelHtml(prevR)}
      ${_renderPanelHtml(r)}
      ${_renderPanelHtml(nextR)}
    </div>`;
}

// ── Navigation state ──────────────────────────────────────
let _detailList = [];
let _detailIndex = 0;
let _detailSwipe = null;
let _detailAnimating = false;
let _detailListenersAttached = false;

async function showDetail(id) {
  const r = collection.find(x => x.id === id);
  if (!r) return;

  // Snapshot current sorted/filtered list for pager
  _detailList = sortedFiltered();
  _detailIndex = _detailList.findIndex(x => x.id === id);
  if (_detailIndex < 0) _detailIndex = 0;

  _renderDetailBody(r);
  _updateDetailNav();

  // Reuse existing modal instance or create new one
  const modalEl = document.getElementById('detail-modal');
  const existing = bootstrap.Modal.getInstance(modalEl);
  if (existing) { existing.show(); } else { new bootstrap.Modal(modalEl).show(); }

  _attachDetailListeners(modalEl);

  // Auto-refresh prices/rating if any are missing
  if (r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average)) {
    _refreshDetailPrices(r);
  }
}

function _updateDetailNav() {
  const prev = document.getElementById('detail-prev');
  const next = document.getElementById('detail-next');
  if (prev) prev.disabled = _detailIndex <= 0;
  if (next) next.disabled = _detailIndex >= _detailList.length - 1;
}

// ── Navigate (button / keyboard / swipe commit) ─────────
function _navigateDetail(dir) {
  const newIdx = _detailIndex + dir;
  if (newIdx < 0 || newIdx >= _detailList.length) return;
  if (_detailAnimating) return;
  _detailAnimating = true;

  const track = document.getElementById('detail-track');
  // Slide the track: dir=1 → show next (shift left), dir=-1 → show prev (shift right)
  // Default position is -33.3333% (showing middle panel)
  const target = dir > 0 ? -66.6666 : 0;

  track.classList.add('animating');
  track.style.transform = `translateX(${target}%)`;

  track.addEventListener('transitionend', function once() {
    track.removeEventListener('transitionend', once);

    _detailIndex = newIdx;
    const r = _detailList[_detailIndex];

    // Re-render the 3 panels centered on the new index, snap back to center
    track.classList.remove('animating');
    _renderDetailBody(r);
    _updateDetailNav();

    _detailAnimating = false;

    // Auto-refresh if needed
    if (r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average)) {
      _refreshDetailPrices(r);
    }
  });
}

// ── Keyboard navigation ──────────────────────────────────
function _detailKeyHandler(e) {
  if (e.key === 'ArrowLeft')  { e.preventDefault(); _navigateDetail(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); _navigateDetail(1); }
}

// ── Touch / swipe navigation ─────────────────────────────
function _detailTouchStart(e) {
  if (e.touches.length !== 1 || _detailAnimating) return;
  const track = document.getElementById('detail-track');
  track.classList.remove('animating');
  const body = document.getElementById('detail-body');
  _detailSwipe = {
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    locked: false,
    atTop: body.scrollTop <= 0
  };
}

function _detailTouchMove(e) {
  if (!_detailSwipe || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - _detailSwipe.startX;
  const dy = e.touches[0].clientY - _detailSwipe.startY;

  // Lock direction on first significant move
  if (!_detailSwipe.locked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    if (Math.abs(dx) > Math.abs(dy)) {
      _detailSwipe.locked = 'h';
    } else if (dy > 0 && _detailSwipe.atTop) {
      _detailSwipe.locked = 'pull'; // pull-to-dismiss
    } else {
      _detailSwipe.locked = 'v'; // normal vertical scroll
    }
  }

  if (_detailSwipe.locked === 'h') {
    e.preventDefault();
    const track = document.getElementById('detail-track');
    const bodyW = document.getElementById('detail-body').offsetWidth;
    let pxOffset = dx;
    if ((dx > 0 && _detailIndex <= 0) || (dx < 0 && _detailIndex >= _detailList.length - 1)) {
      pxOffset = dx * 0.2;
    }
    const pctOffset = (pxOffset / (bodyW * 3)) * 100;
    track.style.transform = `translateX(${-33.3333 + pctOffset}%)`;
  } else if (_detailSwipe.locked === 'pull') {
    e.preventDefault();
    const pullDy = Math.max(0, dy) * 0.5; // dampened
    const content = document.querySelector('#detail-modal .modal-content');
    const opacity = Math.max(0.3, 1 - pullDy / 300);
    content.style.transition = 'none';
    content.style.transform = `translateY(${pullDy}px)`;
    content.style.opacity = opacity;
  }
}

function _detailTouchEnd(e) {
  if (!_detailSwipe) return;
  const locked = _detailSwipe.locked;
  const dx = (e.changedTouches[0]?.clientX || 0) - _detailSwipe.startX;
  const dy = (e.changedTouches[0]?.clientY || 0) - _detailSwipe.startY;
  _detailSwipe = null;

  // Pull-to-dismiss
  if (locked === 'pull') {
    const content = document.querySelector('#detail-modal .modal-content');
    if (dy > 100) {
      // Dismiss — slide down then hide instantly (skip Bootstrap fade)
      content.style.transition = 'transform 200ms ease-out';
      content.style.transform = `translateY(${window.innerHeight}px)`;
      content.style.opacity = '';
      const modalEl = document.getElementById('detail-modal');
      setTimeout(() => {
        // Reset styles before Bootstrap hide
        content.style.transition = '';
        content.style.transform = '';
        // Skip Bootstrap fade by removing .fade temporarily
        modalEl.classList.remove('fade');
        bootstrap.Modal.getInstance(modalEl)?.hide();
        modalEl.classList.add('fade');
      }, 200);
    } else {
      // Snap back
      content.style.transition = 'transform 200ms ease-out';
      content.style.transform = '';
      content.style.opacity = '';
      setTimeout(() => { content.style.transition = ''; }, 200);
    }
    return;
  }

  const threshold = 60;
  if (Math.abs(dx) > threshold) {
    const dir = dx < 0 ? 1 : -1;
    const newIdx = _detailIndex + dir;
    if (newIdx >= 0 && newIdx < _detailList.length) {
      // Commit the navigation with animation from current drag position
      _detailAnimating = true;
      const track = document.getElementById('detail-track');
      const target = dir > 0 ? -66.6666 : 0;
      track.classList.add('animating');
      track.style.transform = `translateX(${target}%)`;

      track.addEventListener('transitionend', function once() {
        track.removeEventListener('transitionend', once);
        _detailIndex = newIdx;
        const r = _detailList[_detailIndex];
        track.classList.remove('animating');
        _renderDetailBody(r);
        _updateDetailNav();
        _detailAnimating = false;

        if (r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average)) {
          _refreshDetailPrices(r);
        }
      });
      return;
    }
  }

  // Snap back to center
  const track = document.getElementById('detail-track');
  track.classList.add('animating');
  track.style.transform = 'translateX(-33.3333%)';
  track.addEventListener('transitionend', function once() {
    track.removeEventListener('transitionend', once);
    track.classList.remove('animating');
  });
}

// ── Listener management ──────────────────────────────────
function _attachDetailListeners(modalEl) {
  if (_detailListenersAttached) return;
  _detailListenersAttached = true;

  document.addEventListener('keydown', _detailKeyHandler);

  const body = document.getElementById('detail-body');
  body.addEventListener('touchstart', _detailTouchStart, { passive: true });
  body.addEventListener('touchmove', _detailTouchMove, { passive: false });
  body.addEventListener('touchend', _detailTouchEnd, { passive: true });

  modalEl.addEventListener('hidden.bs.modal', function cleanup() {
    modalEl.removeEventListener('hidden.bs.modal', cleanup);
    document.removeEventListener('keydown', _detailKeyHandler);
    body.removeEventListener('touchstart', _detailTouchStart);
    body.removeEventListener('touchmove', _detailTouchMove);
    body.removeEventListener('touchend', _detailTouchEnd);
    _detailListenersAttached = false;
    _detailList = [];
    _detailIndex = 0;
    _detailAnimating = false;
  });
}

// ── Price/rating refresh ─────────────────────────────────
async function _refreshDetailPrices(r) {
  try {
    const prices = await getReleasePrices(r.discogs_id);
    if (prices.error) throw new Error(prices.error);

    let changed = false;
    for (const k of ['price_low', 'price_median', 'price_high', 'price_currency', 'num_for_sale', 'rating_average', 'rating_count']) {
      if (prices[k]) { r[k] = prices[k]; changed = true; }
    }

    if (changed) {
      await apiPut(`/api/collection/${r.id}`, {
        price_low: r.price_low || '', price_median: r.price_median || '',
        price_high: r.price_high || '', price_currency: r.price_currency || 'USD',
        num_for_sale: r.num_for_sale || '',
        rating_average: r.rating_average || '', rating_count: r.rating_count || ''
      });

      const priceArea = document.getElementById('detail-price-area');
      if (priceArea) priceArea.innerHTML = priceRow(r);
      const ratingArea = document.getElementById('detail-rating-area');
      if (ratingArea) ratingArea.innerHTML = ratingStars(r.rating_average, r.rating_count);

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

  const cur = r.price_currency || 'USD';
  const priceBadge = card.querySelector('.record-price-badge');
  const newPriceBadge = r.price_median && !isNaN(parseFloat(r.price_median))
    ? `<span class="record-price-badge">${cur}&nbsp;${parseFloat(r.price_median).toFixed(0)} <span style="font-size:.7em;opacity:.7;font-weight:400">med</span></span>`
    : r.price_low && !isNaN(parseFloat(r.price_low))
      ? `<span class="record-price-badge" style="opacity:.75">${cur}&nbsp;${parseFloat(r.price_low).toFixed(0)} <span style="font-size:.7em;opacity:.7;font-weight:400">low</span></span>`
      : '';
  if (priceBadge) priceBadge.outerHTML = newPriceBadge;
  else if (newPriceBadge) metaRowEl.insertAdjacentHTML('beforeend', newPriceBadge);

  const rBadge = card.querySelector('.record-rating-badge');
  const newRatingBadge = ratingBadge(r);
  if (rBadge) rBadge.outerHTML = newRatingBadge;
  else if (newRatingBadge) {
    const yearEl = card.querySelector('.record-year');
    if (yearEl) yearEl.insertAdjacentHTML('afterend', newRatingBadge);
  }
}

function _copyDetailInfo(btn, id) {
  const r = collection.find(x => x.id === id);
  if (!r) return;
  const text = `${r.artist} - ${r.title}`;

  function onSuccess() {
    const icon = btn.querySelector('i');
    icon.className = 'bi bi-clipboard-check';
    btn.classList.add('text-success');
    setTimeout(() => { icon.className = 'bi bi-clipboard'; btn.classList.remove('text-success'); }, 1500);
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => _fallbackCopy(text, onSuccess));
  } else {
    _fallbackCopy(text, onSuccess);
  }
}

function _fallbackCopy(text, cb) {
  const modalEl = document.getElementById('detail-modal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) { modal._config.focus = false; modalEl.removeEventListener('focusin', modal._focustrap?._handleFocusin); }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
  modalEl.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  modalEl.removeChild(ta);

  if (modal) { modal._config.focus = true; }
  if (ok) cb();
}

async function confirmDelete(id) {
  if (!confirm('Remove this record from your collection?')) return;
  await apiDelete(`/api/collection/${id}`);
  bootstrap.Modal.getInstance(document.getElementById('detail-modal'))?.hide();
  await loadCollection();
  toast('Record removed from collection', 'success');
}
