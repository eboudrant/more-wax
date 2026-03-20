// ─────────────────────────────────────────────────────────────────
//  PHOTO-BASED SEARCH (snap or upload → detect barcode or Claude Vision)
// ─────────────────────────────────────────────────────────────────
async function startSearchCamera() {
  const wrap  = document.getElementById('search-cam-wrap');
  const video = document.getElementById('search-cam-video');
  const btn   = document.getElementById('photo-cam-btn');
  if (!video) return;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
    });
    video.srcObject = cameraStream;
    await video.play();
    wrap.style.display = 'block';
    if (btn) btn.style.display = 'none';
  } catch (e) {
    const httpsHint = _httpsHint();
    document.getElementById('photo-analysis').innerHTML = `
      <div class="https-notice">
        <i class="bi bi-exclamation-triangle mr-1"></i>
        Camera unavailable: ${esc(e.message)}${httpsHint}
      </div>`;
  }
}

function snapSearchPhoto() {
  const video = document.getElementById('search-cam-video');
  if (!video) return;
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  stopCamera();
  document.getElementById('search-cam-wrap').style.display = 'none';
  processSearchPhoto(dataUrl, 'snapshot.jpg');
}

async function handleSearchPhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
              || /\.hei[cf]$/i.test(file.name);

  if (!isHeic && !file.type.startsWith('image/')) {
    toast('Please select an image file', 'error');
    return;
  }

  if (isHeic) {
    document.getElementById('photo-analysis').innerHTML = `
      <div class="flex flex-col items-center py-6">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="mt-3 text-sm text-on-surface-v">Converting HEIC…</p>
      </div>`;
  }

  try {
    const dataUrl = await imageFileToDataUrl(file);
    processSearchPhoto(dataUrl, file.name);
  } catch (e) {
    document.getElementById('photo-analysis').innerHTML = '';
    toast(e.message, 'error');
  }
}

function processSearchPhoto(dataUrl, fileName) {
  const area = document.getElementById('photo-analysis');
  if (!area) return;

  // Show the photo + analysing spinner
  area.innerHTML = `
    <div class="relative mb-3">
      <img src="${dataUrl}"
           class="w-full max-h-[220px] object-contain rounded-lg bg-black">
    </div>
    <div class="flex flex-col items-center py-3">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p class="mt-3 text-sm text-on-surface-v">Looking for a barcode…</p>
    </div>`;

  // Try barcode detection on the still image via Quagga.decodeSingle
  Quagga.decodeSingle({
    decoder:  { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader',
                          'code_128_reader', 'code_39_reader'] },
    locate:   true,
    src:      dataUrl
  }, result => {
    const barcode = result?.codeResult?.code;

    if (barcode) {
      // ✓ Barcode found — search Discogs automatically
      area.innerHTML = `
        <div class="relative mb-3">
          <img src="${dataUrl}"
               class="w-full max-h-[180px] object-contain rounded-lg bg-black">
        </div>
        <div class="bg-green-500/10 border border-green-400/30 rounded-lg
                    px-3.5 py-2.5 text-sm mb-3">
          <i class="bi bi-check-circle mr-2 text-green-400"></i>
          Barcode detected: <strong>${esc(barcode)}</strong>
        </div>`;
      window._detectedBarcode = barcode;
      fetchAndShowResults(barcode, true);
    } else {
      // ✗ No barcode — try Claude Vision before falling back to manual search
      _identifyWithClaude(dataUrl, area);
    }
  });
}

