// ─────────────────────────────────────────────────────────────────
//  PHOTO-BASED SEARCH — for scanner view
//  Snap or upload → detect barcode or Claude Vision → results
// ─────────────────────────────────────────────────────────────────

function processSearchPhotoForScanner(dataUrl, fileName) {
  openSheet();
  const body   = document.getElementById('scanner-sheet-body');
  const header = document.getElementById('scanner-sheet-header');

  header.innerHTML = `
    <div>
      <h2 class="font-headline text-xl font-bold text-on-surface">Analyzing Photo</h2>
    </div>
    <button onclick="closeSheet()" class="p-3 bg-surface-high rounded-full text-on-surface-v hover:text-on-surface transition-colors">
      <i class="bi bi-x-lg"></i>
    </button>`;

  body.innerHTML = `
    <div class="relative mb-3">
      <img src="${dataUrl}" class="w-full max-h-[220px] object-contain rounded-lg bg-black">
    </div>
    <div class="flex flex-col items-center py-3">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p class="mt-3 text-sm text-on-surface-v">Looking for a barcode…</p>
    </div>`;

  Quagga.decodeSingle({
    decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader',
                          'code_128_reader', 'code_39_reader'] },
    locate: true,
    src: dataUrl
  }, result => {
    const barcode = result?.codeResult?.code;

    if (barcode) {
      body.innerHTML = `
        <div class="relative mb-3">
          <img src="${dataUrl}" class="w-full max-h-[180px] object-contain rounded-lg bg-black">
        </div>
        <div class="bg-green/10 border border-green/30 rounded-lg px-3.5 py-2.5 text-sm mb-3">
          <i class="bi bi-check-circle mr-2 text-green"></i>
          Barcode detected: <strong>${esc(barcode)}</strong>
        </div>`;
      window._detectedBarcode = barcode;
      _scannerFetchResults(barcode, true, body);
    } else {
      _identifyWithClaudeForScanner(dataUrl, body);
    }
  });
}

async function _scannerFetchResults(query, isBarcode, bodyEl) {
  try {
    const data    = isBarcode ? await searchByBarcode(query) : await searchDiscogs(query);
    const results = data.results || [];
    window._searchResults   = results;
    window._detectedBarcode = isBarcode ? query : null;

    if (results.length > 0) {
      showResultsInSheet(results, isBarcode);
    } else {
      bodyEl.innerHTML += `
        <div class="text-center py-4 text-on-surface-v"><p>No results found.</p></div>`;
      document.getElementById('scanner-sheet-footer').innerHTML = `
        <button class="btn-ghost-new w-full" onclick="closeSheet(); switchScannerMode('search')">Try a manual search</button>`;
    }
  } catch (e) {
    bodyEl.innerHTML += `<div class="text-center py-4 text-danger"><p>Discogs error: ${esc(e.message)}</p></div>`;
  }
}

