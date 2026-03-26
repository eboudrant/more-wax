// ─────────────────────────────────────────────────────────────────
//  DISCOGS SYNC — import records from Discogs collection
// ─────────────────────────────────────────────────────────────────
let _syncSelected = new Set();   // discogs_ids to import
let _syncReplace = new Set();    // discogs_ids where user chose "replace"
let _syncDiff = [];
let _syncExpanded = null;        // discogs_id of expanded duplicate
let _syncDidImport = false;      // true if any records were imported

// Uses global esc() from helpers.js

// ── overlay management ───────────────────────────────────────────

function _showSyncOverlay() {
  const el = document.getElementById('sync-overlay');
  if (el) { el.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeSyncOverlay() {
  const el = document.getElementById('sync-overlay');
  if (el) { el.style.display = 'none'; document.body.style.overflow = ''; }
  if (_syncDidImport) {
    _syncDidImport = false;
    loadCollection();
  }
}

// ── phase renderers ──────────────────────────────────────────────

function _syncContent() { return document.getElementById('sync-content'); }
function _syncFooter() { return document.getElementById('sync-footer'); }

function _showSyncLoading(message) {
  const c = _syncContent();
  if (c) c.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full gap-4">
      <div class="w-8 h-8 border-2 border-outline-v border-t-primary rounded-full animate-spin"></div>
      <p class="text-on-surface-v text-sm">${esc(message)}</p>
    </div>`;
  const f = _syncFooter();
  if (f) f.innerHTML = '';
}

function _showSyncMessage(icon, title, subtitle) {
  const c = _syncContent();
  if (c) c.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full gap-3 text-center">
      <i class="bi ${esc(icon)} text-4xl text-primary"></i>
      <h3 class="text-lg font-bold text-on-surface">${esc(title)}</h3>
      ${subtitle ? `<p class="text-sm text-on-surface-v">${esc(subtitle)}</p>` : ''}
    </div>`;
  const f = _syncFooter();
  if (f) f.innerHTML = `
    <button onclick="closeSyncOverlay()" class="btn-primary-new w-full py-3 font-bold">Close</button>`;
}

function _showSyncDiff(diff) {
  _syncDiff = diff;
  // By default: select new records, deselect duplicates
  _syncSelected = new Set(diff.filter(r => !r._duplicate).map(r => r.discogs_id));
  _syncReplace = new Set();
  _syncExpanded = null;
  _renderSyncDiff();
}

function _renderSyncDiff() {
  const c = _syncContent();
  if (!c) return;

  const newRecords = _syncDiff.filter(r => !r._duplicate);
  const dupes = _syncDiff.filter(r => r._duplicate);
  const totalSelected = _syncSelected.size;

  let html = '';

  // New records section
  if (newRecords.length > 0) {
    const allNewSelected = newRecords.every(r => _syncSelected.has(r.discogs_id));
    html += `
      <div class="mb-4 flex items-center justify-between">
        <p class="text-on-surface-v text-sm">
          <strong class="text-on-surface">${newRecords.length}</strong> new record${newRecords.length === 1 ? '' : 's'}
        </p>
        <button onclick="_toggleSyncAllNew()" class="text-xs text-primary hover:text-primary-dim transition-colors">
          ${allNewSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div class="space-y-2 mb-6">
        ${newRecords.map(r => _renderSyncRow(r)).join('')}
      </div>`;
  }

  // Duplicates section
  if (dupes.length > 0) {
    html += `
      <div class="mb-4">
        <p class="text-on-surface-v text-sm">
          <strong class="text-on-surface">${dupes.length}</strong> possible duplicate${dupes.length === 1 ? '' : 's'}
          <span class="text-outline text-xs ml-1">(different pressing)</span>
        </p>
      </div>
      <div class="space-y-2">
        ${dupes.map(r => _renderDuplicateRow(r)).join('')}
      </div>`;
  }

  if (newRecords.length === 0 && dupes.length === 0) {
    html = `<p class="text-on-surface-v text-sm text-center py-8">No records to import.</p>`;
  }

  c.innerHTML = html;

  const f = _syncFooter();
  if (f) f.innerHTML = `
    <div class="flex gap-3">
      <button onclick="closeSyncOverlay()" class="flex-1 py-3 rounded-full border border-outline-v/20 text-on-surface-v font-medium hover:bg-surface-high transition-colors">Cancel</button>
      <button onclick="_startSyncImport()" class="flex-1 btn-primary-new py-3 font-bold" ${totalSelected === 0 ? 'disabled' : ''}>
        Import ${totalSelected} selected
      </button>
    </div>`;
}

function _renderSyncRow(r) {
  const checked = _syncSelected.has(r.discogs_id);
  return `
    <label class="flex items-center gap-3 p-3 rounded-xl bg-surface cursor-pointer hover:bg-surface-high transition-colors ${checked ? 'ring-1 ring-primary/30' : ''}">
      <input type="checkbox" ${checked ? 'checked' : ''}
        onchange="_toggleSyncRecord('${esc(r.discogs_id)}')"
        class="w-4 h-4 rounded border-outline-v text-primary focus:ring-primary">
      <img src="${esc(r.thumb || r.cover_image_url || '')}"
        class="w-12 h-12 rounded-lg object-cover bg-surface-high shrink-0"
        onerror="this.style.display='none'">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-on-surface truncate">${esc(r.title)}</div>
        <div class="text-xs text-on-surface-v truncate">${esc(r.artist)} ${r.year ? '&middot; ' + esc(r.year) : ''}</div>
      </div>
      <a href="https://www.discogs.com/release/${esc(r.discogs_id)}" target="_blank" onclick="event.stopPropagation()"
        class="w-8 h-8 rounded-full bg-surface-high/50 flex items-center justify-center text-outline hover:text-primary transition-colors shrink-0" title="View on Discogs">
        <i class="bi bi-box-arrow-up-right text-xs"></i>
      </a>
    </label>`;
}

function _renderDuplicateRow(r) {
  const expanded = _syncExpanded === r.discogs_id;
  const selected = _syncSelected.has(r.discogs_id);
  const replacing = _syncReplace.has(r.discogs_id);
  const local = r._local_match || {};

  let actionLabel = 'Skip';
  let actionClass = 'text-outline';
  if (selected && replacing) { actionLabel = 'Replace'; actionClass = 'text-amber-400'; }
  else if (selected) { actionLabel = 'Keep both'; actionClass = 'text-primary'; }

  let html = `
    <div class="rounded-xl bg-surface overflow-hidden ${selected ? 'ring-1 ring-primary/30' : ''}">
      <div class="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-high transition-colors"
           onclick="_toggleSyncExpand('${esc(r.discogs_id)}')">
        <i class="bi bi-exclamation-circle text-amber-400/60 text-sm shrink-0"></i>
        <img src="${esc(r.thumb || r.cover_image_url || '')}"
          class="w-12 h-12 rounded-lg object-cover bg-surface-high shrink-0"
          onerror="this.style.display='none'">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-on-surface truncate">${esc(r.title)}</div>
          <div class="text-xs text-on-surface-v truncate">${esc(r.artist)} ${r.year ? '&middot; ' + esc(r.year) : ''}</div>
        </div>
        <a href="https://www.discogs.com/release/${esc(r.discogs_id)}" target="_blank" onclick="event.stopPropagation()"
          class="w-8 h-8 rounded-full bg-surface-high/50 flex items-center justify-center text-outline hover:text-primary transition-colors shrink-0" title="View on Discogs">
          <i class="bi bi-box-arrow-up-right text-xs"></i>
        </a>
        <span class="text-xs ${actionClass} shrink-0">${actionLabel}</span>
        <i class="bi bi-chevron-${expanded ? 'up' : 'down'} text-outline text-xs"></i>
      </div>`;

  if (expanded) {
    html += `
      <div class="px-3 pb-3 space-y-3 border-t border-outline-v/10 pt-3">
        <!-- Comparison -->
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div class="font-label text-outline uppercase tracking-wider mb-2">In your collection</div>
            <div class="space-y-1 text-on-surface-v">
              <div>${esc(local.label || 'Unknown label')}</div>
              <div>${esc(local.catalog_number || '')}</div>
              <div>${esc(local.format || '')}</div>
              <div>${esc(local.year || '')}</div>
              <a href="https://www.discogs.com/release/${esc(local.discogs_id)}" target="_blank"
                class="mt-1 inline-flex items-center gap-1 text-[10px] text-outline hover:text-primary transition-colors">
                <i class="bi bi-box-arrow-up-right"></i> Discogs
              </a>
            </div>
          </div>
          <div>
            <div class="font-label text-outline uppercase tracking-wider mb-2">On Discogs</div>
            <div class="space-y-1 text-on-surface-v">
              <div>${esc(r.label || 'Unknown label')}</div>
              <div>${esc(r.catalog_number || '')}</div>
              <div>${esc(r.format || '')}</div>
              <div>${esc(r.year || '')}</div>
              <a href="https://www.discogs.com/release/${esc(r.discogs_id)}" target="_blank"
                class="mt-1 inline-flex items-center gap-1 text-[10px] text-outline hover:text-primary transition-colors">
                <i class="bi bi-box-arrow-up-right"></i> Discogs
              </a>
            </div>
          </div>
        </div>
        <!-- Actions -->
        <div class="flex gap-2">
          <button onclick="_syncDupeAction('${esc(r.discogs_id)}', 'skip')"
            class="flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${!selected ? 'bg-surface-high text-on-surface' : 'text-outline hover:bg-surface-high'}">
            Skip
          </button>
          <button onclick="_syncDupeAction('${esc(r.discogs_id)}', 'both')"
            class="flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${selected && !replacing ? 'bg-primary/20 text-primary' : 'text-outline hover:bg-surface-high'}">
            Keep both
          </button>
          <button onclick="_syncDupeAction('${esc(r.discogs_id)}', 'replace')"
            class="flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${replacing ? 'bg-amber-400/20 text-amber-400' : 'text-outline hover:bg-surface-high'}">
            Replace
          </button>
        </div>
      </div>`;
  }

  html += `</div>`;
  return html;
}

// ── selection handlers ───────────────────────────────────────────

function _toggleSyncRecord(discogsId) {
  if (_syncSelected.has(discogsId)) _syncSelected.delete(discogsId);
  else _syncSelected.add(discogsId);
  _syncReplace.delete(discogsId);
  _renderSyncDiff();
}

function _toggleSyncAllNew() {
  const newRecords = _syncDiff.filter(r => !r._duplicate);
  const allSelected = newRecords.every(r => _syncSelected.has(r.discogs_id));
  for (const r of newRecords) {
    if (allSelected) _syncSelected.delete(r.discogs_id);
    else _syncSelected.add(r.discogs_id);
  }
  _renderSyncDiff();
}

function _toggleSyncExpand(discogsId) {
  _syncExpanded = _syncExpanded === discogsId ? null : discogsId;
  _renderSyncDiff();
}

function _syncDupeAction(discogsId, action) {
  if (action === 'skip') {
    _syncSelected.delete(discogsId);
    _syncReplace.delete(discogsId);
  } else if (action === 'both') {
    _syncSelected.add(discogsId);
    _syncReplace.delete(discogsId);
  } else if (action === 'replace') {
    _syncSelected.add(discogsId);
    _syncReplace.add(discogsId);
  }
  _renderSyncDiff();
}

// ── import flow ──────────────────────────────────────────────────

async function _startSyncImport() {
  const selected = [..._syncSelected];
  if (selected.length === 0) return;
  const replace = [..._syncReplace];
  _showSyncLoading(`Importing ${selected.length} record${selected.length === 1 ? '' : 's'}...`);

  try {
    const res = await apiPost('/api/sync/import', { selected, replace });
    if (res.error) {
      _showSyncMessage('bi-exclamation-triangle', 'Import failed', esc(res.error));
      return;
    }
    const imported = res.imported || 0;
    const replaced = res.replaced || 0;
    const skipped = res.skipped || 0;
    if (imported > 0 || replaced > 0) _syncDidImport = true;
    let parts = [];
    if (replaced > 0) parts.push(`${replaced} replaced`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    let subtitle = 'Prices and ratings will update in the background.';
    if (parts.length > 0) subtitle = parts.join(', ') + '. ' + subtitle;
    _showSyncMessage('bi-check-circle', `Imported ${imported} record${imported === 1 ? '' : 's'}`, subtitle);
  } catch (e) {
    _showSyncMessage('bi-exclamation-triangle', 'Import failed', esc(e.message));
  }
}

// ── entry point (called from settings) ───────────────────────────

async function startDiscogsSync() {
  AppModal.hide('settings-modal');
  _showSyncOverlay();
  _showSyncLoading('Fetching your Discogs collection...');

  try {
    const res = await apiPost('/api/sync/fetch', {});
    if (res.error) {
      _showSyncMessage('bi-exclamation-triangle', 'Sync failed', esc(res.error));
      return;
    }
    if (!res.diff || res.diff.length === 0) {
      _showSyncMessage('bi-check-circle', 'Already in sync!',
        `All ${res.total_in_discogs} Discogs records are in your collection.`);
      return;
    }
    _showSyncDiff(res.diff);
  } catch (e) {
    _showSyncMessage('bi-exclamation-triangle', 'Sync failed', esc(e.message));
  }
}
