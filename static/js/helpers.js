// ─────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function currSym(cur) {
  const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$', BRL: 'R$', SEK: 'kr', CHF: 'CHF' };
  return symbols[cur] || cur + ' ';
}

function priceRow(r, compact = false) {
  const cur = r.price_currency || 'USD';
  const sym = currSym(cur);
  const fmt = v => { const n = parseFloat(v); return isNaN(n) ? '' : `${sym}${n.toFixed(2)}`; };
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
  const sym = currSym(cur);
  const priceBadge = r.price_median && !isNaN(parseFloat(r.price_median))
    ? `<span class="record-price-badge">${sym}${parseFloat(r.price_median).toFixed(0)} <span class="text-[0.7em] opacity-70 font-normal">med</span></span>`
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

// ── Wall card template (cover-only grid with 3D flip on hover) ──
function wallCardHtml(r) {
  const cover = r.local_cover || r.cover_image_url;
  const coverHtml = cover
    ? `<img src="${esc(cover)}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\\'bi bi-vinyl text-3xl text-outline-v\\'></i>'">`
    : `<i class="bi bi-vinyl text-3xl text-outline-v"></i>`;

  return `
    <div class="wall-card aspect-square" data-record-id="${r.id}" onclick="showDetail(${r.id})">
      <div class="wall-card-inner">
        <div class="wall-card-front flex items-center justify-center bg-surface-low">
          ${coverHtml}
        </div>
        <div class="wall-card-back">
          <p class="font-headline font-bold text-xs text-on-surface leading-tight text-center px-2 line-clamp-2 break-all">${esc(r.title)}</p>
          <p class="font-body text-[10px] text-on-surface-v text-center px-2 truncate break-all mt-1">${esc(r.artist)}</p>
          ${r.year ? `<span class="mt-2 text-[9px] font-label uppercase tracking-widest text-outline">${esc(r.year)}</span>` : ''}
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

// ── Share card canvas renderer ───────────────────────────────
function _drawShareCard(canvas, r, coverImg, qrImg) {
  const W = 1080;
  const pad = 60;
  const coverSize = W; // full-width square cover
  const qrSize = qrImg ? 120 : 0;
  const qrGap = qrImg ? 24 : 0;
  const textW = W - pad * 2 - qrSize - qrGap; // leave room for QR on right
  const ctx = canvas.getContext('2d');

  // Pre-calculate text height to size the canvas
  ctx.canvas.width = W;
  ctx.canvas.height = 2000; // temp height for measuring

  let textH = 0;
  textH += 80; // gap after cover

  // Title height
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
  const title = r.title || 'Untitled';
  const titleLines = _wrapText(ctx, title, textW);
  textH += Math.min(titleLines.length, 2) * 52;

  // Artist
  textH += 44;

  // Details line (computed once, reused in render pass)
  const details = [];
  if (r.year) details.push(r.year);
  if (r.label) details.push(r.label.split(', ')[0]);
  if (r.format) details.push(r.format);
  if (r.country) details.push(r.country);
  if (r.catalog_number) details.push(r.catalog_number);
  ctx.font = '22px system-ui, -apple-system, sans-serif';
  const detailLines = details.length ? _wrapText(ctx, details.join(' \u00b7 '), textW) : [];
  if (detailLines.length) {
    textH += Math.min(detailLines.length, 2) * 28 + 8;
  }

  // Track count
  const tracks = r.discogs_extra?.tracklist?.filter(t => t.type_ === 'track') || [];
  if (tracks.length > 0) textH += 28;

  // Footer space — enough for QR if present, otherwise just watermark
  if (qrImg) {
    const infoH = textH - 80; // content height without gap
    if (infoH < qrSize + 30) textH += (qrSize + 30 - infoH);
    textH += 16;
  } else {
    textH += 30;
  }

  // Set final canvas height (bottom padding smaller to avoid wasted space)
  const H = coverSize + textH + 30;
  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = '#131313';
  ctx.fillRect(0, 0, W, H);

  // Cover — full width, no padding
  let y = 0;
  if (coverImg) {
    const aspect = coverImg.width / coverImg.height;
    let sx = 0, sy = 0, sw = coverImg.width, sh = coverImg.height;
    if (aspect > 1) {
      sw = coverImg.height;
      sx = (coverImg.width - sw) / 2;
    } else if (aspect < 1) {
      sh = coverImg.width;
      sy = (coverImg.height - sh) / 2;
    }
    ctx.drawImage(coverImg, sx, sy, sw, sh, 0, 0, W, coverSize);
  } else {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, W, coverSize);
    ctx.fillStyle = '#4e453c';
    ctx.font = '120px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u25CE', W / 2, coverSize / 2 + 40);
    ctx.textAlign = 'left';
  }
  y = coverSize + 80;

  // Title
  const infoStartY = y;
  ctx.fillStyle = '#f5f0eb';
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, pad, y);
    y += 52;
  }

  // Artist
  ctx.fillStyle = '#fddcb1';
  ctx.font = 'italic 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(r.artist || 'Unknown Artist', pad, y);
  y += 44;

  // Release details
  if (detailLines.length) {
    ctx.fillStyle = '#9a8f83';
    ctx.font = '22px system-ui, -apple-system, sans-serif';
    for (const line of detailLines.slice(0, 2)) {
      ctx.fillText(line, pad, y);
      y += 28;
    }
    y += 8;
  }

  // Track count
  if (tracks.length > 0) {
    ctx.fillStyle = '#6b6159';
    ctx.font = '22px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${tracks.length} track${tracks.length !== 1 ? 's' : ''}`, pad, y);
    y += 28;
  }

  // QR code + branding — right-aligned, top-aligned with info block
  if (qrImg) {
    const qrX = W - pad - qrSize;
    // "More'Wax" label above QR
    ctx.fillStyle = '#4e453c';
    ctx.font = 'italic bold 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText("More'Wax", W - pad, infoStartY);
    ctx.textAlign = 'left';
    // QR below label
    ctx.drawImage(qrImg, qrX, infoStartY + 8, qrSize, qrSize);
  } else {
    // No QR — just watermark at bottom
    ctx.fillStyle = '#4e453c';
    ctx.font = 'italic bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText("More'Wax", W - pad, H - pad + 10);
    ctx.textAlign = 'left';
  }
}

function _wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}
