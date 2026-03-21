// ─────────────────────────────────────────────────────────────────
//  SCANNER — full-screen camera-first add flow
// ─────────────────────────────────────────────────────────────────

// ── API key dialog ───────────────────────────────────────────
function _showApiKeyDialog() {
  // Avoid duplicates
  if (document.getElementById('apikey-dialog')) return;
  const overlay = document.createElement('div');
  overlay.id = 'apikey-dialog';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.6);backdrop-filter:blur(4px);
  `;
  overlay.innerHTML = `
    <div style="background:var(--surface,#1c1c1e);border:1px solid var(--outline-v,#333);
                border-radius:16px;padding:28px 24px;max-width:360px;width:90%;text-align:center">
      <div style="font-size:2rem;margin-bottom:8px">🔑</div>
      <h3 style="margin:0 0 8px;color:var(--on-surface,#fff);font-size:1.1rem">API Key Required</h3>
      <p style="margin:0 0 16px;color:var(--muted,#aaa);font-size:.88rem;line-height:1.5">
        Photo identification uses the Anthropic Claude API.<br>
        Add your key to <code style="background:var(--surface-top,#2a2a2c);padding:2px 6px;border-radius:4px;font-size:.82rem">
        .env</code> and restart the server.
      </p>
      <a href="https://console.anthropic.com/" target="_blank" rel="noopener"
         style="display:inline-block;margin-bottom:12px;color:var(--accent,#d4a574);font-size:.85rem;text-decoration:underline">
        Get an API key →
      </a><br>
      <button onclick="document.getElementById('apikey-dialog').remove()"
              style="margin-top:4px;padding:10px 28px;border-radius:10px;border:none;
                     background:var(--accent,#d4a574);color:#000;font-weight:600;font-size:.9rem;cursor:pointer">
        OK
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Open / Close ─────────────────────────────────────────────
async function openScanner() {
  selectedRelease       = null;
  capturedPhoto         = null;
  window._searchResults = [];
  window._detectedBarcode = null;
  scannerOpen = true;

  const el = document.getElementById('view-scanner');
  el.style.display = 'flex';
  el.classList.add('open');

  // Hide header & bottom nav
  document.querySelector('header').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'none';

  // Push history so back button closes scanner
  history.pushState({ scanner: true }, '', location.hash);

  // Start camera, wait for it to be ready, then start barcode mode
  await startScannerCamera();
  switchScannerMode('barcode');

  // Escape key handler
  document.addEventListener('keydown', _scannerEscHandler);
}

function closeScanner() {
  scannerOpen = false;
  stopScannerCamera();
  closeSheet();

  const el = document.getElementById('view-scanner');
  el.style.display = 'none';
  el.classList.remove('open');

  // Restore header & bottom nav
  document.querySelector('header').style.display = '';
  document.getElementById('bottom-nav').style.display = '';

  // Hide search panel
  document.getElementById('scanner-search-panel').classList.add('hidden');
  document.getElementById('scanner-dim').classList.add('hidden');

  document.removeEventListener('keydown', _scannerEscHandler);

  // Re-render current view
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'collection') renderCollection();
}

function _scannerEscHandler(e) {
  if (e.key === 'Escape') {
    const sheet = document.getElementById('scanner-sheet');
    if (!sheet.classList.contains('sheet-open')) {
      closeScanner();
    } else {
      closeSheet();
    }
  }
}

// Back button support
window.addEventListener('popstate', () => {
  if (scannerOpen) {
    const sheet = document.getElementById('scanner-sheet');
    if (sheet.classList.contains('sheet-open')) {
      if (_sheetView === 'confirm' && window._searchResults && window._searchResults.length) {
        // Go back to results list instead of closing sheet
        showResultsInSheet(window._searchResults, !!window._detectedBarcode);
      } else {
        closeSheet();
      }
      // Re-push history so next back closes the scanner
      history.pushState({ scanner: true }, '', location.hash);
    } else {
      closeScanner();
    }
  }
});


