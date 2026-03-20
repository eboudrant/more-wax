// ─────────────────────────────────────────────────────────────────
//  ADD MODAL — entry point & step router
// ─────────────────────────────────────────────────────────────────
function openAddModal() {
  selectedRelease       = null;
  capturedPhoto         = null;
  window._searchResults = [];
  window._detectedBarcode = null;

  AppModal.show('add-modal', { staticBackdrop: true });
  showStep('method');
}

function closeAddModal() {
  stopCamera();
  AppModal.hide('add-modal');
}

// ─────────────────────────────────────────────────────────────────
//  STEP ROUTER
// ─────────────────────────────────────────────────────────────────
function showStep(step) {
  const body   = document.getElementById('add-modal-body');
  const footer = document.getElementById('add-modal-footer');

  // ── method ──────────────────────────────────────────────────
  if (step === 'method') {
    stopCamera();
    body.innerHTML = `
      <p class="text-on-surface-v text-sm mb-4">
        How would you like to add a record?
      </p>
      <div class="grid grid-cols-3 gap-3">
        <div class="method-card" onclick="showStep('photo')">
          <i class="bi bi-image text-3xl text-primary mb-2"></i>
          <h6 class="font-bold text-sm text-on-surface">Photo</h6>
          <small class="text-xs text-on-surface-v leading-tight">Snap or upload a photo of the cover or barcode</small>
        </div>
        <div class="method-card" onclick="showStep('camera')">
          <i class="bi bi-upc-scan text-3xl text-primary mb-2"></i>
          <h6 class="font-bold text-sm text-on-surface">Live scan</h6>
          <small class="text-xs text-on-surface-v leading-tight">Point camera at the barcode — detects automatically</small>
        </div>
        <div class="method-card" onclick="showStep('search')">
          <i class="bi bi-search text-3xl text-primary mb-2"></i>
          <h6 class="font-bold text-sm text-on-surface">Search</h6>
          <small class="text-xs text-on-surface-v leading-tight">Type artist, album or label name</small>
        </div>
      </div>`;
    footer.innerHTML = `
      <button class="btn-ghost-new" onclick="closeAddModal()">Cancel</button>`;
  }

  // ── photo (snap or upload to identify) ──────────────────────
  else if (step === 'photo') {
    stopCamera();
    body.innerHTML = `
      <p class="text-on-surface-v text-sm mb-3">
        Take or upload a photo of the sleeve or barcode.
        The app will try to detect the barcode automatically.
      </p>
      <div class="flex gap-3 mb-3">
        <div id="photo-cam-btn" onclick="startSearchCamera()"
             class="flex-1 border-2 border-dashed border-outline-v/40 rounded-xl p-5 text-center cursor-pointer transition-colors hover:border-primary">
          <i class="bi bi-camera-fill text-3xl text-primary"></i>
          <div class="mt-2 font-semibold text-sm text-on-surface">Take photo</div>
          <div class="text-xs text-on-surface-v mt-1">Use camera</div>
        </div>
        <div onclick="document.getElementById('search-photo-input').click()"
             class="flex-1 border-2 border-dashed border-outline-v/40 rounded-xl p-5 text-center cursor-pointer transition-colors hover:border-primary">
          <i class="bi bi-upload text-3xl text-primary"></i>
          <div class="mt-2 font-semibold text-sm text-on-surface">Upload photo</div>
          <div class="text-xs text-on-surface-v mt-1">From your library</div>
        </div>
        <input type="file" id="search-photo-input" accept="image/*,.heic,.heif"
               class="hidden" onchange="handleSearchPhotoUpload(event)">
      </div>

      <div id="search-cam-wrap" class="hidden">
        <video id="search-cam-video" autoplay playsinline muted
               class="w-full rounded-xl bg-black max-h-[300px] object-cover"></video>
        <button onclick="snapSearchPhoto()" class="btn-primary-new w-full mt-2">
          <i class="bi bi-camera mr-1"></i>Snap photo
        </button>
      </div>

      <div id="photo-analysis"></div>`;

    footer.innerHTML = `
      <button class="btn-ghost-new" onclick="showStep('method')">
        <i class="bi bi-arrow-left mr-1"></i>Back
      </button>`;
  }

  // ── camera scan ─────────────────────────────────────────────
  else if (step === 'camera') {
    body.innerHTML = `
      <p class="text-on-surface-v text-sm mb-3">
        Hold the barcode steady inside the frame — it detects automatically.
      </p>
      <div id="camera-viewport">
        <video id="camera-video" autoplay playsinline muted></video>
        <div id="camera-overlay">
          <div class="scan-frame"></div>
        </div>
        <div id="barcode-status">Starting camera…</div>
      </div>
      <p class="text-center mt-3 text-xs text-on-surface-v">
        No barcode visible?
        <a href="#" class="text-primary hover:underline" onclick="showStep('search');return false">Search manually</a>
      </p>`;
    footer.innerHTML = `
      <button class="btn-ghost-new" onclick="showStep('method')">
        <i class="bi bi-arrow-left mr-1"></i>Back
      </button>`;
    startCameraScan();
  }

  // ── text search ─────────────────────────────────────────────
  else if (step === 'search') {
    stopCamera();
    body.innerHTML = `
      <div class="flex gap-2 mb-3">
        <input id="search-input"
               class="flex-1 bg-transparent border-b border-outline-v/40 py-2 px-0 text-on-surface font-body focus:outline-none focus:border-primary transition-colors placeholder:text-outline"
               placeholder="Artist, album, label…"
               onkeydown="if(event.key==='Enter') doSearch()">
        <button class="btn-primary-new px-4" onclick="doSearch()">
          <i class="bi bi-search"></i>
        </button>
      </div>
      <div id="search-results"></div>`;
    footer.innerHTML = `
      <button class="btn-ghost-new" onclick="showStep('method')">
        <i class="bi bi-arrow-left mr-1"></i>Back
      </button>`;
    setTimeout(() => document.getElementById('search-input')?.focus(), 120);
  }

  // ── confirm ─────────────────────────────────────────────────
  else if (step === 'confirm') {
    renderConfirmStep();
  }
}

