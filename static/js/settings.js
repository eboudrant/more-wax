// ─────────────────────────────────────────────────────────────────
//  SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────
let _settingsData = null;

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

  // Google OAuth — show active state or setup form
  const authActive = !!(d.google_client_id_set && d.google_client_secret_set);
  const activeEl = document.getElementById('settings-auth-active');
  const setupEl = document.getElementById('settings-auth-setup');
  if (activeEl) activeEl.classList.toggle('hidden', !authActive);
  if (setupEl) setupEl.classList.toggle('hidden', authActive);

  // Allowed emails (in active state)
  const ae = document.getElementById('settings-allowed-emails');
  if (ae) ae.value = d.allowed_emails || '';

  // Enable button — activate when both fields have content
  const gidInput = document.getElementById('settings-google-client-id');
  const gsInput = document.getElementById('settings-google-client-secret');
  const enableBtn = document.getElementById('settings-auth-enable-btn');
  if (gidInput && gsInput && enableBtn) {
    const updateBtn = () => { enableBtn.disabled = !gidInput.value.trim() || !gsInput.value.trim(); };
    gidInput.oninput = updateBtn;
    gsInput.oninput = updateBtn;
    gidInput.onpaste = () => setTimeout(updateBtn, 0);
    gsInput.onpaste = () => setTimeout(updateBtn, 0);
    gidInput.onchange = updateBtn;
    gsInput.onchange = updateBtn;
  }

  // Discogs sync — only show when Discogs is connected
  const syncSection = document.getElementById('settings-sync-section');
  if (syncSection) syncSection.style.display = d.discogs_token_set ? '' : 'none';

  const syncStatus = document.getElementById('settings-sync-status');
  if (syncStatus && d.discogs_token_set) {
    const missing = d.sync_missing_master_ids || 0;
    if (missing > 0) {
      syncStatus.textContent = `${missing} record${missing === 1 ? '' : 's'} missing release metadata — first sync will index them automatically.`;
    } else {
      syncStatus.textContent = '';
    }
  }
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
  };
  const [isSet, changeLabel, addLabel] = labels[type] || [false, 'Change', 'Add'];
  if (btn) btn.textContent = isHidden ? 'Cancel' : (isSet ? changeLabel : addLabel);

  if (isHidden) {
    const input = wrap.querySelector('input');
    if (input) { input.value = ''; input.focus(); }
    _setStatus(type, '');
    _setError(type, '');

    const inputIds = { 'discogs': 'settings-discogs-token', 'anthropic': 'settings-anthropic-key' };
    const inputEl = document.getElementById(inputIds[type]);
    if (inputEl) {
      inputEl.onblur = () => _triggerValidate(type);
      inputEl.onchange = () => _triggerValidate(type);
    }
  }
}

function _triggerValidate(type) {
  const inputIds = { 'discogs': 'settings-discogs-token', 'anthropic': 'settings-anthropic-key' };
  const input = document.getElementById(inputIds[type]);
  const val = input?.value.trim();
  if (!val) { _setStatus(type, ''); _setError(type, ''); return; }

  _setStatus(type, 'loading');
  _validateAndSave(type, val);
}

async function _validateAndSave(type, value) {
  const keyMap = { 'discogs': 'discogs_token', 'anthropic': 'anthropic_api_key' };
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
    _settingsData = res;
    _renderSettings();
    // Refresh status for dashboard
    try {
      _serverStatus = await apiGet('/api/status');
      _renderStatus();
    } catch { /* ignore */ }
  } catch (e) {
    _setStatus(type, 'invalid');
    _setError(type, 'Validation failed');
  }
}

/** Enable Google OAuth — validates credentials with Google, then saves. */
async function settingsEnableAuth() {
  const clientId = document.getElementById('settings-google-client-id')?.value.trim();
  const clientSecret = document.getElementById('settings-google-client-secret')?.value.trim();
  const errEl = document.getElementById('settings-auth-error');
  const btn = document.getElementById('settings-auth-enable-btn');
  if (!clientId || !clientSecret) return;

  // Show loading
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-arrow-repeat animate-spin"></i> Validating…'; }
  if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }

  try {
    const res = await apiPost('/api/settings', { google_client_id: clientId, google_client_secret: clientSecret });
    if (res.success === false) {
      if (errEl) { errEl.textContent = res.error || 'Invalid credentials'; errEl.classList.remove('hidden'); }
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-shield-lock"></i> Enable Authentication'; }
      return;
    }
    // Success — show confirmation
    _settingsData = res;
    AppModal.hide('settings-modal');
    _showAuthConfirm('enabled');
  } catch (e) {
    if (errEl) { errEl.textContent = 'Failed to validate credentials'; errEl.classList.remove('hidden'); }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-shield-lock"></i> Enable Authentication'; }
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

function _showAuthConfirm(mode) {
  const body = document.getElementById('auth-confirm-body');
  if (!body) return;

  if (mode === 'enabled') {
    body.innerHTML = `
      <div class="text-4xl">🔒</div>
      <h3 class="font-headline font-bold text-lg text-on-surface">Authentication enabled</h3>
      <p class="text-on-surface-v text-sm leading-relaxed">
        Google Sign-In is now active. When accessed from the internet,
        users will need to sign in with an authorized Google account.
      </p>
      <p class="text-on-surface-v text-sm">
        The <strong class="text-on-surface">first person to sign in</strong> will become the owner —
        no other account will be able to access the app unless you add them in settings.
      </p>
      <p class="text-on-surface-v text-xs">Local access (LAN) remains open without sign-in.</p>
      <button onclick="AppModal.hide('auth-confirm-modal'); location.reload();"
        class="w-full px-6 py-3 bg-primary text-bg rounded-full font-label text-sm uppercase tracking-wider hover:brightness-110 transition">
        Got it
      </button>
    `;
  } else if (mode === 'disable') {
    body.innerHTML = `
      <div class="text-4xl">🔓</div>
      <h3 class="font-headline font-bold text-lg text-on-surface">Disable authentication?</h3>
      <p class="text-on-surface-v text-sm leading-relaxed">
        Anyone with access to the server will be able to use More'Wax without signing in.
        Your Google credentials will be removed.
      </p>
      <div class="flex gap-3">
        <button data-dismiss="modal"
          class="flex-1 px-4 py-2.5 border border-outline-v/30 text-on-surface-v rounded-full text-sm hover:bg-surface-high transition">
          Cancel
        </button>
        <button onclick="_doDisableAuth()"
          class="flex-1 px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-sm hover:bg-red-500/30 transition">
          Disable
        </button>
      </div>
    `;
  }

  // Show after a tick to let settings modal finish closing
  setTimeout(() => AppModal.show('auth-confirm-modal', { staticBackdrop: true }), 300);
}

function settingsDisableAuth() {
  AppModal.hide('settings-modal');
  _showAuthConfirm('disable');
}

async function _doDisableAuth() {
  try {
    await apiPost('/api/settings', { clear_google_auth: true });
  } catch (e) {
    console.warn('Failed to disable auth', e);
  }
  location.reload();
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
