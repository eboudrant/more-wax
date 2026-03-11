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

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `app-toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
}