async function _identifyWithClaudeForScanner(dataUrl, bodyEl) {
  bodyEl.innerHTML = `
    <div class="relative mb-3">
      <img src="${dataUrl}" class="w-full max-h-[180px] object-contain rounded-lg bg-black">
    </div>
    <div class="flex flex-col items-center py-2.5">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p class="mt-3 text-xs text-on-surface-v">
        <i class="bi bi-stars mr-1"></i>No barcode — asking Claude to identify the cover…
      </p>
    </div>`;

  try {
    const res  = await fetch('/api/identify-cover', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image: dataUrl })
    });
    const json = await res.json();

    if (json.success && (json.artist || json.title)) {
      const details = [json.label, json.catalog_number, json.country, json.year]
        .filter(Boolean).join(' · ');

      bodyEl.innerHTML = `
        <div class="relative mb-2.5">
          <img src="${dataUrl}" class="w-full max-h-[150px] object-contain rounded-lg bg-black">
        </div>
        <div class="bg-primary/10 border border-primary/30 rounded-lg px-3.5 py-2.5 text-sm mb-2.5">
          <i class="bi bi-stars mr-1 text-primary"></i>
          Claude identified: <strong>${esc(json.artist)}${json.artist && json.title ? ' — ' : ''}${esc(json.title)}</strong>
          ${details ? `<div class="text-xs text-on-surface-v mt-1">${esc(details)}</div>` : ''}
        </div>`;

      if (json.barcode) {
        window._detectedBarcode = json.barcode;
        const barcodeData = await searchByBarcode(json.barcode).catch(() => ({ results: [] }));
        if ((barcodeData.results || []).length > 0) {
          window._searchResults = barcodeData.results;
          showResultsInSheet(barcodeData.results, true);
          return;
        }
      }

      function colabVariants(s) {
        if (!s) return [];
        const variants = new Set([s]);
        variants.add(s.replace(/\bvs\.?\b/gi, 'V.'));
        variants.add(s.replace(/\bvs\.?\b/gi, 'Vs.'));
        variants.add(s.replace(/\bversus\b/gi, 'V.'));
        variants.add(s.replace(/\bV\.\s*/g, 'vs '));
        return [...variants];
      }

      const artistVariants = colabVariants(json.artist);
      const queries = [];
      if (json.catalog_number) queries.push(...artistVariants.map(a => [a, json.title, json.catalog_number].filter(Boolean).join(' ')));
      if (json.label) queries.push(...artistVariants.map(a => [a, json.title, json.label].filter(Boolean).join(' ')));
      queries.push(...artistVariants.map(a => [a, json.title].filter(Boolean).join(' ')));
      queries.push(...artistVariants);
      if (json.title) queries.push(json.title);

      const uniqueQueries = [...new Set(queries)].filter(Boolean);
      let found = false;
      for (const q of uniqueQueries) {
        const data = await searchDiscogs(q).catch(() => ({ results: [] }));
        if ((data.results || []).length > 0) {
          window._searchResults   = data.results;
          window._detectedBarcode = null;
          showResultsInSheet(data.results, false);
          found = true;
          break;
        }
      }

      if (!found) {
        const prefill = [json.artist, json.title, json.catalog_number].filter(Boolean).join(' ');
        _showManualSearchInSheet(prefill);
      }
    } else {
      _showManualSearchInSheet('');
    }
  } catch (e) {
    _showManualSearchInSheet('');
  }
}

function _showManualSearchInSheet(prefill) {
  const body = document.getElementById('scanner-sheet-body');
  body.innerHTML += `
    <div class="mt-4">
      <div class="text-xs text-on-surface-v mb-2.5">
        ${prefill ? 'No Discogs match found — try refining:' : 'Could not identify — search manually:'}
      </div>
      <div class="flex gap-2">
        <input id="scanner-search-input-sheet"
               class="flex-1 bg-transparent border-b border-outline-v/40 py-2 text-sm text-on-surface
                      focus:border-primary focus:outline-none transition-colors"
               value="${esc(prefill)}"
               placeholder="Artist, album, label…"
               onkeydown="if(event.key==='Enter') _sheetDoSearch()">
        <button class="btn-primary-new px-4 py-2 text-sm" onclick="_sheetDoSearch()">
          <i class="bi bi-search"></i>
        </button>
      </div>
      <div id="scanner-sheet-search-results" class="mt-3"></div>
    </div>`;
  setTimeout(() => document.getElementById('scanner-search-input-sheet')?.select(), 100);
}

async function _sheetDoSearch() {
  const q = document.getElementById('scanner-search-input-sheet')?.value?.trim();
  if (!q) return;
  const target = document.getElementById('scanner-sheet-search-results');
  target.innerHTML = `<div class="text-center py-4"><div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block"></div></div>`;

  try {
    const data = await searchDiscogs(q);
    const results = data.results || [];
    window._searchResults = results;
    window._detectedBarcode = null;
    if (results.length > 0) {
      showResultsInSheet(results, false);
    } else {
      target.innerHTML = `<div class="text-center py-4 text-on-surface-v">No results found.</div>`;
    }
  } catch (e) {
    target.innerHTML = `<div class="text-center py-4 text-danger">${esc(e.message)}</div>`;
  }
}