// ─────────────────────────────────────────────────────────────────
//  CONFIRM STEP
// ─────────────────────────────────────────────────────────────────
function renderConfirmStep() {
  const r      = selectedRelease;
  const body   = document.getElementById('add-modal-body');
  const footer = document.getElementById('add-modal-footer');

  const genres = parseList(r.genres);
  const styles = parseList(r.styles);

  body.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">

      <!-- Cover column -->
      <div>
        <div id="cover-preview-wrap" class="mb-2">
          ${r.cover_image_url
            ? `<img src="${esc(r.cover_image_url)}" id="cover-preview"
                    class="w-full rounded-lg max-h-[200px] object-cover"
                    onerror="this.style.display='none'">`
            : `<div class="w-full h-40 bg-surface-high rounded-lg flex items-center justify-center text-outline-v">
                 <i class="bi bi-vinyl text-5xl"></i>
               </div>`}
        </div>

        <div id="capture-section">
          <div class="flex gap-2">
            <div onclick="openCaptureCamera()"
                 class="flex-1 border-2 border-dashed border-outline-v/40 rounded-lg p-3 text-center cursor-pointer transition-colors hover:border-primary">
              <i class="bi bi-camera text-xl text-primary"></i>
              <div class="text-xs text-on-surface-v mt-1">Camera</div>
            </div>
            <div onclick="document.getElementById('cover-file-input').click()"
                 class="flex-1 border-2 border-dashed border-outline-v/40 rounded-lg p-3 text-center cursor-pointer transition-colors hover:border-primary">
              <i class="bi bi-upload text-xl text-primary"></i>
              <div class="text-xs text-on-surface-v mt-1">Upload</div>
            </div>
          </div>
          <input type="file" id="cover-file-input" accept="image/*,.heic,.heif"
                 class="hidden" onchange="handleFileUpload(event)">
        </div>
        <video id="capture-video" autoplay playsinline muted
               class="hidden w-full rounded-lg mt-2"></video>
        <button id="snap-btn" onclick="snapPhoto()"
                class="hidden btn-primary-new w-full mt-2 text-sm">
          <i class="bi bi-camera mr-1"></i>Snap photo
        </button>
      </div>

      <!-- Info column -->
      <div class="space-y-2">
        <h5 class="font-headline font-bold text-xl text-on-surface">${esc(r.title)}</h5>
        <div class="text-on-surface-v font-headline italic">${esc(r.artist)}</div>

        ${r.already_in_discogs ? `
          <div class="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 text-sm text-primary">
            <i class="bi bi-exclamation-triangle mr-1"></i>
            Already in your Discogs collection — Discogs sync will be skipped.
          </div>` : ''}

        ${metaRow('Year',    r.year)}
        ${metaRow('Label',   r.label)}
        ${metaRow('Cat #',   r.catalog_number)}
        ${metaRow('Format',  r.format)}
        ${metaRow('Country', r.country)}
        ${r.barcode ? metaRow('Barcode', r.barcode) : ''}
        ${ratingStars(r.rating_average, r.rating_count)}
        ${priceRow(r, true)}

        ${genres.length ? `
          <div class="flex flex-wrap gap-1.5 pt-1">
            ${genres.map(g => `<span class="bg-surface-high px-2 py-0.5 rounded text-xs font-label text-on-surface-v">${esc(g)}</span>`).join('')}
          </div>` : ''}

        ${styles.length ? `
          <div class="flex flex-wrap gap-1.5">
            ${styles.map(s => `<span class="bg-surface-high px-2 py-0.5 rounded text-xs font-label text-on-surface-v">${esc(s)}</span>`).join('')}
          </div>` : ''}

        <div class="pt-2">
          <label class="text-xs text-on-surface-v block mb-1">Personal notes</label>
          <textarea id="notes-input" rows="3"
                    class="w-full bg-transparent border-b border-outline-v/40 py-2 px-0 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors placeholder:text-outline resize-y"
                    placeholder="Condition, purchase price, where you bought it…"></textarea>
        </div>
      </div>
    </div>`;

  footer.innerHTML = `
    <button class="btn-ghost-new" onclick="showStep('search')">
      <i class="bi bi-arrow-left mr-1"></i>Back
    </button>
    <button id="save-btn" class="btn-primary-new" onclick="saveRecord()">
      <i class="bi bi-plus-circle mr-1"></i>Add to Collection
    </button>`;
}

// ─────────────────────────────────────────────────────────────────
//  COVER PHOTO — FILE UPLOAD (in confirm step)
// ─────────────────────────────────────────────────────────────────
async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
              || /\.hei[cf]$/i.test(file.name);

  if (!isHeic && !file.type.startsWith('image/')) {
    toast('Please select an image file', 'error');
    return;
  }

  if (isHeic) {
    document.getElementById('cover-preview-wrap').innerHTML = `
      <div class="h-28 flex items-center justify-center text-on-surface-v text-sm gap-2">
        <div class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div> Converting HEIC…
      </div>`;
  }

  try {
    capturedPhoto = await imageFileToDataUrl(file);

    document.getElementById('capture-section').style.display = 'none';
    document.getElementById('cover-preview-wrap').innerHTML = `
      <img src="${capturedPhoto}" class="w-full rounded-lg max-h-[200px] object-cover">
      <div class="text-xs text-on-surface-v mt-1.5 text-center">
        <i class="bi bi-check-circle mr-1 text-green"></i>${esc(file.name)}
        ${isHeic ? '<span class="text-primary"> · converted to JPEG</span>' : ''}
        &nbsp;·&nbsp;
        <a href="#" class="text-primary hover:underline" onclick="resetCoverSection();return false">Change</a>
      </div>`;

    toast('Photo uploaded ✓', 'success');
  } catch (err) {
    toast(err.message, 'error');
    resetCoverSection();
  }
}

function resetCoverSection() {
  capturedPhoto = null;
  document.getElementById('capture-section').style.display = 'block';
  const r = selectedRelease;
  document.getElementById('cover-preview-wrap').innerHTML = r?.cover_image_url
    ? `<img src="${esc(r.cover_image_url)}" class="w-full rounded-lg max-h-[200px] object-cover" onerror="this.style.display='none'">`
    : `<div class="w-full h-40 bg-surface-high rounded-lg flex items-center justify-center text-outline-v">
         <i class="bi bi-vinyl text-5xl"></i>
       </div>`;
}

// ─────────────────────────────────────────────────────────────────
//  DUPLICATE WARNING
// ─────────────────────────────────────────────────────────────────
function _showDuplicateWarning(existing) {
  const body   = document.getElementById('add-modal-body');
  const footer = document.getElementById('add-modal-footer');

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
    <button class="btn-ghost-new" onclick="closeAddModal()">Close</button>
    <button class="btn-primary-new" onclick="showStep('method')">
      <i class="bi bi-arrow-left mr-1"></i>Start over
    </button>`;
}

// ─────────────────────────────────────────────────────────────────
//  SAVE RECORD
// ─────────────────────────────────────────────────────────────────
async function saveRecord() {
  const notes  = document.getElementById('notes-input')?.value?.trim() || '';
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

    closeAddModal();
    await loadCollection();
    toast(`✓ "${selectedRelease.title}" added${discogsMsg}`, 'success');
  } catch (e) {
    toast('Error saving: ' + e.message, 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-plus-circle mr-1"></i>Add to Collection';
    }
  }
}
