// ─────────────────────────────────────────────────────────────────
//  SEARCH & RESULTS
// ─────────────────────────────────────────────────────────────────
async function doSearch() {
  const q = document.getElementById('search-input')?.value?.trim();
  if (!q) return;
  await fetchAndShowResults(q, false);
}

async function fetchAndShowResults(query, isBarcode) {
  const resultsEl = document.getElementById('search-results-inner')
                 || document.getElementById('search-results');
  const bodyEl    = document.getElementById('add-modal-body');
  const target    = resultsEl || bodyEl;

  target.innerHTML = `
    <div class="text-center py-8 text-on-surface-v">
      <div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block"></div>
      <p class="mt-3 text-sm">Searching Discogs…</p>
    </div>`;

  try {
    const data    = isBarcode ? await searchByBarcode(query) : await searchDiscogs(query);
    const results = data.results || [];

    window._searchResults   = results;
    window._detectedBarcode = isBarcode ? query : null;

    if (results.length === 0) {
      target.innerHTML = `
        <div class="text-center py-8 text-on-surface-v">
          <i class="bi bi-emoji-frown text-4xl"></i>
          <p class="mt-3">No results${isBarcode ? ' for this barcode' : ''}.</p>
          <a href="#" class="text-primary hover:underline" onclick="showStep('search');return false">Try a manual search</a>
        </div>`;
      return;
    }

    renderResultsList(results, target, isBarcode);
  } catch (e) {
    target.innerHTML = `
      <div class="text-center py-6 text-danger">
        <i class="bi bi-exclamation-triangle text-3xl"></i>
        <p class="mt-2">Discogs error: ${esc(e.message)}</p>
        <small class="text-on-surface-v">Check your internet connection or try again.</small>
      </div>`;
  }
}

function renderResultsList(results, container, isBarcode) {
  const footer = document.getElementById('add-modal-footer');

  container.innerHTML = `
    <p class="mb-3 text-xs text-on-surface-v">
      ${results.length} result${results.length !== 1 ? 's' : ''}
      ${isBarcode ? '— barcode match' : ''} — tap to select
    </p>
    <div class="space-y-3">
      ${results.map((r, i) => {
        const thumb = r.cover_image || r.thumb || '';
        const year  = r.year || '';
        const label = Array.isArray(r.label) ? r.label[0] : (r.label || '');
        const fmt   = Array.isArray(r.format) ? r.format.join(', ') : (r.format || '');
        return `
          <div class="group flex items-center gap-4 p-3 bg-surface-low rounded-xl cursor-pointer transition-colors hover:bg-surface" onclick="selectRelease(${i})">
            ${thumb
              ? `<img class="w-16 h-16 object-cover rounded-lg flex-shrink-0 shadow-lg" src="${esc(thumb)}" alt=""
                      onerror="this.outerHTML='<div class=\\'w-16 h-16 bg-surface-high rounded-lg flex items-center justify-center text-outline-v flex-shrink-0\\'><i class=\\'bi bi-vinyl text-xl\\'></i></div>'">`
              : `<div class="w-16 h-16 bg-surface-high rounded-lg flex items-center justify-center text-outline-v flex-shrink-0"><i class="bi bi-vinyl text-xl"></i></div>`}
            <div class="flex-1 min-w-0">
              <h4 class="font-headline font-bold text-sm text-on-surface leading-tight truncate">${esc(r.title)}</h4>
              <p class="font-body text-xs text-primary mt-0.5">${esc(r.artist || '')}</p>
              <div class="flex items-center gap-2 mt-1">
                ${year ? `<span class="font-label text-[10px] uppercase tracking-widest text-outline-v font-bold">${esc(year)}</span>` : ''}
                ${year && label ? '<span class="w-1 h-1 rounded-full bg-outline-v"></span>' : ''}
                ${label ? `<span class="font-label text-[10px] uppercase tracking-widest text-outline-v font-bold truncate">${esc(label)}</span>` : ''}
              </div>
            </div>
            <i class="bi bi-chevron-right text-outline-v flex-shrink-0"></i>
          </div>`;
      }).join('')}
    </div>`;

  footer.innerHTML = `
    <button class="btn-ghost-new" onclick="showStep('search')">
      <i class="bi bi-arrow-left mr-1"></i>Back
    </button>`;
}

async function selectRelease(idx) {
  const stub = window._searchResults[idx];
  const body = document.getElementById('add-modal-body');

  body.innerHTML = `
    <div class="text-center py-8 text-on-surface-v">
      <div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block"></div>
      <p class="mt-3 text-sm">Loading release details…</p>
    </div>`;

  try {
    const release = await getReleaseFull(stub.id);
    if (release.error) throw new Error(release.error);

    if (window._detectedBarcode) release.barcode = window._detectedBarcode;

    if (!release.cover_image_url) {
      release.cover_image_url = stub.cover_image || stub.thumb || '';
    }

    selectedRelease = release;
    showStep('confirm');
  } catch (e) {
    body.innerHTML = `
      <div class="text-center py-6 text-danger">
        Error loading release: ${esc(e.message)}
        <br><a href="#" class="text-primary hover:underline mt-2 inline-block" onclick="showStep('search');return false">Go back</a>
      </div>`;
  }
}