async function _identifyWithClaude(dataUrl, area) {
  // Show the photo while Claude thinks
  area.innerHTML = `
    <div class="relative mb-3">
      <img src="${dataUrl}"
           class="w-full max-h-[180px] object-contain rounded-lg bg-black">
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
      // Build detail line from what Claude found
      const details = [json.label, json.catalog_number, json.country, json.year]
        .filter(Boolean).join(' · ');

      // Claude identified it — show badge then try progressively narrower Discogs searches
      area.innerHTML = `
        <div class="relative mb-2.5">
          <img src="${dataUrl}"
               class="w-full max-h-[150px] object-contain rounded-lg bg-black">
        </div>
        <div class="bg-blue-400/10 border border-blue-400/30
                    rounded-lg px-3.5 py-2.5 text-sm mb-2.5">
          <i class="bi bi-stars mr-1 text-primary"></i>
          Claude identified: <strong>${esc(json.artist)}${json.artist && json.title ? ' — ' : ''}${esc(json.title)}</strong>
          ${details ? `<div class="text-xs text-on-surface-v mt-1">${esc(details)}</div>` : ''}
        </div>
        <div id="search-results"></div>`;

      // If Claude found a barcode, try that first (most precise)
      if (json.barcode) {
        window._detectedBarcode = json.barcode;
        const barcodeData = await searchByBarcode(json.barcode).catch(() => ({ results: [] }));
        if ((barcodeData.results || []).length > 0) {
          window._searchResults = barcodeData.results;
          renderResultsList(barcodeData.results, document.getElementById('search-results'), true);
          return;
        }
      }

      // Build search queries from most specific to broadest
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

      // Most specific first: artist + title + catalog number, then + label, then just artist + title
      const queries = [];
      if (json.catalog_number) {
        queries.push(...artistVariants.map(a => [a, json.title, json.catalog_number].filter(Boolean).join(' ')));
      }
      if (json.label) {
        queries.push(...artistVariants.map(a => [a, json.title, json.label].filter(Boolean).join(' ')));
      }
      queries.push(...artistVariants.map(a => [a, json.title].filter(Boolean).join(' ')));
      queries.push(...artistVariants);
      if (json.title) queries.push(json.title);

      // Deduplicate while preserving order
      const uniqueQueries = [...new Set(queries)].filter(Boolean);

      let found = false;
      for (const q of uniqueQueries) {
        const data = await searchDiscogs(q).catch(() => ({ results: [] }));
        if ((data.results || []).length > 0) {
          window._searchResults   = data.results;
          window._detectedBarcode = null;
          renderResultsList(data.results, document.getElementById('search-results'), false);
          found = true;
          break;
        }
      }

      if (!found) {
        const prefill = [json.artist, json.title, json.catalog_number].filter(Boolean).join(' ');
        document.getElementById('search-results').innerHTML = `
          <div class="text-xs text-on-surface-v mb-2.5">
            No Discogs match found — try refining the search:
          </div>
          <div class="flex gap-2">
            <input id="search-input"
                   class="flex-1 bg-transparent border-b border-outline-v/40 py-2 text-sm text-on-surface
                          focus:border-primary focus:outline-none transition-colors font-sans"
                   value="${esc(prefill)}"
                   onkeydown="if(event.key==='Enter') doSearch()">
            <button class="btn-primary-new px-4 py-2 text-sm" onclick="doSearch()">
              <i class="bi bi-search"></i>
            </button>
          </div>
          <div id="search-results-inner" class="mt-3"></div>`;
        setTimeout(() => document.getElementById('search-input')?.select(), 100);
      }
    } else {
      _showManualSearchFallback(dataUrl, area);
    }
  } catch (e) {
    _showManualSearchFallback(dataUrl, area);
  }
}

function _showManualSearchFallback(dataUrl, area) {
  area.innerHTML = `
    <div class="flex gap-3 items-start">
      <img src="${dataUrl}"
           class="w-20 h-20 object-cover rounded-lg flex-shrink-0 bg-black">
      <div class="flex-1">
        <div class="text-xs text-on-surface-v mb-2">
          No barcode or cover match found — search manually.
        </div>
        <div class="flex gap-2">
          <input id="search-input"
                 class="flex-1 bg-transparent border-b border-outline-v/40 py-2 text-sm text-on-surface
                        focus:border-primary focus:outline-none transition-colors font-sans"
                 placeholder="Artist, album, label…"
                 onkeydown="if(event.key==='Enter') doSearch()">
          <button class="btn-primary-new px-4 py-2 text-sm" onclick="doSearch()">
            <i class="bi bi-search"></i>
          </button>
        </div>
      </div>
    </div>
    <div id="search-results" class="mt-3"></div>`;
  setTimeout(() => document.getElementById('search-input')?.focus(), 100);
}
