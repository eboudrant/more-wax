// ─────────────────────────────────────────────────────────────────
//  DETAIL MODAL
// ─────────────────────────────────────────────────────────────────

// ── Navigation state ──────────────────────────────────────
let _detailList = [];
let _detailIndex = 0;
let _detailSwipe = null;
let _detailAnimating = false;
let _detailListenersAttached = false;

function _renderPanelHtml(r, peek = false) {
  if (!r) return '<div class="detail-panel"></div>';

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

  return `<div class="detail-panel">
    ${coverHtml}
    <div class="p-4 pb-2 space-y-4">
      <!-- Title & Artist -->
      <div class="overflow-hidden">
        <h3 class="font-headline font-bold text-2xl sm:text-3xl text-on-surface tracking-tight leading-tight line-clamp-2 break-words">${esc(r.title)}</h3>
        <p class="font-headline italic text-lg text-on-surface-v mt-1 truncate">${esc(r.artist)}</p>
      </div>

      <!-- Tags & actions -->
      <div class="flex items-start gap-2">
        <div class="flex flex-wrap gap-1.5 flex-1 min-w-0">
          ${r.year ? `<span class="bg-surface-high/60 px-2.5 py-0.5 text-xs font-label rounded-full text-on-surface-v">${esc(r.year)}</span>` : ''}
          ${r.label ? [...new Set(r.label.split(', '))].map(l => `<span class="bg-surface-high/60 px-2.5 py-0.5 text-xs font-label rounded-full text-on-surface-v">${esc(l.trim())}</span>`).join('') : ''}
          ${r.country ? `<span class="bg-surface-high/60 px-2.5 py-0.5 text-xs font-label rounded-full text-on-surface-v">${esc(r.country)}</span>` : ''}
          ${tags.map(t => `<span class="border border-outline-v/30 px-2.5 py-0.5 text-xs font-label rounded-full text-outline">${esc(t)}</span>`).join('')}
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${r.id ? `<button class="w-8 h-8 rounded-full bg-surface-high/50 flex items-center justify-center text-outline hover:text-primary transition-colors" onclick="_copyDetailInfo(this, ${r.id})" title="${esc(t('detail.copy.title'))}">
            <i class="bi bi-clipboard text-xs"></i>
          </button>` : ''}
          ${r.id ? `<button id="share-btn" class="w-8 h-8 rounded-full bg-surface-high/50 flex items-center justify-center text-outline hover:text-primary transition-colors" onclick="_shareRecord(this, ${r.id})" title="${esc(t('detail.share.title'))}">
            <i class="bi bi-share text-xs"></i>
          </button>` : ''}
          ${r.discogs_id ? `<a href="https://www.discogs.com/release/${r.discogs_id}" target="_blank" class="w-8 h-8 rounded-full bg-surface-high/50 flex items-center justify-center text-outline hover:text-primary transition-colors" title="${esc(t('detail.viewOnDiscogs'))}"><i class="bi bi-box-arrow-up-right text-xs"></i></a>` : ''}
          ${r.discogs_id && !peek ? _renderDiscogsToggleBtn(r.discogs_id) : ''}
        </div>
      </div>

      <!-- Discogs Value Card -->
      ${hasPrices || r.discogs_id ? `
      <div class="bg-surface rounded-xl p-5 relative overflow-hidden">
        <div class="relative z-10">
          <div ${peek ? '' : 'id="detail-price-area"'}>${hasPrices ? _editorialPriceCard(r) : ''}</div>
        </div>
        <div class="absolute -right-4 -bottom-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
      </div>` : ''}

      <!-- Rating -->
      <div ${peek ? '' : 'id="detail-rating-area"'}>${ratingStars(r.rating_average, r.rating_count)}</div>

      <!-- Notes -->
      ${r.notes ? `
      <div class="bg-surface-top/30 rounded-xl p-5">
        <h4 class="font-headline italic text-lg text-on-surface mb-2">${esc(t('detail.notes.title'))}</h4>
        <p class="font-body text-on-surface-v text-sm leading-relaxed">${esc(r.notes)}</p>
      </div>` : ''}

      <!-- Discogs Extra (lazy loaded) + Delete -->
      <div ${peek ? '' : `id="detail-extra-${r.id}"`} class="space-y-4">
        ${r.discogs_extra ? _renderDiscogsExtra(r.discogs_extra, r) + (r.id ? _deleteButton(r.id) : '') : (r.discogs_id ? '' : (r.id ? _deleteButton(r.id) : ''))}
      </div>
    </div>
  </div>`;
}

