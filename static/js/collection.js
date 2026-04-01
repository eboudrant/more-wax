// ─────────────────────────────────────────────────────────────────
//  COLLECTION — load / sort / render
// ─────────────────────────────────────────────────────────────────
let _viewMode = localStorage.getItem('viewMode') || 'grid';

function toggleViewMode() {
  _viewMode = _viewMode === 'grid' ? 'wall' : 'grid';
  localStorage.setItem('viewMode', _viewMode);
  _updateViewToggleIcon();
  renderCollection();
}

function _updateViewToggleIcon() {
  const btn = document.getElementById('view-toggle');
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (!icon) return;
  icon.className = _viewMode === 'wall' ? 'bi bi-grid-3x3-gap' : 'bi bi-grid-3x3';
  btn.title = _viewMode === 'wall' ? 'Switch to card view' : 'Switch to wall view';
}

async function loadCollection() {
  try {
    collection = await apiGet('/api/collection');
  } catch (e) {
    toast('Could not load collection: ' + e.message, 'error');
    collection = [];
  }
  renderCollection();
  // One-time backfill: only run once per session, skip if a sync import just ran
  if (!window._pricesBackfilled && !window._syncJustImported) {
    window._pricesBackfilled = true;
    _backgroundRefreshPrices();
  }
}

// Ask the server to batch-refresh all stale prices (rate-limited server-side).
// Runs once per session; server processes in background, we poll to get results.
async function _backgroundRefreshPrices() {
  const stale = collection.filter(r => r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average));
  if (!stale.length) return;
  try {
    const res = await apiPost('/api/collection/refresh-prices', {});
    if (res.total_stale > 0) {
      console.log(`Background price refresh started: ${res.total_stale} stale records`);
      // Poll for fresh data after estimated completion (1.5s per record, check halfway + end)
      const delay = Math.min(res.total_stale * 2500, 45000);
      setTimeout(async () => {
        try {
          collection = await apiGet('/api/collection');
          renderCollection();
        } catch (_) {}
      }, Math.max(delay / 2, 3000));
      setTimeout(async () => {
        try {
          collection = await apiGet('/api/collection');
          renderCollection();
        } catch (_) {}
      }, delay + 2000);
    }
  } catch (e) {
    console.warn('Background price refresh failed:', e.message);
  }
}

// ── Smart filters (is: prefix) ─────────────────────────────────
const SMART_FILTERS = [
  { key: 'is:missing-tracklist', label: 'Missing tracklist', fn: r => !r.discogs_extra },
  { key: 'is:missing-cover', label: 'Missing cover', fn: r => !r.cover_image_url },
  { key: 'is:no-rating', label: 'No rating', fn: r => !r.rating_average || r.rating_average === 0 },
  { key: 'is:no-price', label: 'No price', fn: r => !r.price_median || r.price_median === '0' || r.price_median === '0.00' },
  { key: 'is:duplicate', label: 'Duplicate pressings', fn: r => {
    if (!r.master_id || r.master_id === '0') return false;
    return collection.filter(o => o.master_id === r.master_id).length > 1;
  }},
];

/** Update smart filter font styling on the input. */
function _updateSmartFont(inputEl) {
  const isSmart = inputEl.value.toLowerCase().startsWith('is:');
  inputEl.classList.toggle('font-mono', isSmart);
  inputEl.classList.toggle('text-sm', isSmart);
  inputEl.classList.toggle('font-body', !isSmart);
}

/** Show inline ghost suggestion + subtle dropdown for smart filters. */
function _updateSmartHint(inputEl) {
  // Ghost hint
  let hint = document.getElementById('smart-filter-hint');
  if (!hint) {
    hint = document.createElement('span');
    hint.id = 'smart-filter-hint';
    hint.className = 'absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-outline font-mono text-sm py-2';
    inputEl.parentElement.appendChild(hint);
  }
  const q = inputEl.value.toLowerCase();
  _updateSmartFont(inputEl);

  if (!q || !q.startsWith('i')) {
    hint.textContent = '';
    _hideSmartDropdown();
    return;
  }

  // Ghost text for first match
  const match = SMART_FILTERS.find(f => f.key.startsWith(q) && f.key !== q);
  if (match) {
    hint.innerHTML = `<span class="invisible">${esc(q)}</span>${esc(match.key.slice(q.length))}`;
  } else {
    hint.textContent = '';
  }

  // Subtle dropdown showing all matching options
  const matches = SMART_FILTERS.filter(f => f.key.startsWith(q));
  if (matches.length > 0 && !SMART_FILTERS.some(f => f.key === q)) {
    _showSmartDropdown(inputEl, matches, q);
  } else {
    _hideSmartDropdown();
  }
}

