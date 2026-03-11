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
        <i class="bi bi-exclamation-triangle me-1"></i>
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
      <div class="spinner-wrapper">
        <div class="spinner-border"></div>
        <p class="mt-2">Converting HEIC…</p>
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
    <div style="position:relative;margin-bottom:12px">
      <img src="${dataUrl}"
           style="width:100%;max-height:220px;object-fit:contain;border-radius:10px;
                  background:#000">
    </div>
    <div class="spinner-wrapper" style="padding:12px">
      <div class="spinner-border"></div>
      <p class="mt-2" style="font-size:.85rem">Looking for a barcode…</p>
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
        <div style="position:relative;margin-bottom:12px">
          <img src="${dataUrl}"
               style="width:100%;max-height:180px;object-fit:contain;border-radius:10px;background:#000">
        </div>
        <div style="background:rgba(74,222,128,.12);border:1px solid #4ade80;border-radius:8px;
                    padding:10px 14px;font-size:.88rem;margin-bottom:12px">
          <i class="bi bi-check-circle me-2" style="color:#4ade80"></i>
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
    <div style="position:relative;margin-bottom:12px">
      <img src="${dataUrl}"
           style="width:100%;max-height:180px;object-fit:contain;border-radius:10px;background:#000">
    </div>
    <div class="spinner-wrapper" style="padding:10px">
      <div class="spinner-border"></div>
      <p class="mt-2" style="font-size:.82rem;color:var(--muted)">
        <i class="bi bi-stars me-1"></i>No barcode — asking Claude to identify the cover…
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
        <div style="position:relative;margin-bottom:10px">
          <img src="${dataUrl}"
               style="width:100%;max-height:150px;object-fit:contain;border-radius:10px;background:#000">
        </div>
        <div style="background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.35);
                    border-radius:8px;padding:9px 13px;font-size:.84rem;margin-bottom:10px">
          <i class="bi bi-stars me-1" style="color:var(--accent)"></i>
          Claude identified: <strong>${esc(json.artist)}${json.artist && json.title ? ' — ' : ''}${esc(json.title)}</strong>
          ${details ? `<div style="font-size:.76rem;color:var(--muted);margin-top:3px">${esc(details)}</div>` : ''}
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
          <div style="font-size:.8rem;color:var(--muted);margin-bottom:10px">
            No Discogs match found — try refining the search:
          </div>
          <div class="input-group">
            <input id="search-input" class="form-control" value="${esc(prefill)}"
                   onkeydown="if(event.key==='Enter') doSearch()">
            <button class="btn btn-accent" onclick="doSearch()">
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
    <div style="display:flex;gap:12px;align-items:flex-start">
      <img src="${dataUrl}"
           style="width:80px;height:80px;object-fit:cover;border-radius:8px;
                  flex-shrink:0;background:#000">
      <div style="flex:1">
        <div style="font-size:.8rem;color:var(--muted);margin-bottom:8px">
          No barcode or cover match found — search manually.
        </div>
        <div class="input-group">
          <input id="search-input" class="form-control" placeholder="Artist, album, label…"
                 onkeydown="if(event.key==='Enter') doSearch()">
          <button class="btn btn-accent" onclick="doSearch()">
            <i class="bi bi-search"></i>
          </button>
        </div>
      </div>
    </div>
    <div id="search-results" class="mt-3"></div>`;
  setTimeout(() => document.getElementById('search-input')?.focus(), 100);
}
