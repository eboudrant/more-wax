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

  // Google OAuth
  const gidm = document.getElementById('settings-google-id-mask');
  const gsm = document.getElementById('settings-google-secret-mask');
  if (gidm) gidm.textContent = d.google_client_id_set ? d.google_client_id_masked : 'Not set';
  if (gsm) gsm.textContent = d.google_client_secret_set ? d.google_client_secret_masked : 'Not set';
  document.getElementById('settings-google-id-input-wrap')?.classList.add('hidden');
  document.getElementById('settings-google-secret-input-wrap')?.classList.add('hidden');
  const gidc = document.getElementById('settings-google-id-change');
  const gsc = document.getElementById('settings-google-secret-change');
  if (gidc) gidc.textContent = d.google_client_id_set ? 'Change' : 'Add';
  if (gsc) gsc.textContent = d.google_client_secret_set ? 'Change' : 'Add';

  // Disable auth button — only show when auth is fully configured
  const disableBtn = document.getElementById('settings-auth-disable');
  if (disableBtn) {
    const authConfigured = d.google_client_id_set || d.google_client_secret_set;
    disableBtn.style.display = authConfigured ? 'inline' : 'none';
  }

  // Allowed emails
  const ae = document.getElementById('settings-allowed-emails');
  if (ae) ae.value = d.allowed_emails || '';
}

function settingsToggleToken(type) {
  const wrap = document.getElementById(`settings-${type}-input-wrap`);
  const btn = document.getElementById(`settings-${type}-change`);
  if (!wrap) return;

  const isHidden = wrap.classList.contains('hidden');
  wrap.classList.toggle('hidden');
  const labels = {
    'discogs': [_settingsData?.discogs_token_set, 'Change token', 'Add token'],
    'anthropic': [_settingsData?.anthropic_key_set, 'Change key', 'Add key'],
    'google-id': [_settingsData?.google_client_id_set, 'Change', 'Add'],
    'google-secret': [_settingsData?.google_client_secret_set, 'Change', 'Add'],
  };
  const [isSet, changeLabel, addLabel] = labels[type] || [false, 'Change', 'Add'];
  if (btn) btn.textContent = isHidden ? 'Cancel' : (isSet ? changeLabel : addLabel);

  if (isHidden) {
    // Clear and focus
    const input = wrap.querySelector('input');
    if (input) { input.value = ''; input.focus(); }
    _setStatus(type, '');
    _setError(type, '');

    // Bind validation
    const inputIds = {
      'discogs': 'settings-discogs-token',
      'anthropic': 'settings-anthropic-key',
      'google-id': 'settings-google-client-id',
      'google-secret': 'settings-google-client-secret',
    };
    const inputEl = document.getElementById(inputIds[type]);
    if (inputEl) {
      inputEl.oninput = () => _debounceValidate(type);
      inputEl.onpaste = () => setTimeout(() => _debounceValidate(type), 50);
    }
  }
}

function _debounceValidate(type) {
  clearTimeout(_settingsDebounce);
  const inputIds = {
    'discogs': 'settings-discogs-token',
    'anthropic': 'settings-anthropic-key',
    'google-id': 'settings-google-client-id',
    'google-secret': 'settings-google-client-secret',
  };
  const input = document.getElementById(inputIds[type]);
  const val = input?.value.trim();
  if (!val) { _setStatus(type, ''); _setError(type, ''); return; }

  _setStatus(type, 'loading');
  _settingsDebounce = setTimeout(() => _validateAndSave(type, val), 600);
}

async function _validateAndSave(type, value) {
  const keyMap = {
    'discogs': 'discogs_token',
    'anthropic': 'anthropic_api_key',
    'google-id': 'google_client_id',
    'google-secret': 'google_client_secret',
  };
  const key = keyMap[type] || type;
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

async function settingsDisableAuth() {
  if (!confirm('Disable Google authentication? Anyone with access to the server will be able to use it.')) return;
  try {
    await apiPost('/api/settings', { google_client_id: '', google_client_secret: '', allowed_emails: '' });
    _settingsData = await apiGet('/api/settings');
    _renderSettings();
  } catch (e) {
    console.warn('Failed to disable auth', e);
  }
}

async function settingsSaveAllowedEmails(value) {
  try {
    await apiPost('/api/settings', { allowed_emails: value.trim() });
  } catch (e) {
    console.warn('Failed to save allowed emails', e);
  }
}

function settingsExport() {
  window.location = '/api/export';
}
