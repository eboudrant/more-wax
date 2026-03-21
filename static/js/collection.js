// ─────────────────────────────────────────────────────────────────
//  COLLECTION — load / sort / render
// ─────────────────────────────────────────────────────────────────
async function loadCollection() {
  try {
    collection = await apiGet('/api/collection');
  } catch (e) {
    toast('Could not load collection: ' + e.message, 'error');
    collection = [];
  }
  renderCollection();
  // One-time backfill: only run once per session, not on every loadCollection() call
  if (!window._pricesBackfilled) {
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

function sortedFiltered() {
  const q = (document.getElementById('filter-input')?.value || '').toLowerCase();
  let items = q
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

  const items = sortedFiltered();

  if (items.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = items.map(r => recordCardHtml(r)).join('');
}

function filterCollection() { renderCollection(); }

function setSort(key) {
  currentSort = key;
  renderCollection();
}
