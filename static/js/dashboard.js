// ─────────────────────────────────────────────────────────────────
//  DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────────
let _shuffled = [];
let _pickOffset = 0;

function _ensureShuffle() {
  if (_shuffled.length === collection.length && _shuffled.length > 0) return;
  _shuffled = [...collection];
  for (let i = _shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_shuffled[i], _shuffled[j]] = [_shuffled[j], _shuffled[i]];
  }
  _pickOffset = 0;
}

function _renderPicks() {
  _ensureShuffle();
  const picks = [];
  for (let i = 0; i < 6 && i < _shuffled.length; i++) {
    picks.push(_shuffled[(_pickOffset + i) % _shuffled.length]);
  }
  const grid = document.getElementById('dash-picks');
  if (grid) grid.innerHTML = picks.map(r => recordCardHtml(r)).join('');
}

function refreshPicks() {
  _pickOffset = (_pickOffset + 6) % _shuffled.length;
  _renderPicks();
}

function _renderStatus() {
  const el = document.getElementById('dash-status');
  if (!el) return;

  const status = _serverStatus || {};

  // Collection stats
  const withPrices = collection.filter(r => r.price_median).length;
  const totalValue = collection.reduce((sum, r) => {
    const m = parseFloat(r.price_median);
    return sum + (isNaN(m) ? 0 : m);
  }, 0);
  const avgRating = collection.reduce((s, r) => {
    const v = parseFloat(r.rating_average);
    return { sum: s.sum + (isNaN(v) ? 0 : v), n: s.n + (isNaN(v) ? 0 : 1) };
  }, { sum: 0, n: 0 });
  const avgStr = avgRating.n ? (avgRating.sum / avgRating.n).toFixed(1) : '—';

  const dot = (ok) => ok
    ? '<span class="inline-block w-2 h-2 rounded-full bg-green mr-2"></span>'
    : '<span class="inline-block w-2 h-2 rounded-full bg-danger/60 mr-2"></span>';

  el.innerHTML = `
    <div class="bg-surface-low rounded-xl p-6 space-y-3">
      <h4 class="font-label text-xs uppercase tracking-widest text-outline mb-3">Connections</h4>
      <div class="flex items-center text-sm">
        ${dot(status.discogs_connected)}
        <span class="text-on-surface-v">Discogs</span>
        ${status.discogs_username ? `<span class="ml-auto font-headline text-on-surface">${esc(status.discogs_username)}</span>` : '<span class="ml-auto text-outline">Not connected</span>'}
      </div>
      <div class="flex items-center text-sm">
        ${dot(status.anthropic_key_set)}
        <span class="text-on-surface-v">Claude AI</span>
        <span class="ml-auto text-outline">${status.anthropic_key_set ? 'Cover identification' : 'Not configured'}</span>
      </div>
    </div>
    <div class="bg-surface-low rounded-xl p-6 space-y-3">
      <h4 class="font-label text-xs uppercase tracking-widest text-outline mb-3">Collection Stats</h4>
      <div class="flex items-center text-sm">
        <span class="text-on-surface-v">Estimated value</span>
        <span class="ml-auto font-headline text-on-surface">${withPrices ? '$' + totalValue.toFixed(0) : '—'}</span>
      </div>
      <div class="flex items-center text-sm">
        <span class="text-on-surface-v">Avg rating</span>
        <span class="ml-auto font-headline text-on-surface">${avgStr}</span>
      </div>
      <div class="flex items-center text-sm">
        <span class="text-on-surface-v">Priced</span>
        <span class="ml-auto font-headline text-on-surface">${withPrices} / ${collection.length}</span>
      </div>
    </div>`;
}

function renderDashboard() {
  if (!collection.length) return;

  _renderPicks();

  // Last 4 recently added
  const recent = [...collection].sort((a, b) => b.id - a.id).slice(0, 4);
  const recentGrid = document.getElementById('dash-recent');
  if (recentGrid) {
    recentGrid.innerHTML = recent.map(r => recordCardHtml(r)).join('');
  }

  _renderStatus();
}
