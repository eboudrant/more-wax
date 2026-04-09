// ─────────────────────────────────────────────────────────────────
//  COLLECTION — load / sort / render
//  Smart filters: smart-filter.js
//  Shelf view:    view-shelf.js
// ─────────────────────────────────────────────────────────────────
let _viewMode = localStorage.getItem('viewMode') || 'grid';
if (_viewMode === 'shelf' && !FLAGS.shelfView) _viewMode = 'grid';

const _VIEW_MODES = FLAGS.shelfView ? ['grid', 'wall', 'shelf'] : ['grid', 'wall'];
const _VIEW_ICONS = { grid: 'bi-grid-3x3-gap', wall: 'bi-grid-3x3', shelf: 'bi-vinyl' };
const _VIEW_LABELS = {
  grid:  () => t('collection.viewToggle.switchWall'),
  wall:  () => FLAGS.shelfView ? t('collection.viewToggle.switchShelf') : t('collection.viewToggle.switchCard'),
  shelf: () => t('collection.viewToggle.switchCard'),
};

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (_viewMode === 'shelf' || _viewMode === 'wall') renderCollection();
  }, 150);
});

function toggleViewMode() {
  const idx = _VIEW_MODES.indexOf(_viewMode);
  _viewMode = _VIEW_MODES[(idx + 1) % _VIEW_MODES.length];
  localStorage.setItem('viewMode', _viewMode);
  _updateViewToggleIcon();
  renderCollection();
}

function _updateViewToggleIcon() {
  const btn = document.getElementById('view-toggle');
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (!icon) return;
  const next = _VIEW_MODES[(_VIEW_MODES.indexOf(_viewMode) + 1) % _VIEW_MODES.length];
  icon.className = 'bi ' + _VIEW_ICONS[next];
  btn.title = _VIEW_LABELS[_viewMode]();
}

async function loadCollection() {
  try {
    collection = await apiGet('/api/collection');
  } catch (e) {
    toast(t('collection.loadError', { error: e.message }), 'error');
    collection = [];
  }
  renderCollection();
  // One-time backfill: only run once per session, skip if a sync import just ran
  if (!window._pricesBackfilled && !window._syncJustImported) {
    window._pricesBackfilled = true;
    _backgroundRefreshPrices();
  }
}

async function _backgroundRefreshPrices() {
  const stale = collection.filter(r => r.discogs_id && (!r.price_median || !r.price_high || !r.rating_average));
  if (!stale.length) return;
  try {
    const res = await apiPost('/api/collection/refresh-prices', {});
    if (res.total_stale > 0) {
      console.log(`Background price refresh started: ${res.total_stale} stale records`);
      const delay = Math.min(res.total_stale * 2500, 45000);
      setTimeout(async () => {
        try { collection = await apiGet('/api/collection'); renderCollection(); } catch (_) {}
      }, Math.max(delay / 2, 3000));
      setTimeout(async () => {
        try { collection = await apiGet('/api/collection'); renderCollection(); } catch (_) {}
      }, delay + 2000);
    }
  } catch (e) {
    console.warn('Background price refresh failed:', e.message);
  }
}

function sortedFiltered() {
  const q = (document.getElementById('filter-input')?.value || '').toLowerCase().trim();

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
      return pb - pa;
    }
    return (a.artist || '').localeCompare(b.artist || '');
  });
  return items;
}

function renderCollection() {
  const grid  = document.getElementById('collection-grid');
  const empty = document.getElementById('collection-empty');
  const badge = document.getElementById('nav-badge');
  document.getElementById('loading').style.display = 'none';

  badge.textContent = t('collection.badge', { count: collection.length });

  _updateViewToggleIcon();

  const items = sortedFiltered();

  if (items.length === 0) {
    grid.innerHTML = '';
    grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const isDesktop = window.innerWidth >= 768;
  const mode = isDesktop ? _viewMode : 'grid';

  if (mode === 'shelf') {
    grid.className = '';
    grid.innerHTML = '';
    _renderShelf(grid, items);
  } else if (mode === 'wall') {
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
