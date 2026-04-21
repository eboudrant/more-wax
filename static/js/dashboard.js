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
      <div class="flex items-center justify-between mb-3">
        <h4 class="font-label text-xs uppercase tracking-widest text-outline">${t('dash.status.connections')}</h4>
        <button onclick="openSettings()" class="text-outline hover:text-on-surface transition-colors" title="${t('dash.status.settings')}">
          <i class="bi bi-gear text-sm"></i>
        </button>
      </div>
      <div class="flex items-center text-sm">
        ${dot(status.discogs_connected)}
        <span class="text-on-surface-v">${t('dash.status.discogs')}</span>
        <span class="ml-auto text-outline text-xs">${status.format_filter && status.format_filter !== 'All' ? t('dash.status.formatOnly', { format: status.format_filter.toLowerCase() }) : t('dash.status.allFormats')}</span>
        ${status.discogs_username ? `<span class="ml-2 font-headline text-on-surface">${esc(status.discogs_username)}</span>` : `<span class="ml-2 text-outline">${t('dash.status.notConnected')}</span>`}
      </div>
      <div class="flex items-center text-sm">
        ${dot(status.anthropic_key_set)}
        <span class="text-on-surface-v">${t('dash.status.claudeAi')}</span>
        <span class="ml-auto text-outline text-xs">${status.anthropic_key_set && status.vision_model ? status.vision_model : ''}</span>
        <span class="ml-2 ${status.anthropic_key_set ? 'font-headline text-on-surface' : 'text-outline'}">${status.anthropic_key_set ? t('dash.status.connected') : t('dash.status.notConfigured')}</span>
      </div>
      ${status.version ? `<div class="text-xs pt-2 border-t border-outline-v/10 mt-3 text-outline text-end">
        More'Wax <code class="text-on-surface/60">${esc(status.version)}</code>${status.build_date ? ', ' + t('dash.status.builtOn', { date: new Date(status.build_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) }) : ''}${status.git_revision ? ', <code class="text-on-surface/60">' + esc(status.git_revision.slice(0, 7)) + '</code>' : ''}
      </div>` : ''}
    </div>
    <div class="bg-surface-low rounded-xl p-6 space-y-3">
      <h4 class="font-label text-xs uppercase tracking-widest text-outline mb-3">${t('dash.status.collectionStats')}</h4>
      <div class="flex items-center text-sm">
        <span class="text-on-surface-v">${t('dash.status.estimatedValue')}</span>
        <span class="ml-auto font-headline text-on-surface">${withPrices ? '$' + totalValue.toFixed(0) : '—'}</span>
      </div>
      <div class="flex items-center text-sm">
        <span class="text-on-surface-v">${t('dash.status.avgRating')}</span>
        <span class="ml-auto font-headline text-on-surface">${avgStr}</span>
      </div>
      <div class="flex items-center text-sm">
        <span class="text-on-surface-v">${t('dash.status.priced')}</span>
        <span class="ml-auto font-headline text-on-surface">${t('dash.status.pricedValue', { priced: withPrices, total: collection.length })}</span>
      </div>
    </div>`;
}

function renderDashboard() {
  const empty = !collection.length;
  const emptyEl = document.getElementById('dash-empty');
  const sections = [
    'dash-search-section',
    'dash-now-playing-section',
    'dash-picks-section',
    'dash-recent-section',
  ];

  if (emptyEl) emptyEl.classList.toggle('hidden', !empty);
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', empty);
  });

  _renderStatus();

  if (empty) return;

  _renderPicks();
  _renderRecentListens();

  // Last 4 recently added
  const recent = [...collection].sort((a, b) => b.id - a.id).slice(0, 4);
  const recentGrid = document.getElementById('dash-recent');
  if (recentGrid) {
    recentGrid.innerHTML = recent.map(r => recordCardHtml(r)).join('');
  }
}

// ── Now Playing + Recent Listens ────────────────────────────────

async function _renderRecentListens() {
  const el = document.getElementById('dash-recent-listens');
  if (!el) return;
  let listens;
  try {
    listens = await apiGet('/api/listens');
  } catch {
    el.innerHTML = '';
    return;
  }
  const top = listens.slice(0, 8);
  if (!top.length) {
    el.innerHTML = `<p class="col-span-full text-sm text-outline">${esc(t('dash.recentListens.empty'))}</p>`;
    return;
  }
  el.innerHTML = top.map(l => {
    const r = collection.find(x => x.id === l.record_id);
    if (!r) return '';
    const cover = r.local_cover || r.cover_image_url;
    const coverHtml = cover
      ? `<img src="${esc(cover)}" class="w-full aspect-square object-cover" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="w-full aspect-square bg-surface-high flex items-center justify-center text-outline-v"><i class="bi bi-vinyl"></i></div>`;
    return `<button onclick="showDetail(${r.id})" class="group relative rounded-lg overflow-hidden bg-surface" title="${esc(r.title)} — ${esc(r.artist)}">
      ${coverHtml}
    </button>`;
  }).filter(Boolean).join('');
}

function openNowPlayingPicker() {
  AppModal.show('picker-modal');
  const input = document.getElementById('picker-filter');
  if (input) input.value = '';
  _renderPickerGrid('');
  // Focus after show animation completes
  setTimeout(() => input?.focus(), 120);
}

function _pickerFilterChanged() {
  const input = document.getElementById('picker-filter');
  _renderPickerGrid((input?.value || '').toLowerCase().trim());
}

function _renderPickerGrid(q) {
  const grid = document.getElementById('picker-grid');
  if (!grid) return;
  const items = q
    ? collection.filter(r =>
        (r.title  || '').toLowerCase().includes(q) ||
        (r.artist || '').toLowerCase().includes(q) ||
        (r.label  || '').toLowerCase().includes(q))
    : [...collection];
  if (!items.length) {
    grid.innerHTML = `<p class="col-span-full text-sm text-outline text-center py-8">${esc(t('picker.noResults'))}</p>`;
    return;
  }
  grid.innerHTML = items.slice(0, 60).map(r => {
    const cover = r.local_cover || r.cover_image_url;
    const coverHtml = cover
      ? `<img src="${esc(cover)}" class="w-full aspect-square object-cover" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="w-full aspect-square bg-surface-high flex items-center justify-center text-outline-v"><i class="bi bi-vinyl text-2xl"></i></div>`;
    return `<button onclick="_pickerLog(${r.id})" class="text-left bg-surface rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all">
      ${coverHtml}
      <div class="p-2">
        <div class="font-body text-sm text-on-surface truncate">${esc(r.title)}</div>
        <div class="font-body text-xs text-on-surface-v truncate">${esc(r.artist)}</div>
      </div>
    </button>`;
  }).join('');
}

async function _pickerLog(recordId) {
  const r = collection.find(x => x.id === recordId);
  try {
    await apiPost('/api/listens', { record_id: recordId });
    AppModal.hide('picker-modal');
    if (typeof toast === 'function' && r) {
      toast(t('picker.logged', { title: r.title || '' }), 'success');
    }
    _renderRecentListens();
  } catch (e) {
    if (typeof toast === 'function') {
      toast(t('picker.logError', { error: e.message }), 'error');
    }
  }
}
