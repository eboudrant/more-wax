// ─────────────────────────────────────────────────────────────────
//  SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────
let _settingsData = null;
let _settingsDebounce = null;

async function openSettings() {
  AppModal.show('settings-modal');
  try {
    _settingsData = await apiGet('/api/settings');
    _renderSettings();
  } catch (e) {
    console.warn('Failed to load settings', e);
  }
}

function _renderSettings() {
  const d = _settingsData;
  if (!d) return;

  // Masked tokens
  const dm = document.getElementById('settings-discogs-mask');
  const am = document.getElementById('settings-anthropic-mask');
  if (dm) dm.textContent = d.discogs_token_set ? d.discogs_token_masked : 'Not set';
  if (am) am.textContent = d.anthropic_key_set ? d.anthropic_key_masked : 'Not set';

  // Reset input visibility
  document.getElementById('settings-discogs-input-wrap')?.classList.add('hidden');
  document.getElementById('settings-anthropic-input-wrap')?.classList.add('hidden');

  // Change button text
  const dc = document.getElementById('settings-discogs-change');
  const ac = document.getElementById('settings-anthropic-change');
  if (dc) dc.textContent = d.discogs_token_set ? 'Change token' : 'Add token';
  if (ac) ac.textContent = d.anthropic_key_set ? 'Change key' : 'Add key';

  // Vision model dropdown
  const select = document.getElementById('settings-vision-model');
  if (select && d.supported_models) {
    select.innerHTML = d.supported_models.map(m =>
      `<option value="${esc(m)}" ${m === d.vision_model ? 'selected' : ''}>${esc(m)}</option>`
    ).join('');
  }

  // Format filter
  const fmt = document.getElementById('settings-format-filter');
  if (fmt) fmt.value = d.format_filter || 'Vinyl';
}

function settingsToggleToken(type) {
  const wrap = document.getElementById(`settings-${type}-input-wrap`);
  const btn = document.getElementById(`settings-${type}-change`);
  if (!wrap) return;

  const isHidden = wrap.classList.contains('hidden');
  wrap.classList.toggle('hidden');
  if (btn) btn.textContent = isHidden ? 'Cancel' : (
    type === 'discogs'
      ? (_settingsData?.discogs_token_set ? 'Change token' : 'Add token')
      : (_settingsData?.anthropic_key_set ? 'Change key' : 'Add key')
  );

  if (isHidden) {
    // Clear and focus
    const input = wrap.querySelector('input');
    if (input) { input.value = ''; input.focus(); }
    _setStatus(type, '');
    _setError(type, '');

    // Bind validation
    const inputEl = type === 'discogs'
      ? document.getElementById('settings-discogs-token')
      : document.getElementById('settings-anthropic-key');
    if (inputEl) {
      inputEl.oninput = () => _debounceValidate(type);
      inputEl.onpaste = () => setTimeout(() => _debounceValidate(type), 50);
    }
  }
}

function _debounceValidate(type) {
  clearTimeout(_settingsDebounce);
  const input = type === 'discogs'
    ? document.getElementById('settings-discogs-token')
    : document.getElementById('settings-anthropic-key');
  const val = input?.value.trim();
  if (!val) { _setStatus(type, ''); _setError(type, ''); return; }

  _setStatus(type, 'loading');
  _settingsDebounce = setTimeout(() => _validateAndSave(type, val), 600);
}

async function _validateAndSave(type, value) {
  const key = type === 'discogs' ? 'discogs_token' : 'anthropic_api_key';
  try {
    const res = await apiPost('/api/settings', { [key]: value });
    if (res.success === false) {
      _setStatus(type, 'invalid');
      _setError(type, res.error || 'Invalid');
      return;
    }
    _setStatus(type, 'valid');
    _setError(type, '');
    // Refresh settings data
    _settingsData = await apiGet('/api/settings');
    _renderSettings();
    // Refresh status for dashboard
    _serverStatus = await apiGet('/api/status');
    _renderStatus();
  } catch (e) {
    _setStatus(type, 'invalid');
    _setError(type, 'Validation failed');
  }
}

function _setStatus(type, state) {
  const el = document.getElementById(`settings-${type}-status`);
  if (!el) return;
  if (state === 'loading') el.innerHTML = '<i class="bi bi-arrow-repeat animate-spin text-outline"></i>';
  else if (state === 'valid') el.innerHTML = '<i class="bi bi-check-circle-fill text-green-400"></i>';
  else if (state === 'invalid') el.innerHTML = '<i class="bi bi-x-circle-fill text-red-400"></i>';
  else el.innerHTML = '';
}

function _setError(type, msg) {
  const el = document.getElementById(`settings-${type}-error`);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

async function settingsSaveModel(model) {
  try {
    await apiPost('/api/settings', { vision_model: model });
    _serverStatus = await apiGet('/api/status');
  } catch (e) {
    console.warn('Failed to save model', e);
  }
}

async function settingsSaveFormat(value) {
  try {
    await apiPost('/api/settings', { format_filter: value });
    _serverStatus = await apiGet('/api/status');
  } catch (e) {
    console.warn('Failed to save format filter', e);
  }
}

function settingsExport() {
  window.location = '/api/export';
}
