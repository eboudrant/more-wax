// ─────────────────────────────────────────────────────────────────
//  SEARCH & RESULTS
// ─────────────────────────────────────────────────────────────────
async function doSearch() {
  const q = document.getElementById('search-input')?.value?.trim();
  if (!q) return;
  await fetchAndShowResults(q, false);
}

async function fetchAndShowResults(query, isBarcode) {
  // Show spinner — prefer inner div (used when Claude pre-fills the search box)
  const resultsEl = document.getElementById('search-results-inner')
                 || document.getElementById('search-results');
  const bodyEl    = document.getElementById('add-modal-body');
  const target    = resultsEl || bodyEl;

  target.innerHTML = `
    <div class="spinner-wrapper">
      <div class="spinner-border"></div>
      <p class="mt-2" style="color:var(--muted)">Searching Discogs…</p>
    </div>`;

  try {
    const data    = isBarcode ? await searchByBarcode(query) : await searchDiscogs(query);
    const results = data.results || [];

    window._searchResults   = results;
    window._detectedBarcode = isBarcode ? query : null;

    if (results.length === 0) {
      target.innerHTML = `
        <div class="text-center py-5" style="color:var(--muted)">
          <i class="bi bi-emoji-frown" style="font-size:2.5rem"></i>
          <p class="mt-3">No results${isBarcode ? ' for this barcode' : ''}.</p>
          <a href="#" onclick="showStep('search');return false">Try a manual search</a>
        </div>`;
      return;
    }

    renderResultsList(results, target, isBarcode);
  } catch (e) {
    target.innerHTML = `
      <div class="text-center py-4" style="color:var(--danger)">
        <i class="bi bi-exclamation-triangle" style="font-size:2rem"></i>
        <p class="mt-2">Discogs error: ${esc(e.message)}</p>
        <small>Check your internet connection or try again.</small>
      </div>`;
  }
}

function renderResultsList(results, container, isBarcode) {
  const footer = document.getElementById('add-modal-footer');

  container.innerHTML = `
    <p class="mb-3" style="font-size:.82rem;color:var(--muted)">
      ${results.length} result${results.length !== 1 ? 's' : ''}
      ${isBarcode ? '— barcode match' : ''} — tap to select
    </p>
    ${results.map((r, i) => {
      const thumb = r.cover_image || r.thumb || '';
      const year  = r.year || '';
      const label = Array.isArray(r.label) ? r.label[0] : (r.label || '');
      const fmt   = Array.isArray(r.format) ? r.format.join(', ') : (r.format || '');
      return `
        <div class="search-result-item" onclick="selectRelease(${i})">
          ${thumb
            ? `<img class="search-result-thumb" src="${esc(thumb)}" alt=""
                    onerror="this.outerHTML='<div class=search-result-thumb-placeholder><i class=\\'bi bi-vinyl\\'></i></div>'">`
            : `<div class="search-result-thumb-placeholder"><i class="bi bi-vinyl"></i></div>`}
          <div class="search-result-info flex-grow-1">
            <div class="title">${esc(r.title)}</div>
            <div class="sub">${[year, label, fmt].filter(Boolean).join(' · ')}</div>
          </div>
          <i class="bi bi-chevron-right ms-2" style="color:var(--muted);flex-shrink:0"></i>
        </div>`;
    }).join('')}`;

  footer.innerHTML = `
    <button class="btn btn-ghost" onclick="showStep('search')">
      <i class="bi bi-arrow-left me-1"></i>Back
    </button>`;
}

async function selectRelease(idx) {
  const stub = window._searchResults[idx];
  const body = document.getElementById('add-modal-body');

  body.innerHTML = `
    <div class="spinner-wrapper">
      <div class="spinner-border"></div>
      <p class="mt-2" style="color:var(--muted)">Loading release details…</p>
    </div>`;

  try {
    // Single server call does everything: release details + prices + collection check
    const release = await getReleaseFull(stub.id);
    if (release.error) throw new Error(release.error);

    // Override barcode with locally detected one if we have it
    if (window._detectedBarcode) release.barcode = window._detectedBarcode;

    // Fall back to stub cover if server didn't find one
    if (!release.cover_image_url) {
      release.cover_image_url = stub.cover_image || stub.thumb || '';
    }

    selectedRelease = release;
    showStep('confirm');
  } catch (e) {
    body.innerHTML = `
      <div class="text-center py-4" style="color:var(--danger)">
        Error loading release: ${esc(e.message)}
        <br><a href="#" onclick="showStep('search');return false" class="mt-2 d-inline-block">Go back</a>
      </div>`;
  }
}