// ── Mode Switching ───────────────────────────────────────────
function switchScannerMode(mode) {
  scannerMode = mode;

  // Update toggle buttons
  document.querySelectorAll('.scanner-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const frame     = document.getElementById('scanner-frame');
  const scanLine  = document.getElementById('scanner-scan-line');
  const shutter   = document.getElementById('scanner-shutter');
  const uploadBtn = document.getElementById('scanner-upload-btn');
  const guidance  = document.getElementById('scanner-guidance');
  const frameWrap = document.getElementById('scanner-frame-wrap');
  const dim       = document.getElementById('scanner-dim');
  const searchP   = document.getElementById('scanner-search-panel');
  const bottomA   = document.getElementById('scanner-bottom-area');

  if (mode === 'barcode') {
    frame.classList.remove('photo-mode');
    frameWrap.classList.remove('hidden');
    scanLine.style.display = '';
    shutter.classList.add('hidden');
    uploadBtn.classList.add('hidden');
    guidance.textContent = 'Align barcode within frame';
    dim.classList.add('hidden');
    searchP.classList.add('hidden');
    bottomA.classList.remove('hidden');
    startQuaggaPolling();
  } else if (mode === 'photo') {
    if (_serverStatus && !_serverStatus.anthropic_key_set) {
      _showApiKeyDialog(); return;
    }
    frame.classList.add('photo-mode');
    frameWrap.classList.remove('hidden');
    scanLine.style.display = 'none';
    shutter.classList.remove('hidden');
    uploadBtn.classList.remove('hidden');
    guidance.textContent = 'Center artwork within the frame';
    dim.classList.add('hidden');
    searchP.classList.add('hidden');
    bottomA.classList.remove('hidden');
    stopQuaggaPolling();
  } else if (mode === 'search') {
    frameWrap.classList.add('hidden');
    shutter.classList.add('hidden');
    uploadBtn.classList.add('hidden');
    dim.classList.remove('hidden');
    searchP.classList.remove('hidden');
    bottomA.classList.add('hidden');
    stopQuaggaPolling();
    setTimeout(() => document.getElementById('scanner-search-input')?.focus(), 200);
  }
}


// ── Photo capture from scanner ───────────────────────────────
function scannerSnapPhoto() {
  const dataUrl = captureFromScanner();
  if (!dataUrl) {
    toast('Camera not available', 'error');
    return;
  }
  processSearchPhotoForScanner(dataUrl, 'snapshot.jpg');
}

function handleScannerPhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
              || /\.hei[cf]$/i.test(file.name);

  if (!isHeic && !file.type.startsWith('image/')) {
    toast('Please select an image file', 'error');
    return;
  }

  openSheet();
  const body = document.getElementById('scanner-sheet-body');
  body.innerHTML = `
    <div class="flex flex-col items-center py-8">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p class="mt-3 text-sm text-on-surface-v">${isHeic ? 'Converting HEIC…' : 'Processing photo…'}</p>
    </div>`;

  (async () => {
    try {
      const dataUrl = await imageFileToDataUrl(file);
      processSearchPhotoForScanner(dataUrl, file.name);
    } catch (e) {
      closeSheet();
      toast(e.message, 'error');
    }
  })();

  event.target.value = '';
}


// ── Search (scanner mode) ────────────────────────────────────
function scannerDoSearch() {
  const q = document.getElementById('scanner-search-input')?.value?.trim();
  if (!q) return;
  scannerFetchAndShowResults(q, false);
}

