// ─────────────────────────────────────────────────────────────────
//  DETAIL MODAL
// ─────────────────────────────────────────────────────────────────
function _renderDetailBody(r) {
  const cover    = r.local_cover || r.cover_image_url;
  const coverHtml = cover
    ? `<img src="${esc(cover)}" class="detail-cover"
            onerror="this.style.display='none'">`
    : `<div class="cover-placeholder-large">
         <i class="bi bi-vinyl display-1"></i>
       </div>`;

  const genres = parseList(r.genres);
  const styles = parseList(r.styles);
  const tags = [...new Set([...genres, ...styles])];
  const hasPrices = r.price_median || r.price_high || r.price_low;

  document.getElementById('detail-body').innerHTML = `
    <button type="button" class="detail-close-btn" data-bs-dismiss="modal" aria-label="Close">&times;</button>
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
    </div>`;
}

async function showDetail(id) {
  const r = collection.find(x => x.id === id);
  if (!r) return;

  _renderDetailBody(r);
  new bootstrap.Modal(document.getElementById('detail-modal')).show();

  // Auto-refresh prices/rating if any are missing and we have a Discogs ID
  if (r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average)) {
    _refreshDetailPrices(r);
  }
}

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
      if (ratingArea) ratingArea.innerHTML = ratingStars(r.rating_average, r.rating_count);

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

  // Update rating badge
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
  // Temporarily disable Bootstrap modal's enforceFocus so textarea can receive focus
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