function _editorialPriceCard(r) {
  const cur = r.price_currency || 'USD';
  const sym = currSym(cur);
  const med = parseFloat(r.price_median);
  const low = parseFloat(r.price_low);
  const high = parseFloat(r.price_high);
  if (isNaN(med) && isNaN(low)) return '';
  return `
    <div class="flex items-baseline justify-between gap-3">
      <div class="flex items-baseline gap-2">
        ${!isNaN(med) ? `<span class="text-2xl font-headline font-bold text-primary">${sym}${med.toFixed(2)}</span>` : ''}
        <span class="text-[10px] font-label text-outline uppercase tracking-wider">${t('detail.price.median')}</span>
      </div>
      <div class="flex items-baseline gap-3 text-sm font-headline text-on-surface-v">
        ${!isNaN(low) ? `<span>${sym}${low.toFixed(0)} <span class="text-[10px] font-label text-outline uppercase">${t('detail.price.low')}</span></span>` : ''}
        ${!isNaN(high) ? `<span>${sym}${high.toFixed(0)} <span class="text-[10px] font-label text-outline uppercase">${t('detail.price.high')}</span></span>` : ''}
        ${r.num_for_sale ? `<span>${r.num_for_sale} <span class="text-[10px] font-label text-outline uppercase">${t('detail.price.listed')}</span></span>` : ''}
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
        <button class="hidden sm:flex detail-overlay-btn" id="detail-prev" onclick="_navigateDetail(-1)" title="${esc(t('detail.nav.previous'))}">
          <i class="bi bi-chevron-left text-sm"></i>
        </button>
        <button class="hidden sm:flex detail-overlay-btn" id="detail-next" onclick="_navigateDetail(1)" title="${esc(t('detail.nav.next'))}">
          <i class="bi bi-chevron-right text-sm"></i>
        </button>
      </div>
      <button data-dismiss="modal" class="detail-overlay-btn pointer-events-auto" aria-label="Close">
        <i class="bi bi-x-lg text-sm"></i>
      </button>
    </div>
    <div class="detail-track relative">
      <div class="absolute top-0 right-full w-full overflow-hidden max-h-[90vh]">${prev ? _renderPanelHtml(prev, true) : ''}</div>
      ${_renderPanelHtml(r)}
      <div class="absolute top-0 left-full w-full overflow-hidden max-h-[90vh]">${next ? _renderPanelHtml(next, true) : ''}</div>
    </div>`;
}

async function showDetail(id) {
  const r = collection.find(x => x.id === id);
  if (!r) return;

  // Snapshot current sorted/filtered list for pager
  _detailList = sortedFiltered();
  _detailIndex = _detailList.findIndex(x => x.id === id);
  if (_detailIndex < 0) _detailIndex = 0;

  // Pre-fetch full record (includes cached discogs_extra) before rendering
  await _preloadExtra(r);

  _renderDetailBody(r);
  _updateDetailNav();

  AppModal.show('detail-modal');
  const modalEl = document.getElementById('detail-modal');
  _attachDetailListeners(modalEl);

  _lazyLoadDetailData(r);
}