function _showSmartDropdown(inputEl, matches, q) {
  let dd = document.getElementById('smart-filter-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'smart-filter-dropdown';
    dd.className = 'absolute left-0 right-0 top-full mt-0.5 z-50';
    inputEl.parentElement.appendChild(dd);
  }
  dd.innerHTML = matches.map(f => {
    const count = collection.filter(f.fn).length;
    return `<div class="smart-filter-item flex items-center justify-between py-1.5 cursor-pointer"
      onmousedown="event.preventDefault();document.getElementById('filter-input').value='${f.key}';_hideSmartDropdown();document.getElementById('smart-filter-hint').textContent='';document.getElementById('filter-clear').style.display='block';_updateSmartFont(document.getElementById('filter-input'));filterCollection()">
      <span class="font-mono text-xs">${f.key}</span>
      <span class="text-xs tabular-nums">${count}</span>
    </div>`;
  }).join('');
}

function _hideSmartDropdown() {
  document.getElementById('smart-filter-dropdown')?.remove();
}

/** Accept the ghost suggestion on Tab. */
function _smartFilterTab(event, inputEl) {
  if (event.key !== 'Tab') return;
  const hint = document.getElementById('smart-filter-hint');
  if (!hint || !hint.textContent.trim()) return;
  const q = inputEl.value.toLowerCase();
  const match = SMART_FILTERS.find(f => f.key.startsWith(q) && f.key !== q);
  if (match) {
    event.preventDefault();
    inputEl.value = match.key;
    hint.textContent = '';
    _hideSmartDropdown();
    document.getElementById('filter-clear').style.display = 'block';
    _updateSmartFont(inputEl);
    filterCollection();
  }
}

function sortedFiltered() {
  const q = (document.getElementById('filter-input')?.value || '').toLowerCase().trim();

  // Check for smart filter
  const smart = SMART_FILTERS.find(f => f.key === q);
  let items = smart
    ? collection.filter(smart.fn)
    : q
      ? collection.filter(r =>
          (r.title  || '').toLowerCase().includes(q) ||
          (r.artist || '').toLowerCase().includes(q) ||
          (r.year   || '').toLowerCase().includes(q) ||
          (r.label  || '').toLowerCase().includes(q)
        )
      : [...collection];

  items.sort((a, b) => {
    if (currentSort === 'year')  return (b.year || '0').localeCompare(a.year || '0');
    if (currentSort === 'added') return b.id - a.id;
    if (currentSort === 'title') return (a.title  || '').localeCompare(b.title  || '');
    if (currentSort === 'price') {
      const pa = parseFloat(a.price_median || a.price_low || '0');
      const pb = parseFloat(b.price_median || b.price_low || '0');
      return pb - pa;  // highest value first
    }
    return (a.artist || '').localeCompare(b.artist || '');  // default: artist
  });
  return items;
}

function renderCollection() {
  const grid  = document.getElementById('collection-grid');
  const empty = document.getElementById('collection-empty');
  const badge = document.getElementById('nav-badge');
  document.getElementById('loading').style.display = 'none';

  const label = `${collection.length} record${collection.length !== 1 ? 's' : ''}`;
  badge.textContent = label;

  _updateViewToggleIcon();

  const items = sortedFiltered();

  if (items.length === 0) {
    grid.innerHTML = '';
    grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Check viewport — wall mode only on desktop (md: 768px+)
  const isDesktop = window.innerWidth >= 768;
  const useWall = _viewMode === 'wall' && isDesktop;

  if (useWall) {
    grid.className = 'grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1';
    grid.innerHTML = items.map(r => wallCardHtml(r)).join('');
  } else {
    grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12';
    grid.innerHTML = items.map(r => recordCardHtml(r)).join('');
  }
}

function filterCollection() { renderCollection(); }

function setSort(key) {
  currentSort = key;
  renderCollection();
}
