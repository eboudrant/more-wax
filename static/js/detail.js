// ─────────────────────────────────────────────────────────────────
//  DETAIL MODAL
// ─────────────────────────────────────────────────────────────────

// ── Navigation state ──────────────────────────────────────
let _detailList = [];
let _detailIndex = 0;
let _detailSwipe = null;
let _detailAnimating = false;
let _detailListenersAttached = false;

function _renderPanelHtml(r) {
  if (!r) return '<div class="detail-panel w-1/3 flex-shrink-0 min-w-0"></div>';

  const cover = r.local_cover || r.cover_image_url;
  const coverHtml = cover
    ? `<img src="${esc(cover)}" class="w-full max-h-[50vh] object-contain bg-black sm:max-h-[340px]" onerror="this.style.display='none'">`
    : `<div class="w-full h-44 bg-surface-high flex items-center justify-center text-outline-v">
         <i class="bi bi-vinyl text-5xl"></i>
       </div>`;

  const genres = parseList(r.genres);
  const styles = parseList(r.styles);
  const tags = [...new Set([...genres, ...styles])];
  const hasPrices = r.price_median || r.price_high || r.price_low;

  return `<div class="detail-panel w-1/3 flex-shrink-0 min-w-0">
    ${coverHtml}
    <div class="p-4 pb-2 space-y-4">
      <!-- Title & Actions -->
      <div class="flex items-start gap-2">
        <div class="flex-1 min-w-0">
          <h3 class="font-headline font-bold text-2xl sm:text-3xl text-on-surface tracking-tight leading-tight">${esc(r.title)}</h3>
          <p class="font-headline italic text-lg text-on-surface-v mt-1">${esc(r.artist)}</p>
          ${tags.length ? `<div class="flex flex-wrap gap-2 mt-3">${tags.map(t => `<span class="bg-surface-high px-3 py-1 text-xs font-label rounded text-on-surface-v">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <button class="flex-shrink-0 w-9 h-9 rounded-full bg-surface-high flex items-center justify-center text-on-surface-v hover:text-primary transition-colors" onclick="_copyDetailInfo(this, ${r.id})" title="Copy artist and title">
          <i class="bi bi-clipboard text-sm"></i>
        </button>
        ${r.discogs_id ? `<a href="https://www.discogs.com/release/${r.discogs_id}" target="_blank" class="flex-shrink-0 w-9 h-9 rounded-full bg-surface-high flex items-center justify-center text-on-surface-v hover:text-primary transition-colors" title="View on Discogs"><i class="bi bi-box-arrow-up-right text-sm"></i></a>` : ''}
      </div>

      <!-- Discogs Value Card -->
      ${hasPrices || r.discogs_id ? `
      <div class="bg-surface rounded-xl p-5 relative overflow-hidden">
        <div class="relative z-10">
          <div id="detail-price-area">
            ${hasPrices ? _editorialPriceCard(r) : (r.discogs_id ? '<div class="text-outline text-sm flex items-center gap-2"><i class="bi bi-arrow-repeat animate-spin"></i> Fetching prices…</div>' : '')}
          </div>
        </div>
        <div class="absolute -right-4 -bottom-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
      </div>` : ''}

      <!-- Rating -->
      <div id="detail-rating-area">${ratingStars(r.rating_average, r.rating_count)}</div>

      <!-- Technical Specs -->
      <div class="bg-surface-low rounded-xl p-5">
        <h4 class="font-label text-xs uppercase tracking-widest text-outline mb-4">Technical Specs</h4>
        <div class="space-y-3">
          ${_specRow('Year', r.year)}
          ${_specRow('Label', r.label)}
          ${_specRow('Catalog No.', r.catalog_number)}
          ${_specRow('Format', r.format)}
          ${_specRow('Country', r.country)}
          ${_specRow('Barcode', r.barcode)}
        </div>
      </div>

      <!-- Notes -->
      ${r.notes ? `
      <div class="bg-surface-top/30 rounded-xl p-5">
        <h4 class="font-headline italic text-lg text-on-surface mb-2">Notes</h4>
        <p class="font-body text-on-surface-v text-sm leading-relaxed">${esc(r.notes)}</p>
      </div>` : ''}

      <!-- Delete -->
      <div class="flex justify-end pt-2 pb-2">
        <button class="text-danger/70 hover:text-danger text-sm font-medium flex items-center gap-1.5 transition-colors" onclick="confirmDelete(${r.id})">
          <i class="bi bi-trash"></i> Remove
        </button>
      </div>
    </div>
  </div>`;
}

function _editorialPriceCard(r) {
  const cur = r.price_currency || 'USD';
  const med = parseFloat(r.price_median);
  const low = parseFloat(r.price_low);
  const high = parseFloat(r.price_high);
  if (isNaN(med) && isNaN(low)) return '';

  return `
    <div class="flex items-center justify-between mb-4">
      <span class="font-label text-xs uppercase tracking-widest text-outline">Discogs Value</span>
    </div>
    ${!isNaN(med) ? `
    <div class="mb-4">
      <span class="text-xs font-label text-on-surface-v block mb-1">MEDIAN PRICE</span>
      <div class="text-4xl font-headline font-bold text-primary">${cur} ${med.toFixed(2)}</div>
    </div>` : ''}
    <div class="grid grid-cols-3 gap-4 pt-4 border-t border-outline-v/20">
      <div>
        <span class="text-[10px] font-label text-outline uppercase">Low</span>
        <div class="text-base font-headline text-on-surface">${!isNaN(low) ? `${cur} ${low.toFixed(0)}` : '—'}</div>
      </div>
      <div>
        <span class="text-[10px] font-label text-outline uppercase">High</span>
        <div class="text-base font-headline text-on-surface">${!isNaN(high) ? `${cur} ${high.toFixed(0)}` : '—'}</div>
      </div>
      <div>
        <span class="text-[10px] font-label text-outline uppercase">For Sale</span>
        <div class="text-base font-headline text-on-surface-v">${r.num_for_sale || '—'}</div>
      </div>
    </div>`;
}

function _specRow(label, value) {
  if (!value) return '';
  return `<div class="flex justify-between items-end pb-2 border-b border-outline-v/10">
    <span class="font-body text-sm text-on-surface-v">${esc(label)}</span>
    <span class="font-headline text-sm text-on-surface">${esc(String(value))}</span>
  </div>`;
}

function _renderDetailBody(r) {
  const body = document.getElementById('detail-body');
  const prev = _detailList[_detailIndex - 1] || null;
  const next = _detailList[_detailIndex + 1] || null;

  body.innerHTML = `
    <div class="sticky top-0 z-10 flex justify-between items-center px-3 py-2 pointer-events-none" style="margin-bottom:-48px">
      <div class="detail-nav flex items-center gap-1.5 mr-auto pointer-events-auto">
        <button class="hidden sm:flex detail-overlay-btn" id="detail-prev" onclick="_navigateDetail(-1)" title="Previous">
          <i class="bi bi-chevron-left text-sm"></i>
        </button>
        <button class="hidden sm:flex detail-overlay-btn" id="detail-next" onclick="_navigateDetail(1)" title="Next">
          <i class="bi bi-chevron-right text-sm"></i>
        </button>
      </div>
      <button data-dismiss="modal" class="detail-overlay-btn pointer-events-auto" aria-label="Close">
        <i class="bi bi-x-lg text-sm"></i>
      </button>
    </div>
    <div class="detail-track flex" style="width:300%;transform:translateX(-33.3333%)">
      ${_renderPanelHtml(prev)}
      ${_renderPanelHtml(r)}
      ${_renderPanelHtml(next)}
    </div>`;
}

async function showDetail(id) {
  const r = collection.find(x => x.id === id);
  if (!r) return;

  // Snapshot current sorted/filtered list for pager
  _detailList = sortedFiltered();
  _detailIndex = _detailList.findIndex(x => x.id === id);
  if (_detailIndex < 0) _detailIndex = 0;

  _renderDetailBody(r);
  _updateDetailNav();

  AppModal.show('detail-modal');
  const modalEl = document.getElementById('detail-modal');
  _attachDetailListeners(modalEl);

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

function _navigateDetail(dir) {
  const newIdx = _detailIndex + dir;
  if (newIdx < 0 || newIdx >= _detailList.length || _detailAnimating) return;
  _detailAnimating = true;

  const track = document.querySelector('.detail-track');
  if (!track) { _detailAnimating = false; return; }

  const target = dir > 0 ? '-66.6666%' : '0%';
  track.classList.add('animating');
  track.style.transform = `translateX(${target})`;

  track.addEventListener('transitionend', function once() {
    track.removeEventListener('transitionend', once);
    track.classList.remove('animating');

    _detailIndex = newIdx;
    const r = _detailList[_detailIndex];
    _renderDetailBody(r);
    _updateDetailNav();
    _detailAnimating = false;

    // Scroll detail body to top
    const body = document.getElementById('detail-body');
    if (body) body.scrollTop = 0;

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
  if (e.touches.length !== 1) return;
  const body = document.getElementById('detail-body');
  _detailSwipe = {
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    locked: false,
    canPull: body && body.scrollTop <= 0
  };
}

function _detailTouchMove(e) {
  if (!_detailSwipe || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - _detailSwipe.startX;
  const dy = e.touches[0].clientY - _detailSwipe.startY;

  if (!_detailSwipe.locked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    if (Math.abs(dx) > Math.abs(dy)) {
      _detailSwipe.locked = 'h';
    } else if (dy > 0 && _detailSwipe.canPull) {
      _detailSwipe.locked = 'pull';
    } else {
      _detailSwipe.locked = 'v';
    }
  }

  if (_detailSwipe.locked === 'h') {
    e.preventDefault();
    const track = document.querySelector('.detail-track');
    if (!track) return;
    let translate = dx;
    if ((dx > 0 && _detailIndex <= 0) || (dx < 0 && _detailIndex >= _detailList.length - 1)) {
      translate = dx * 0.2;
    }
    const pct = -33.3333 + (translate / track.parentElement.clientWidth * 33.3333);
    track.style.transform = `translateX(${pct}%)`;
  } else if (_detailSwipe.locked === 'pull') {
    e.preventDefault();
    const content = document.querySelector('#detail-modal .app-modal-content');
    if (!content) return;
    const pullDist = Math.max(0, dy) * 0.5;
    content.style.transform = `translateY(${pullDist}px)`;
    content.style.opacity = Math.max(0.3, 1 - pullDist / 400);
    content.style.transition = 'none';
  }
}

function _detailTouchEnd(e) {
  if (!_detailSwipe) return;
  const dx = (e.changedTouches[0]?.clientX || 0) - _detailSwipe.startX;
  const dy = (e.changedTouches[0]?.clientY || 0) - _detailSwipe.startY;
  const mode = _detailSwipe.locked;
  _detailSwipe = null;

  if (mode === 'h') {
    const track = document.querySelector('.detail-track');
    if (track) {
      if (Math.abs(dx) > 60) {
        _navigateDetail(dx < 0 ? 1 : -1);
      } else {
        track.classList.add('animating');
        track.style.transform = 'translateX(-33.3333%)';
        track.addEventListener('transitionend', function once() {
          track.removeEventListener('transitionend', once);
          track.classList.remove('animating');
        });
      }
    }
  } else if (mode === 'pull') {
    const content = document.querySelector('#detail-modal .app-modal-content');
    if (!content) return;
    if (dy > 100) {
      content.style.transition = 'transform 250ms ease-out, opacity 200ms ease-out';
      content.style.transform = `translateY(${window.innerHeight}px)`;
      content.style.opacity = '0';
      setTimeout(() => {
        content.style.transform = '';
        content.style.opacity = '';
        content.style.transition = '';
        AppModal.hide('detail-modal');
      }, 260);
    } else {
      content.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out';
      content.style.transform = '';
      content.style.opacity = '';
      setTimeout(() => { content.style.transition = ''; }, 200);
    }
  }
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

  modalEl.addEventListener('modal:hidden', function cleanup() {
    modalEl.removeEventListener('modal:hidden', cleanup);
    document.removeEventListener('keydown', _detailKeyHandler);
    body.removeEventListener('touchstart', _detailTouchStart);
    body.removeEventListener('touchmove', _detailTouchMove);
    body.removeEventListener('touchend', _detailTouchEnd);
    _detailListenersAttached = false;
    _detailList = [];
    _detailIndex = 0;
  });
}

// ── Price refresh ────────────────────────────────────────
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
      if (priceArea) priceArea.innerHTML = _editorialPriceCard(r);
      const ratingArea = document.getElementById('detail-rating-area');
      if (ratingArea) ratingArea.innerHTML = ratingStars(r.rating_average, r.rating_count);

      _updateCardBadge(r);
    }
  } catch (e) {
    console.warn('Could not refresh prices:', e.message);
    const priceArea = document.getElementById('detail-price-area');
    if (priceArea && !priceArea.querySelector('.text-primary')) {
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
    ? `<span class="record-price-badge">${cur}&nbsp;${parseFloat(r.price_median).toFixed(0)} <span class="text-[0.7em] opacity-70 font-normal">med</span></span>`
    : r.price_low && !isNaN(parseFloat(r.price_low))
      ? `<span class="record-price-badge opacity-75">${cur}&nbsp;${parseFloat(r.price_low).toFixed(0)} <span class="text-[0.7em] opacity-70 font-normal">low</span></span>`
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
    btn.classList.add('text-green');
    setTimeout(() => { icon.className = 'bi bi-clipboard'; btn.classList.remove('text-green'); }, 1500);
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => _fallbackCopy(text, onSuccess));
  } else {
    _fallbackCopy(text, onSuccess);
  }
}

function _fallbackCopy(text, cb) {
  const modalEl = document.getElementById('detail-modal');
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
  modalEl.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  modalEl.removeChild(ta);
  if (ok) cb();
}

async function confirmDelete(id) {
  if (!confirm('Remove this record from your collection?')) return;
  await apiDelete(`/api/collection/${id}`);
  AppModal.hide('detail-modal');
  await loadCollection();
  toast('Record removed from collection', 'success');
}