/** Fetch prices, extra details, and collection status if needed. */
function _lazyLoadDetailData(r) {
  if (r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average)) {
    _refreshDetailPrices(r);
  }
  if (r.discogs_id && !r.discogs_extra) {
    _loadDiscogsExtra(r);
  }
  if (r.discogs_id) {
    _checkDiscogsCollection(r.discogs_id);
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

  // Start prefetch during animation (localhost is ~instant, finishes before 280ms transition)
  const nextR = _detailList[newIdx];
  const prefetch = _preloadExtra(nextR);

  const track = document.querySelector('.detail-track');
  if (!track) { _detailAnimating = false; return; }

  const target = dir > 0 ? '-100%' : '100%';
  track.classList.add('animating');
  track.style.transform = `translateX(${target})`;

  track.addEventListener('transitionend', async function once() {
    track.removeEventListener('transitionend', once);
    track.classList.remove('animating');

    _detailIndex = newIdx;
    await prefetch.catch(() => {});
    const r = _detailList[_detailIndex];

    const body = document.getElementById('detail-body');
    if (body) {
      body.style.visibility = 'hidden';
      body.scrollTop = 0;
    }

    _renderDetailBody(r);
    _updateDetailNav();

    requestAnimationFrame(() => {
      if (body) body.style.visibility = '';
      _detailAnimating = false;
    });

    _lazyLoadDetailData(r);
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
    const pct = (translate / track.parentElement.clientWidth) * 100;
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
        track.style.transform = 'translateX(0)';
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
  const sym = currSym(cur);
  const priceBadge = card.querySelector('.record-price-badge');
  const newPriceBadge = r.price_median && !isNaN(parseFloat(r.price_median))
    ? `<span class="record-price-badge">${sym}${parseFloat(r.price_median).toFixed(0)} <span class="text-[0.7em] opacity-70 font-normal">med</span></span>`
    : r.price_low && !isNaN(parseFloat(r.price_low))
      ? `<span class="record-price-badge opacity-75">${sym}${parseFloat(r.price_low).toFixed(0)} <span class="text-[0.7em] opacity-70 font-normal">low</span></span>`
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

// ── Discogs collection toggle ────────────────────────────────────
let _discogsCollectionState = {};  // discogs_id → bool

function _renderDiscogsToggleBtn(discogsId) {
  const cached = _discogsCollectionState[discogsId];
  const icon = cached === true ? 'bi-dash-circle' : 'bi-plus-circle';
  const color = cached === true ? 'text-primary' : 'text-outline';
  const title = cached === true ? t('detail.inDiscogsRemove')
    : cached === false ? t('detail.notInDiscogsAdd') : t('detail.checkingDiscogs');
  return `<button id="detail-discogs-toggle" data-discogs-id="${esc(discogsId)}" class="w-8 h-8 rounded-full bg-surface-high/50 flex items-center justify-center ${color} hover:text-primary transition-colors" onclick="_toggleDiscogsCollection('${esc(discogsId)}')" title="${esc(title)}">
    <i class="bi ${icon} text-xs"></i>
  </button>`;
}

async function _checkDiscogsCollection(discogsId) {
  const did = String(discogsId);
  try {
    const res = await apiGet(`/api/discogs/in-collection/${did}`);
    _discogsCollectionState[did] = res.in_collection;
    const btn = document.getElementById('detail-discogs-toggle');
    if (btn) _updateDiscogsToggle(btn, res.in_collection);
  } catch {
    // ignore — button stays in initial state
  }
}

function _updateDiscogsToggle(btn, inCollection) {
  const icon = btn.querySelector('i');
  if (inCollection) {
    icon.className = 'bi bi-dash-circle text-xs';
    btn.classList.remove('text-outline');
    btn.classList.add('text-primary');
    btn.title = t('detail.inDiscogsRemove');
  } else {
    icon.className = 'bi bi-plus-circle text-xs';
    btn.classList.remove('text-primary');
    btn.classList.add('text-outline');
    btn.title = t('detail.notInDiscogsAdd');
  }
}

async function _toggleDiscogsCollection(discogsId) {
  const did = String(discogsId);
  const btn = document.getElementById('detail-discogs-toggle');
  if (!btn) return;
  const inCollection = _discogsCollectionState[did];
  const icon = btn.querySelector('i');

  // Show spinner
  icon.className = 'bi bi-arrow-repeat animate-spin text-xs';

  try {
    if (inCollection) {
      // Restore icon while waiting for confirmation
      _updateDiscogsToggle(btn, true);
      if (!confirm(t('detail.discogs.removeConfirm'))) return;
      icon.className = 'bi bi-arrow-repeat animate-spin text-xs';
      const res = await apiDelete(`/api/discogs/collection/${did}`);
      if (res && res.success) {
        _discogsCollectionState[did] = false;
        toast(t('detail.discogs.removed'));
      } else {
        toast(t('detail.discogs.removeError'), 'error');
      }
    } else {
      const res = await apiPost(`/api/discogs/add-to-collection/${did}`, {});
      if (res && res.success) {
        _discogsCollectionState[did] = true;
        toast(t('detail.discogs.added'));
      } else {
        toast(t('detail.discogs.addError'), 'error');
      }
    }
    const currentBtn = document.getElementById('detail-discogs-toggle');
    if (currentBtn) _updateDiscogsToggle(currentBtn, _discogsCollectionState[did]);
  } catch (e) {
    toast(t('detail.discogs.failed', { error: e.message }), 'error');
    const currentBtn = document.getElementById('detail-discogs-toggle');
    if (currentBtn) _updateDiscogsToggle(currentBtn, !!inCollection);
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

function _deleteButton(id) {
  return `<div class="flex justify-end pt-2 pb-2">
    <button class="text-danger/70 hover:text-danger text-sm font-medium flex items-center gap-1.5 transition-colors" onclick="confirmDelete(${id})">
      <i class="bi bi-trash"></i> ${esc(t('detail.delete.btn'))}
    </button>
  </div>`;
}

// ── Pre-fetch cached extra from local DB ────────────────
async function _preloadExtra(r) {
  if (r.discogs_extra || !r.discogs_id) return;
  try {
    const full = await apiGet(`/api/collection/${r.id}`);
    if (full && full.discogs_extra) {
      r.discogs_extra = full.discogs_extra;
    }
  } catch (e) { /* ignore — will fall back to lazy load */ }
}

// ── Discogs extra details (lazy loaded) ─────────────────
async function _loadDiscogsExtra(r) {
  const spinTimer = setTimeout(() => {
    const el = document.getElementById(`detail-extra-${r.id}`);
    if (el && !el.innerHTML.trim()) {
      el.innerHTML = `<div class="text-outline text-sm flex items-center gap-2 justify-center py-4"><i class="bi bi-arrow-repeat animate-spin"></i> ${esc(t('detail.loadingDetails'))}</div>`;
    }
  }, 3000);
  try {
    const extra = await getCollectionDetails(r.id);
    clearTimeout(spinTimer);
    if (extra.error) throw new Error(extra.error);
    r.discogs_extra = extra;
    const el = document.getElementById(`detail-extra-${r.id}`);
    if (el) el.innerHTML = _renderDiscogsExtra(extra, r) + _deleteButton(r.id);
  } catch (e) {
    clearTimeout(spinTimer);
    console.warn('Could not load release details:', e.message);
    if (e.message && e.message.includes('429')) {
      toast('Discogs rate limit — try again in a minute', 'error');
    }
    const el = document.getElementById(`detail-extra-${r.id}`);
    if (el) el.innerHTML = _deleteButton(r.id);
  }
}

function _renderDiscogsExtra(extra, r) {
  return [
    _renderTracklist(extra.tracklist, r),
    _renderFormats(extra.formats),
    _renderCredits(extra.extraartists),
    _renderReleaseNotes(extra.notes),
    _renderIdentifiers(extra.identifiers),
    _renderCompanies(extra.companies, extra.series),
  ].filter(Boolean).join('');
}

function _renderTracklist(tracklist, r) {
  if (!tracklist || !tracklist.length) return '';
  const liked = r && r.liked_tracks ? r.liked_tracks : [];
  const rid = r ? r.id : 0;
  let html = '<div class="bg-surface-low rounded-xl p-5">';
  html += `<h4 class="font-label text-xs uppercase tracking-widest text-outline mb-4">${esc(t('detail.tracklist.title'))}</h4>`;
  html += '<div class="space-y-0">';
  for (const trk of tracklist) {
    if (trk.type_ === 'heading') {
      html += `<div class="font-label text-xs uppercase tracking-widest text-primary-dim pt-3 pb-1">${esc(trk.title)}</div>`;
      continue;
    }
    const trackId = trk.position || trk.title;
    const isLiked = liked.includes(trackId);
    const pos = trk.position ? `<span class="text-outline font-label text-xs shrink-0 whitespace-nowrap">${esc(trk.position)}</span>` : '';
    const safeTrackId = trackId.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const heart = rid ? `<button class="shrink-0 text-sm transition-all duration-200"
      style="color:${isLiked ? '#f87171' : '#4e453c'}"
      onclick="_toggleTrackLike(this, ${rid}, '${safeTrackId}')" title="${isLiked ? t('detail.tracklist.unlike') : t('detail.tracklist.like')}">
      <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}" style="transition:transform 0.2s"></i>
    </button>` : '';
    html += `<div class="flex items-center gap-2 py-1.5 border-b border-outline-v/10">
      ${pos}
      <span class="font-body text-sm text-on-surface truncate flex-1">${esc(trk.title)}</span>
      ${heart}
      <span class="text-outline text-xs shrink-0 w-10 text-right tabular-nums">${trk.duration ? esc(trk.duration) : ''}</span>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

function _renderFormats(formats) {
  if (!formats || !formats.length) return '';
  const desc = formats.map(f => {
    const parts = [];
    if (f.qty && f.qty !== '1') parts.push(f.qty + '×');
    parts.push(f.name);
    if (f.descriptions && f.descriptions.length) parts.push(...f.descriptions);
    return parts.join(', ');
  }).join(' + ');
  return `<div class="bg-surface-low rounded-xl p-5">
    <h4 class="font-label text-xs uppercase tracking-widest text-outline mb-3">${esc(t('detail.format.title'))}</h4>
    <p class="font-body text-sm text-on-surface-v">${esc(desc)}</p>
  </div>`;
}

function _renderCredits(extraartists) {
  if (!extraartists || !extraartists.length) return '';
  const grouped = {};
  for (const a of extraartists) {
    const role = a.role || 'Other';
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(a.name);
  }
  let html = '<div class="bg-surface-low rounded-xl p-5">';
  html += `<h4 class="font-label text-xs uppercase tracking-widest text-outline mb-4">${esc(t('detail.credits.title'))}</h4>`;
  html += '<div class="space-y-2">';
  for (const [role, names] of Object.entries(grouped)) {
    html += `<div class="pb-2 border-b border-outline-v/10">
      <span class="font-label text-[11px] uppercase tracking-wider text-outline">${esc(role)}</span>
      <div class="font-headline text-sm text-on-surface mt-0.5">${names.map(n => esc(n)).join(', ')}</div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

function _renderReleaseNotes(notes) {
  if (!notes) return '';
  return `<div class="bg-surface-top/30 rounded-xl p-5">
    <h4 class="font-label text-xs uppercase tracking-widest text-outline mb-3">${esc(t('detail.releaseNotes.title'))}</h4>
    <p class="font-body text-on-surface-v text-sm leading-relaxed whitespace-pre-line">${esc(notes)}</p>
  </div>`;
}

function _renderIdentifiers(identifiers) {
  if (!identifiers || !identifiers.length) return '';
  let html = '<div class="bg-surface-low rounded-xl p-5">';
  html += `<h4 class="font-label text-xs uppercase tracking-widest text-outline mb-4">${esc(t('detail.identifiers.title'))}</h4>`;
  html += '<div class="space-y-2">';
  for (const id of identifiers) {
    const desc = id.description ? ` (${esc(id.description)})` : '';
    html += `<div class="pb-2 border-b border-outline-v/10">
      <span class="font-label text-[11px] uppercase tracking-wider text-outline">${esc(id.type)}${desc}</span>
      <div class="font-headline text-sm text-on-surface mt-0.5 font-mono break-all">${esc(id.value)}</div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

function _renderCompanies(companies, series) {
  const items = [];
  if (companies && companies.length) {
    for (const c of companies) {
      items.push({ label: c.entity_type_name || 'Company', value: c.name + (c.catno ? ` [${c.catno}]` : '') });
    }
  }
  if (series && series.length) {
    for (const s of series) {
      items.push({ label: t('detail.companies.series'), value: s.name + (s.catno ? ` #${s.catno}` : '') });
    }
  }
  if (!items.length) return '';
  let html = '<div class="bg-surface-low rounded-xl p-5">';
  html += `<h4 class="font-label text-xs uppercase tracking-widest text-outline mb-4">${esc(t('detail.companies.title'))}</h4>`;
  html += '<div class="space-y-2">';
  for (const item of items) {
    html += `<div class="pb-2 border-b border-outline-v/10">
      <span class="font-label text-[11px] uppercase tracking-wider text-outline">${esc(item.label)}</span>
      <div class="font-headline text-sm text-on-surface mt-0.5">${esc(item.value)}</div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

// ── Track likes ──────────────────────────────────────────────
async function _toggleTrackLike(btn, rid, trackId) {
  const r = collection.find(x => x.id === rid);
  if (!r) return;
  const prev = r.liked_tracks ? [...r.liked_tracks] : [];
  const wasLiked = prev.includes(trackId);
  const next = wasLiked ? prev.filter(t => t !== trackId) : [...prev, trackId];
  r.liked_tracks = next;
  const icon = btn.querySelector('i');
  icon.className = wasLiked ? 'bi bi-heart' : 'bi bi-heart-fill';
  btn.style.color = wasLiked ? '#4e453c' : '#f87171';
  btn.title = wasLiked ? t('detail.tracklist.like') : t('detail.tracklist.unlike');
  // Bounce: big → small → normal
  btn.style.transition = 'none';
  btn.style.transform = 'scale(1.8)';
  requestAnimationFrame(() => {
    btn.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
    btn.style.transform = '';
  });
  try {
    await apiPut(`/api/collection/${rid}`, { liked_tracks: next });
  } catch (e) {
    r.liked_tracks = prev;
    icon.className = wasLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
    btn.style.color = wasLiked ? '#f87171' : '#4e453c';
    btn.title = wasLiked ? t('detail.tracklist.unlike') : t('detail.tracklist.like');
    toast(t('detail.tracklist.likeError'), 'error');
  }
}

async function confirmDelete(id) {
  if (!confirm(t('detail.delete.confirm'))) return;
  await apiDelete(`/api/collection/${id}`);
  AppModal.hide('detail-modal');
  await loadCollection();
  toast(t('detail.delete.success'), 'success');
}

// ── Share record card ────────────────────────────────────────
async function _shareRecord(btn, id) {
  const r = collection.find(x => x.id === id);
  if (!r) return;
  const icon = btn.querySelector('i');
  icon.className = 'bi bi-arrow-repeat animate-spin text-xs';

  try {
    const canvas = document.createElement('canvas');
    const [coverImg, qrImg] = await Promise.all([
      _loadShareCover(r),
      _loadQrCode(),
    ]);
    _drawShareCard(canvas, r, coverImg, qrImg);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const filename = `${r.artist || 'Record'} - ${r.title || 'Untitled'}.png`;

    // Try Web Share API (mobile)
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' });
      const shareData = { files: [file] };
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        icon.className = 'bi bi-share text-xs';
        return;
      }
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast(t('detail.share.cardSaved'), 'success');
  } catch (e) {
    if (e.name !== 'AbortError') toast(t('detail.share.cardError'), 'error');
  }
  icon.className = 'bi bi-share text-xs';
}

let _cachedQrImg = undefined; // undefined = not fetched, null = failed, Image = loaded
function _loadQrCode() {
  if (_cachedQrImg !== undefined) return Promise.resolve(_cachedQrImg);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { _cachedQrImg = img; resolve(img); };
    img.onerror = () => { _cachedQrImg = null; resolve(null); };
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fgithub.com%2Feboudrant%2Fmore-wax&bgcolor=131313&color=9a8f83';
  });
}

function _loadShareCover(r) {
  return new Promise(resolve => {
    let src = r.local_cover ? `/covers/${r.local_cover}` : r.cover_image_url;
    if (!src) { resolve(null); return; }
    // Proxy Discogs images through our server to avoid CORS
    if (src.startsWith('https://i.discogs.com/')) {
      src = `/api/cover-proxy?url=${encodeURIComponent(src)}`;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