async function scannerFetchAndShowResults(query, isBarcode) {
  openSheet();
  const body = document.getElementById('scanner-sheet-body');

  body.innerHTML = `
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
      body.innerHTML = `
        <div class="text-center py-8 text-on-surface-v">
          <i class="bi bi-emoji-frown text-4xl"></i>
          <p class="mt-3">No results${isBarcode ? ' for this barcode' : ''}.</p>
        </div>`;
      document.getElementById('scanner-sheet-footer').innerHTML = `
        <button class="btn-ghost-new w-full" onclick="closeSheet(); switchScannerMode('search')">
          Try a manual search
        </button>`;
      return;
    }

    showResultsInSheet(results, isBarcode);
  } catch (e) {
    body.innerHTML = `
      <div class="text-center py-6 text-danger">
        <i class="bi bi-exclamation-triangle text-3xl"></i>
        <p class="mt-2">Discogs error: ${esc(e.message)}</p>
      </div>`;
  }
}


// ── Bottom Sheet ─────────────────────────────────────────────
function openSheet() {
  const sheet    = document.getElementById('scanner-sheet');
  const backdrop = document.getElementById('scanner-sheet-backdrop');

  backdrop.classList.remove('hidden');
  sheet.style.transform = 'translateY(0)';
  sheet.classList.add('sheet-open');
}

function closeSheet() {
  const sheet    = document.getElementById('scanner-sheet');
  const backdrop = document.getElementById('scanner-sheet-backdrop');

  _sheetView = null;
  sheet.style.transform = 'translateY(100%)';
  sheet.classList.remove('sheet-open');
  backdrop.classList.add('hidden');

  setTimeout(() => {
    document.getElementById('scanner-sheet-header').innerHTML = '';
    document.getElementById('scanner-sheet-body').innerHTML = '';
    document.getElementById('scanner-sheet-footer').innerHTML = '';
  }, 400);

  // Restart barcode scanning if still in barcode mode
  if (scannerMode === 'barcode' && cameraStream) {
    startQuaggaPolling();
  }
}

let _sheetView = null; // 'results' | 'confirm' — tracks current sheet content


// ── Results in Sheet ─────────────────────────────────────────
function _buildFormatString(r) {
  if (Array.isArray(r.formats) && r.formats.length) {
    const parts = [];
    for (const f of r.formats) {
      parts.push(f.name);
      if (Array.isArray(f.descriptions)) parts.push(...f.descriptions);
      if (f.text) parts.push(f.text);
    }
    return parts.join(', ');
  }
  return Array.isArray(r.format) ? r.format.join(', ') : (r.format || '');
}

function showResultsInSheet(results, isBarcode) {
  _sheetView = 'results';
  openSheet();

  const header = document.getElementById('scanner-sheet-header');
  const body   = document.getElementById('scanner-sheet-body');
  const footer = document.getElementById('scanner-sheet-footer');

  header.innerHTML = `
    <div>
      <h2 class="font-headline text-2xl font-bold text-on-surface">Matches Found</h2>
      <p class="font-label text-[10px] uppercase tracking-widest text-primary font-bold">
        ${results.length} result${results.length !== 1 ? 's' : ''} identified
      </p>
    </div>
    <button onclick="closeSheet()" class="w-10 h-10 flex items-center justify-center bg-surface-high rounded-full text-on-surface-v hover:text-on-surface transition-colors shrink-0">
      <i class="bi bi-x-lg"></i>
    </button>`;

  body.innerHTML = `
    <div class="space-y-3">
      ${results.map((r, i) => {
        const thumb = r.cover_image || r.thumb || '';
        const year  = r.year || '';
        const label = Array.isArray(r.label) ? r.label[0] : (r.label || '');
        const fmt   = _buildFormatString(r);
        return `
          <div class="group flex items-center gap-4 p-4 bg-surface-low rounded-2xl cursor-pointer transition-all hover:bg-surface active:bg-surface-high" onclick="scannerSelectRelease(${i})">
            ${thumb
              ? `<img class="w-20 h-20 object-cover rounded-lg flex-shrink-0 shadow-md" src="${esc(thumb)}" alt=""
                      onerror="this.outerHTML='<div class=\\'w-20 h-20 bg-surface-high rounded-lg flex items-center justify-center text-outline-v flex-shrink-0\\'><i class=\\'bi bi-vinyl text-2xl\\'></i></div>'">`
              : `<div class="w-20 h-20 bg-surface-high rounded-lg flex items-center justify-center text-outline-v flex-shrink-0"><i class="bi bi-vinyl text-2xl"></i></div>`}
            <div class="flex-1 min-w-0">
              <h3 class="font-headline text-lg font-bold text-on-surface truncate">${esc(r.title)}</h3>
              <p class="font-body text-sm text-on-surface-v">${esc(r.artist || '')}</p>
              <p class="font-label text-[10px] text-outline mt-1 uppercase tracking-tight">
                ${[year, label].filter(Boolean).join(' \u2022 ')}
              </p>
              ${fmt ? `<p class="font-label text-[10px] text-outline uppercase tracking-tight">${esc(fmt)}</p>` : ''}
            </div>
            <div class="w-10 h-10 rounded-full bg-surface-high text-outline flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-all">
              <i class="bi bi-plus"></i>
            </div>
          </div>`;
      }).join('')}
    </div>`;

  footer.innerHTML = `
    <button class="w-full py-4 bg-outline-v/20 text-on-surface-v rounded-full font-label text-xs uppercase tracking-widest font-bold active:scale-[0.98] transition-all" onclick="closeSheet(); switchScannerMode('search')">
      None of these match
    </button>`;
}

async function scannerSelectRelease(idx) {
  const stub = window._searchResults[idx];
  const body = document.getElementById('scanner-sheet-body');

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
    showConfirmInSheet();
  } catch (e) {
    body.innerHTML = `
      <div class="text-center py-6 text-danger">
        Error loading release: ${esc(e.message)}
        <br><button class="text-primary hover:underline mt-2" onclick="closeSheet()">Go back</button>
      </div>`;
  }
}


// ── Confirm in Sheet ─────────────────────────────────────────
function showConfirmInSheet() {
  const r = selectedRelease;
  if (!r) return;

  _sheetView = 'confirm';

  const header = document.getElementById('scanner-sheet-header');
  const body   = document.getElementById('scanner-sheet-body');
  const footer = document.getElementById('scanner-sheet-footer');

  // Build a pseudo-record compatible with _renderPanelHtml (from detail.js)
  const pseudo = { ...r, local_cover: null };

  header.innerHTML = `
    <div>
      <h2 class="font-headline text-xl font-bold text-on-surface">Confirm &amp; Add</h2>
    </div>
    <button onclick="closeSheet()" class="w-10 h-10 flex items-center justify-center bg-surface-high rounded-full text-on-surface-v hover:text-on-surface transition-colors shrink-0">
      <i class="bi bi-x-lg"></i>
    </button>`;

  body.innerHTML = `
    <div class="space-y-4">
      ${r.already_in_discogs ? `
        <div class="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 text-sm text-primary mx-4">
          <i class="bi bi-exclamation-triangle mr-1"></i>
          Already in your Discogs collection — sync will be skipped.
        </div>` : ''}

      ${_renderPanelHtml(pseudo, true)}

      <div id="scanner-capture-section" class="flex gap-2 px-4">
        <button onclick="_scannerCaptureCover()"
                class="flex-1 border-2 border-dashed border-outline-v/40 rounded-lg p-3 text-center cursor-pointer transition-colors hover:border-primary">
          <i class="bi bi-camera text-xl text-primary"></i>
          <div class="text-xs text-on-surface-v mt-1">Snap cover</div>
        </button>
        <button onclick="document.getElementById('scanner-cover-input').click()"
                class="flex-1 border-2 border-dashed border-outline-v/40 rounded-lg p-3 text-center cursor-pointer transition-colors hover:border-primary">
          <i class="bi bi-upload text-xl text-primary"></i>
          <div class="text-xs text-on-surface-v mt-1">Upload</div>
        </button>
        <input type="file" id="scanner-cover-input" accept="image/*,.heic,.heif" class="hidden" onchange="_scannerHandleCoverUpload(event)">
      </div>

      <div class="px-4">
        <label class="text-xs text-on-surface-v block mb-1">Personal notes</label>
        <textarea id="notes-input" rows="2"
                  class="w-full bg-transparent border-b border-outline-v/40 py-2 px-0 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors placeholder:text-outline resize-y"
                  placeholder="Condition, purchase price, where you bought it…"></textarea>
      </div>
    </div>`;

  footer.innerHTML = `
    <div class="space-y-2">
      <button id="save-btn" class="btn-primary-new w-full py-4 text-base font-bold" onclick="saveRecord()">
        <i class="bi bi-plus-circle mr-1"></i>Add to Collection
      </button>
      <button class="btn-ghost-new w-full" onclick="showResultsInSheet(window._searchResults || [], !!window._detectedBarcode)">
        <i class="bi bi-arrow-left mr-1"></i>Back to results
      </button>
    </div>`;
}

function _scannerCaptureCover() {
  const dataUrl = captureFromScanner();
  if (!dataUrl) {
    toast('Camera not available — try uploading', 'error');
    return;
  }
  capturedPhoto = dataUrl;
  const wrap = document.getElementById('scanner-cover-wrap');
  const panelImg = document.querySelector('#scanner-sheet-body .detail-panel > img');
  if (wrap) {
    wrap.innerHTML = `<img src="${dataUrl}" class="w-full aspect-square rounded-xl object-cover shadow-lg">`;
  } else if (panelImg) {
    panelImg.src = dataUrl;
  }
  document.getElementById('scanner-capture-section').style.display = 'none';
  toast('Cover photo captured ✓', 'success');
}

async function _scannerHandleCoverUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
              || /\.hei[cf]$/i.test(file.name);
  if (!isHeic && !file.type.startsWith('image/')) {
    toast('Please select an image file', 'error');
    return;
  }
  try {
    capturedPhoto = await imageFileToDataUrl(file);
    const wrap = document.getElementById('scanner-cover-wrap');
    const panelImg = document.querySelector('#scanner-sheet-body .detail-panel > img');
    if (wrap) {
      wrap.innerHTML = `<img src="${capturedPhoto}" class="w-full aspect-square rounded-xl object-cover shadow-lg">`;
    } else if (panelImg) {
      panelImg.src = capturedPhoto;
    }
    document.getElementById('scanner-capture-section').style.display = 'none';
    toast('Photo uploaded ✓', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}


// ── Duplicate Warning ────────────────────────────────────────
function _showDuplicateWarning(existing) {
  const body   = document.getElementById('scanner-sheet-body');
  const footer = document.getElementById('scanner-sheet-footer');

  const cover = existing.local_cover || existing.cover_image_url || '';
  body.innerHTML = `
    <div class="text-center py-6">
      ${cover
        ? `<img src="${esc(cover)}" class="w-24 h-24 object-cover rounded-lg mx-auto mb-4">`
        : `<div class="w-24 h-24 bg-surface-high rounded-lg mx-auto mb-4 flex items-center justify-center text-3xl text-outline-v">
             <i class="bi bi-vinyl"></i>
           </div>`}
      <div class="text-danger font-bold mb-2">
        <i class="bi bi-exclamation-circle mr-1"></i>Already in your collection
      </div>
      <div class="font-semibold text-on-surface">${esc(existing.title)}</div>
      <div class="text-sm text-on-surface-v mt-1">
        ${esc(existing.artist)}${existing.year ? ' · ' + esc(existing.year) : ''}
      </div>
    </div>`;

  footer.innerHTML = `
    <div class="flex gap-3">
      <button class="btn-ghost-new flex-1" onclick="closeScanner()">Close</button>
      <button class="btn-primary-new flex-1" onclick="closeSheet(); switchScannerMode('barcode')">
        <i class="bi bi-arrow-left mr-1"></i>Start over
      </button>
    </div>`;
}


// ── Save Record ──────────────────────────────────────────────
async function saveRecord() {
  const notes   = document.getElementById('notes-input')?.value?.trim() || '';
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin inline-block mr-2"></div>Saving…';
  }

  try {
    const payload = { ...selectedRelease, notes };
    const res     = await fetch('/api/collection', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if (res.status === 409) {
      const json = await res.json();
      const dup  = json.existing || {};
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-plus-circle mr-1"></i>Add to Collection';
      }
      _showDuplicateWarning(dup);
      return;
    }

    if (!res.ok) throw new Error('Backend error ' + res.status);
    const result = await res.json();

    if (capturedPhoto && result.id) {
      await apiPost('/api/upload-cover', {
        image: capturedPhoto, record_id: result.id
      });
    }

    let discogsMsg = '';
    if (selectedRelease.already_in_discogs) {
      discogsMsg = ' (already in Discogs — skipped)';
    } else if (selectedRelease.discogs_id) {
      const ok = await addToDiscogsCollection(selectedRelease.discogs_id);
      discogsMsg = ok ? ' + added to Discogs!' : ' (Discogs sync failed — check console)';
    }

    await loadCollection();
    closeScanner();
    toast(`✓ "${selectedRelease.title}" added${discogsMsg}`, 'success');
  } catch (e) {
    toast('Error saving: ' + e.message, 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-plus-circle mr-1"></i>Add to Collection';
    }
  }
}
