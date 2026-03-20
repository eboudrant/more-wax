// ─────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function priceRow(r, compact = false) {
  const cur = r.price_currency || 'USD';
  const fmt = v => { const n = parseFloat(v); return isNaN(n) ? '' : `${cur} ${n.toFixed(2)}`; };
  const has = v => v && !isNaN(parseFloat(v)) && parseFloat(v) > 0;

  if (!has(r.price_low) && !has(r.price_median) && !has(r.price_high)) return '';

  if (compact) {
    // One-liner for the confirm step
    const parts = [];
    if (has(r.price_low))    parts.push(`<span title="Lowest listed">↓ ${fmt(r.price_low)}</span>`);
    if (has(r.price_median)) parts.push(`<span title="VG+ suggested" style="color:var(--accent);font-weight:600">${fmt(r.price_median)}</span>`);
    if (has(r.price_high))   parts.push(`<span title="Near Mint suggested">↑ ${fmt(r.price_high)}</span>`);
    const forSale = r.num_for_sale ? `<span style="color:var(--muted);font-size:.78rem"> · ${r.num_for_sale} for sale</span>` : '';
    return `
      <div class="meta-row">
        <span class="label">Market</span>
        <span class="value" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:.82rem">
          ${parts.join('<span style="color:var(--border)"> / </span>')}${forSale}
        </span>
      </div>`;
  }

  // Full 3-column display for detail modal
  const cells = [
    { label: 'Low',    value: r.price_low,    title: 'Lowest currently listed' },
    { label: 'Median', value: r.price_median,  title: 'VG+ suggested price', accent: true },
    { label: 'High',   value: r.price_high,   title: 'Near Mint suggested price' },
  ].filter(c => has(c.value));

  if (cells.length === 0) return '';

  const forSale = r.num_for_sale ? `<div style="text-align:center;color:var(--muted);font-size:.75rem;margin-top:6px">${r.num_for_sale} copies for sale on Discogs</div>` : '';

  return `
    <div class="meta-row" style="flex-direction:column;gap:4px">
      <span class="label">Market price</span>
      <div style="display:flex;gap:8px;margin-top:4px">
        ${cells.map(c => `
          <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;
                      padding:8px 10px;text-align:center">
            <div style="font-size:.68rem;color:var(--muted);margin-bottom:3px">${c.label}</div>
            <div style="font-size:.88rem;font-weight:700;color:${c.accent ? 'var(--accent)' : 'var(--text)'}">${fmt(c.value)}</div>
          </div>`).join('')}
      </div>
      ${forSale}
    </div>`;
}

function ratingStars(avg, count, compact = false) {
  const n = parseFloat(avg);
  if (!n || isNaN(n)) return '';
  const c = parseInt(count) || 0;

  // Build 5 stars: full, half, empty
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (n >= i)           stars += '<i class="bi bi-star-fill" style="color:#f59e0b"></i>';
    else if (n >= i - 0.5) stars += '<i class="bi bi-star-half" style="color:#f59e0b"></i>';
    else                   stars += '<i class="bi bi-star" style="color:var(--border)"></i>';
  }

  if (compact) {
    return `<span style="font-size:.72rem;display:inline-flex;align-items:center;gap:3px" title="${n.toFixed(2)}/5 from ${c} ratings">${stars}<span style="color:var(--muted);font-size:.68rem">${n.toFixed(1)}</span></span>`;
  }

  return `
    <div class="meta-row">
      <span class="label">Rating</span>
      <span class="value" style="display:flex;align-items:center;gap:6px;font-size:.85rem">
        ${stars}
        <span style="font-weight:600">${n.toFixed(2)}</span>
        <span style="color:var(--muted);font-size:.75rem">(${c} votes)</span>
      </span>
    </div>`;
}

function ratingBadge(r) {
  const n = parseFloat(r.rating_average);
  if (!n || isNaN(n)) return '';
  return `<span class="record-rating-badge" title="${n.toFixed(2)}/5"><i class="bi bi-star-fill" style="color:#f59e0b;font-size:.6em"></i> ${n.toFixed(1)}</span>`;
}

function metaRow(label, value) {
  if (!value) return '';
  return `
    <div class="meta-row">
      <span class="label">${label}</span>
      <span class="value">${esc(value)}</span>
    </div>`;
}

function parseList(val) {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return String(val).split(',').map(s => s.trim()).filter(Boolean);
  }
}

/** Returns an HTML hint to switch to HTTPS if we're on plain HTTP (non-localhost). */
function _httpsHint() {
  if (location.protocol === 'https:' || location.hostname === 'localhost') return '';
  const httpsUrl = `https://${location.hostname}:8766`;
  return ` — Camera requires HTTPS. <a href="${httpsUrl}" style="color:var(--accent)">Open ${httpsUrl}</a> and accept the certificate once.`;
}

/** Plain-text version for use in toast messages. */
function _httpsHintPlain() {
  if (location.protocol === 'https:' || location.hostname === 'localhost') return '';
  return ` — Try HTTPS: https://${location.hostname}:8766`;
}

// ── Shared record card template (for collection grid + dashboard) ──
function recordCardHtml(r) {
  const cover = r.local_cover || r.cover_image_url;
  const coverHtml = cover
    ? `<img src="${esc(cover)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" onerror="this.parentElement.innerHTML='<i class=\\'bi bi-vinyl text-3xl text-outline-v\\'></i>'">`
    : `<i class="bi bi-vinyl text-3xl text-outline-v"></i>`;

  const cur = r.price_currency || 'USD';
  const priceBadge = r.price_median && !isNaN(parseFloat(r.price_median))
    ? `<span class="record-price-badge">${cur}&nbsp;${parseFloat(r.price_median).toFixed(0)} <span class="text-[0.7em] opacity-70 font-normal">med</span></span>`
    : '';

  return `
    <div class="flex flex-col gap-3 group cursor-pointer" data-record-id="${r.id}" onclick="showDetail(${r.id})">
      <div class="aspect-square bg-surface-low rounded-lg overflow-hidden relative shadow-2xl transition-transform duration-500 hover:scale-[1.02] flex items-center justify-center">
        ${coverHtml}
      </div>
      <div class="flex flex-col gap-1">
        <h3 class="font-headline font-bold text-sm leading-tight text-on-surface truncate">${esc(r.title)}</h3>
        <p class="font-body text-xs text-on-surface-v truncate">${esc(r.artist)}</p>
        <div class="record-meta-row flex items-center gap-2 mt-1">
          <span class="record-year font-label text-[10px] text-outline uppercase tracking-widest">${esc(r.year || '')}</span>
          ${r.label ? `<span class="w-1 h-1 bg-outline-v rounded-full"></span><span class="font-label text-[10px] text-outline uppercase tracking-widest truncate">${esc(r.label)}</span>` : ''}
          ${ratingBadge(r)}
          ${priceBadge}
        </div>
      </div>
    </div>`;
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `app-toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
}
