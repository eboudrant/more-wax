// ─────────────────────────────────────────────────────────────────
//  SMART FILTERS — is: prefix autocomplete
// ─────────────────────────────────────────────────────────────────
const SMART_FILTERS = [
  { key: 'is:missing-tracklist', get label() { return t('smartFilter.missingTracklist'); }, fn: r => !r.discogs_extra },
  { key: 'is:missing-cover', get label() { return t('smartFilter.missingCover'); }, fn: r => !r.cover_image_url },
  { key: 'is:no-rating', get label() { return t('smartFilter.noRating'); }, fn: r => !r.rating_average || r.rating_average === 0 },
  { key: 'is:no-price', get label() { return t('smartFilter.noPrice'); }, fn: r => !r.price_median || r.price_median === '0' || r.price_median === '0.00' },
  { key: 'is:duplicate', get label() { return t('smartFilter.duplicate'); }, fn: r => {
    if (!r.master_id || r.master_id === '0') return false;
    return collection.filter(o => o.master_id === r.master_id).length > 1;
  }},
  { key: 'is:liked', get label() { return t('smartFilter.liked'); }, fn: r => r.liked_tracks && r.liked_tracks.length > 0 },
];

/** Update smart filter font styling on the input. */
function _updateSmartFont(inputEl) {
  const isSmart = inputEl.value.toLowerCase().startsWith('is:');
  inputEl.classList.toggle('font-mono', isSmart);
  inputEl.classList.toggle('text-sm', isSmart);
  inputEl.classList.toggle('font-body', !isSmart);
}

/** Show inline ghost suggestion + subtle dropdown for smart filters. */
function _updateSmartHint(inputEl) {
  let hint = document.getElementById('smart-filter-hint');
  if (!hint) {
    hint = document.createElement('span');
    hint.id = 'smart-filter-hint';
    hint.className = 'absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-outline font-mono text-sm py-2';
    inputEl.parentElement.appendChild(hint);
  }
  const q = inputEl.value.toLowerCase();
  _updateSmartFont(inputEl);

  if (!q || !q.startsWith('i')) {
    hint.textContent = '';
    _hideSmartDropdown();
    return;
  }

  const match = SMART_FILTERS.find(f => f.key.startsWith(q) && f.key !== q);
  if (match) {
    hint.innerHTML = `<span class="invisible">${esc(q)}</span>${esc(match.key.slice(q.length))}`;
  } else {
    hint.textContent = '';
  }

  const matches = SMART_FILTERS.filter(f => f.key.startsWith(q));
  if (matches.length > 0 && !SMART_FILTERS.some(f => f.key === q)) {
    _showSmartDropdown(inputEl, matches, q);
  } else {
    _hideSmartDropdown();
  }
}

function _showSmartDropdown(inputEl, matches, q) {
  let dd = document.getElementById('smart-filter-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'smart-filter-dropdown';
    dd.className = 'absolute left-0 right-0 top-full mt-0.5 z-50';
    inputEl.parentElement.appendChild(dd);
  }
  dd.innerHTML = matches.map(f => {
    const count = collection.filter(f.fn).length;
    return `<div class="smart-filter-item flex items-center justify-between py-1.5 cursor-pointer"
      onmousedown="event.preventDefault();document.getElementById('filter-input').value='${f.key}';_hideSmartDropdown();document.getElementById('smart-filter-hint').textContent='';document.getElementById('filter-clear').style.display='block';_updateSmartFont(document.getElementById('filter-input'));filterCollection()">
      <span class="font-mono text-xs">${f.key}</span>
      <span class="text-xs tabular-nums">${count}</span>
    </div>`;
  }).join('');
}

function _hideSmartDropdown() {
  document.getElementById('smart-filter-dropdown')?.remove();
}

/** Accept the ghost suggestion on Tab. */
function _smartFilterTab(event, inputEl) {
  if (event.key !== 'Tab') return;
  const hint = document.getElementById('smart-filter-hint');
  if (!hint || !hint.textContent.trim()) return;
  const q = inputEl.value.toLowerCase();
  const match = SMART_FILTERS.find(f => f.key.startsWith(q) && f.key !== q);
  if (match) {
    event.preventDefault();
    inputEl.value = match.key;
    hint.textContent = '';
    _hideSmartDropdown();
    document.getElementById('filter-clear').style.display = 'block';
    _updateSmartFont(inputEl);
    filterCollection();
  }
}
