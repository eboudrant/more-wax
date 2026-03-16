// ─────────────────────────────────────────────────────────────────
//  ADD MODAL — entry point & step router
// ─────────────────────────────────────────────────────────────────
function openAddModal() {
  selectedRelease       = null;
  capturedPhoto         = null;
  window._searchResults = [];
  window._detectedBarcode = null;

  addModal = new bootstrap.Modal(document.getElementById('add-modal'));
  addModal.show();
  showStep('method');
}

function closeAddModal() {
  stopCamera();
  addModal?.hide();
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
      <p class="text-muted mb-4" style="font-size:.9rem">
        How would you like to add a record?
      </p>
      <div class="row g-3">
        <div class="col-4">
          <div class="method-card" onclick="showStep('photo')">
            <i class="bi bi-image"></i>
            <h6>Photo</h6>
            <small>Snap or upload a photo of the cover or barcode</small>
          </div>
        </div>
        <div class="col-4">
          <div class="method-card" onclick="showStep('camera')">
            <i class="bi bi-upc-scan"></i>
            <h6>Live scan</h6>
            <small>Point camera at the barcode — detects automatically</small>
          </div>
        </div>
        <div class="col-4">
          <div class="method-card" onclick="showStep('search')">
            <i class="bi bi-search"></i>
            <h6>Search</h6>
            <small>Type artist, album or label name</small>
          </div>
        </div>
      </div>`;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="closeAddModal()">Cancel</button>`;
  }

  // ── photo (snap or upload to identify) ──────────────────────
  else if (step === 'photo') {
    stopCamera();
    body.innerHTML = `
      <p class="text-muted mb-3" style="font-size:.85rem">
        Take or upload a photo of the sleeve or barcode.
        The app will try to detect the barcode automatically.
      </p>
      <div class="d-flex gap-3 mb-3">

        <div id="photo-cam-btn" onclick="startSearchCamera()"
             style="flex:1;border:2px dashed var(--border);border-radius:10px;
                    padding:20px 10px;text-align:center;cursor:pointer;transition:border-color .2s"
             onmouseenter="this.style.borderColor='var(--accent)'"
             onmouseleave="this.style.borderColor='var(--border)'">
          <i class="bi bi-camera-fill" style="font-size:2rem;color:var(--accent)"></i>
          <div style="margin-top:8px;font-weight:600;font-size:.9rem">Take photo</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:3px">Use camera</div>
        </div>

        <div onclick="document.getElementById('search-photo-input').click()"
             style="flex:1;border:2px dashed var(--border);border-radius:10px;
                    padding:20px 10px;text-align:center;cursor:pointer;transition:border-color .2s"
             onmouseenter="this.style.borderColor='var(--accent)'"
             onmouseleave="this.style.borderColor='var(--border)'">
          <i class="bi bi-upload" style="font-size:2rem;color:var(--accent)"></i>
          <div style="margin-top:8px;font-weight:600;font-size:.9rem">Upload photo</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:3px">From your library</div>
        </div>

        <input type="file" id="search-photo-input" accept="image/*,.heic,.heif"
               style="display:none" onchange="handleSearchPhotoUpload(event)">
      </div>

      <!-- Camera preview (hidden until activated) -->
      <div id="search-cam-wrap" style="display:none">
        <video id="search-cam-video" autoplay playsinline muted
               style="width:100%;border-radius:10px;background:#000;max-height:300px;object-fit:cover"></video>
        <button onclick="snapSearchPhoto()" class="btn btn-accent w-100 mt-2">
          <i class="bi bi-camera me-1"></i>Snap photo
        </button>
      </div>

      <!-- Analysis result area -->
      <div id="photo-analysis"></div>`;

    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="showStep('method')">
        <i class="bi bi-arrow-left me-1"></i>Back
      </button>`;
  }

  // ── camera scan ─────────────────────────────────────────────
  else if (step === 'camera') {
    body.innerHTML = `
      <p class="text-muted mb-3" style="font-size:.85rem">
        Hold the barcode steady inside the frame — it detects automatically.
      </p>
      <div id="camera-viewport">
        <video id="camera-video" autoplay playsinline muted></video>
        <div id="camera-overlay">
          <div class="scan-frame"></div>
        </div>
        <div id="barcode-status">Starting camera…</div>
      </div>
      <p class="text-center mt-3" style="font-size:.8rem;color:var(--muted)">
        No barcode visible?
        <a href="#" onclick="showStep('search');return false">Search manually</a>
      </p>`;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="showStep('method')">
        <i class="bi bi-arrow-left me-1"></i>Back
      </button>`;
    startCameraScan();
  }

  // ── text search ─────────────────────────────────────────────
  else if (step === 'search') {
    stopCamera();
    body.innerHTML = `
      <div class="input-group mb-3">
        <input id="search-input" class="form-control"
               placeholder="Artist, album, label…"
               onkeydown="if(event.key==='Enter') doSearch()">
        <button class="btn btn-accent" onclick="doSearch()">
          <i class="bi bi-search"></i>
        </button>
      </div>
      <div id="search-results"></div>`;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="showStep('method')">
        <i class="bi bi-arrow-left me-1"></i>Back
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
    <div class="row g-3">

      <!-- Cover column -->
      <div class="col-sm-4">
        <div id="cover-preview-wrap" class="mb-2">
          ${r.cover_image_url
            ? `<img src="${esc(r.cover_image_url)}" id="cover-preview"
                    style="width:100%;border-radius:8px;max-height:200px;object-fit:cover"
                    onerror="this.style.display='none'">`
            : `<div class="cover-placeholder-large" style="height:160px">
                 <i class="bi bi-vinyl display-3"></i>
               </div>`}
        </div>

        <!-- Cover photo — camera OR file upload -->
        <div id="capture-section">
          <div class="d-flex gap-2">

            <!-- Camera button -->
            <div onclick="openCaptureCamera()"
                 style="flex:1;border:2px dashed var(--border);border-radius:8px;
                        padding:12px 8px;text-align:center;cursor:pointer;transition:border-color .2s"
                 onmouseenter="this.style.borderColor='var(--accent)'"
                 onmouseleave="this.style.borderColor='var(--border)'">
              <i class="bi bi-camera" style="font-size:1.3rem;color:var(--accent)"></i>
              <div style="font-size:.72rem;color:var(--muted);margin-top:4px">Camera</div>
            </div>

            <!-- Upload button -->
            <div onclick="document.getElementById('cover-file-input').click()"
                 style="flex:1;border:2px dashed var(--border);border-radius:8px;
                        padding:12px 8px;text-align:center;cursor:pointer;transition:border-color .2s"
                 onmouseenter="this.style.borderColor='var(--accent)'"
                 onmouseleave="this.style.borderColor='var(--border)'">
              <i class="bi bi-upload" style="font-size:1.3rem;color:var(--accent)"></i>
              <div style="font-size:.72rem;color:var(--muted);margin-top:4px">Upload</div>
            </div>

          </div>
          <!-- Hidden file input -->
          <input type="file" id="cover-file-input" accept="image/*,.heic,.heif"
                 style="display:none" onchange="handleFileUpload(event)">
        </div>
        <video id="capture-video" autoplay playsinline muted
               style="display:none;width:100%;border-radius:8px;margin-top:8px"></video>
        <button id="snap-btn" onclick="snapPhoto()"
                style="display:none" class="btn btn-accent btn-sm w-100 mt-2">
          <i class="bi bi-camera me-1"></i>Snap photo
        </button>
      </div>

      <!-- Info column -->
      <div class="col-sm-8">
        <h5 class="mb-0">${esc(r.title)}</h5>
        <div class="text-muted mb-2">${esc(r.artist)}</div>

        ${r.already_in_discogs ? `
          <div style="background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.35);
                      border-radius:8px;padding:8px 12px;font-size:.8rem;
                      color:var(--accent);margin-bottom:10px;line-height:1.4">
            <i class="bi bi-exclamation-triangle me-1"></i>
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
          <div class="meta-row">
            <span class="label">Genres</span>
            <span class="value">
              ${genres.map(g => `<span class="genre-pill">${esc(g)}</span>`).join('')}
            </span>
          </div>` : ''}

        ${styles.length ? `
          <div class="meta-row">
            <span class="label">Styles</span>
            <span class="value">
              ${styles.map(s => `<span class="genre-pill">${esc(s)}</span>`).join('')}
            </span>
          </div>` : ''}

        <div class="mt-3">
          <label class="form-label" style="font-size:.82rem;color:var(--muted)">
            Personal notes
          </label>
          <textarea id="notes-input" class="form-control" rows="3"
                    placeholder="Condition, purchase price, where you bought it…"></textarea>
        </div>
      </div>
    </div>`;

  footer.innerHTML = `
    <button class="btn btn-ghost" onclick="showStep('search')">
      <i class="bi bi-arrow-left me-1"></i>Back
    </button>
    <button id="save-btn" class="btn btn-accent" onclick="saveRecord()">
      <i class="bi bi-plus-circle me-1"></i>Add to Collection
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
      <div style="height:120px;display:flex;align-items:center;justify-content:center;
                  color:var(--muted);font-size:.85rem;gap:8px">
        <span class="spinner-border spinner-border-sm"></span> Converting HEIC…
      </div>`;
  }

  try {
    capturedPhoto = await imageFileToDataUrl(file);

    document.getElementById('capture-section').style.display = 'none';
    document.getElementById('cover-preview-wrap').innerHTML = `
      <img src="${capturedPhoto}"
           style="width:100%;border-radius:8px;max-height:200px;object-fit:cover">
      <div style="font-size:.72rem;color:var(--muted);margin-top:6px;text-align:center">
        <i class="bi bi-check-circle me-1" style="color:#4ade80"></i>${esc(file.name)}
        ${isHeic ? '<span style="color:var(--accent)"> · converted to JPEG</span>' : ''}
        &nbsp;·&nbsp;
        <a href="#" style="color:var(--accent)"
           onclick="resetCoverSection();return false">Change</a>
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
    ? `<img src="${esc(r.cover_image_url)}"
            style="width:100%;border-radius:8px;max-height:200px;object-fit:cover"
            onerror="this.style.display='none'">`
    : `<div class="cover-placeholder-large" style="height:160px">
         <i class="bi bi-vinyl display-3"></i>
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
    <div style="text-align:center;padding:20px 0 12px">
      ${cover
        ? `<img src="${esc(cover)}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;margin-bottom:14px">`
        : `<div style="width:90px;height:90px;background:var(--surface2);border-radius:8px;
                       display:inline-flex;align-items:center;justify-content:center;
                       margin-bottom:14px;font-size:2rem;color:var(--border)">
             <i class="bi bi-vinyl"></i>
           </div>`}
      <div style="color:var(--danger);font-weight:700;margin-bottom:6px">
        <i class="bi bi-exclamation-circle me-1"></i>Already in your collection
      </div>
      <div style="font-size:.9rem;font-weight:600">${esc(existing.title)}</div>
      <div style="font-size:.82rem;color:var(--muted);margin-top:4px">
        ${esc(existing.artist)}${existing.year ? ' · ' + esc(existing.year) : ''}
      </div>
    </div>`;

  footer.innerHTML = `
    <button class="btn btn-ghost" onclick="closeAddModal()">Close</button>
    <button class="btn btn-accent" onclick="showStep('method')">
      <i class="bi bi-arrow-left me-1"></i>Start over
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
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
  }

  try {
    const payload = { ...selectedRelease, notes };
    const res     = await fetch('/api/collection', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    // Duplicate detected — show a warning with options
    if (res.status === 409) {
      const json = await res.json();
      const dup  = json.existing || {};
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Add to Collection';
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

    // Add to Discogs collection — skip if already there
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
      saveBtn.innerHTML = '<i class="bi bi-plus-circle me-1"></i>Add to Collection';
    }
  }
}
