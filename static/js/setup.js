// ─────────────────────────────────────────────────────────────────
//  SETUP WIZARD
//  Two-step modal: 1) Discogs token (required) → 2) Claude API key (optional)
// ─────────────────────────────────────────────────────────────────

let _setupOverlay = null;
let _validateTimer = null;
let _discogsValid = false;
let _setupError = '';

function showSetupWizard(errorMsg) {
  _setupError = errorMsg || '';
  if (_setupOverlay) {
    _renderStep1();
    return;
  }
  _setupOverlay = document.createElement('div');
  _setupOverlay.id = 'setup-wizard';
  _setupOverlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm';
  _setupOverlay.innerHTML = '';
  document.body.appendChild(_setupOverlay);
  _renderStep1();
}

function _setupCard(content) {
  return `
    <div class="bg-surface rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-5">
      <div class="flex items-center gap-3">
        <img src="/static/logo.svg" alt="More'Wax" class="h-8 w-8 rounded-full">
        <h2 class="font-headline italic font-bold text-on-surface text-xl tracking-tighter">More'Wax</h2>
      </div>
      ${content}
    </div>
  `;
}

function _inputWithStatus(id, placeholder, label) {
  return `
    <div>
      <label class="block text-sm font-medium text-on-surface/60 mb-1.5">${label}</label>
      <div class="relative">
        <input id="${id}" type="text" placeholder="${placeholder}"
          class="w-full bg-surface-high border border-on-surface/20 rounded-lg px-3 py-2.5 pr-10 text-on-surface text-sm placeholder:text-on-surface/30 focus:outline-none focus:border-primary">
        <span id="${id}-status" class="absolute right-3 top-1/2 -translate-y-1/2 text-base"></span>
      </div>
    </div>
  `;
}

function _setInputStatus(id, state) {
  const status = document.getElementById(id + '-status');
  const input = document.getElementById(id);
  if (!status || !input) return;
  input.classList.remove('border-green-500/50', 'border-red-500/50', 'border-on-surface/20');
  if (state === 'loading') {
    status.innerHTML = '<i class="bi bi-arrow-repeat animate-spin text-on-surface/40"></i>';
    input.classList.add('border-on-surface/20');
  } else if (state === 'valid') {
    status.innerHTML = '<i class="bi bi-check-circle-fill text-green-400"></i>';
    input.classList.add('border-green-500/50');
  } else if (state === 'invalid') {
    status.innerHTML = '<i class="bi bi-x-circle-fill text-red-400"></i>';
    input.classList.add('border-red-500/50');
  } else {
    status.innerHTML = '';
    input.classList.add('border-on-surface/20');
  }
}

function _debounceValidate(inputId, validateFn, delay = 600) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(_validateTimer);
    const val = input.value.trim();
    if (!val) {
      _setInputStatus(inputId, '');
      return;
    }
    _setInputStatus(inputId, 'loading');
    _validateTimer = setTimeout(() => validateFn(val), delay);
  });
  // Also validate on paste (immediate)
  input.addEventListener('paste', () => {
    clearTimeout(_validateTimer);
    setTimeout(() => {
      const val = input.value.trim();
      if (!val) return;
      _setInputStatus(inputId, 'loading');
      validateFn(val);
    }, 50);
  });
}

async function _validateDiscogs(token) {
  try {
    const res = await fetch('/api/setup/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discogs_token: token }),
    });
    const data = await res.json();
    _discogsValid = data.valid;
    _setInputStatus('setup-discogs-token', data.valid ? 'valid' : 'invalid');
    const errEl = document.getElementById('setup-error-1');
    if (errEl) {
      if (data.valid) {
        errEl.classList.add('hidden');
      } else {
        errEl.textContent = data.error || 'Invalid token.';
        errEl.classList.remove('hidden');
      }
    }
    // Update button state
    const btn = document.getElementById('setup-btn-1');
    if (btn && data.valid) {
      btn.textContent = 'Continue';
    }
  } catch {
    _setInputStatus('setup-discogs-token', '');
  }
}

async function _validateAnthropic(key) {
  try {
    const res = await fetch('/api/setup/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: key }),
    });
    const data = await res.json();
    _setInputStatus('setup-anthropic-key', data.valid ? 'valid' : 'invalid');
    const errEl = document.getElementById('setup-error-2');
    if (errEl) {
      if (data.valid) {
        errEl.classList.add('hidden');
      } else {
        errEl.textContent = data.error || 'Invalid key.';
        errEl.classList.remove('hidden');
      }
    }
  } catch {
    _setInputStatus('setup-anthropic-key', '');
  }
}

function _renderStep1() {
  _discogsValid = false;
  _setupOverlay.innerHTML = _setupCard(`
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold text-on-surface">Connect to Discogs</h3>
        <p class="text-sm text-on-surface/70 mt-1">
          More'Wax uses your Discogs account to search releases, fetch prices, and sync your collection.
        </p>
      </div>
      ${_inputWithStatus('setup-discogs-token', 'Paste your token here', 'Personal Access Token')}
      <a href="https://www.discogs.com/settings/developers" target="_blank" rel="noopener"
        class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <i class="bi bi-box-arrow-up-right text-xs"></i>
        Get a token on Discogs
      </a>
      <div id="setup-error-1" class="${_setupError ? '' : 'hidden'} text-sm text-red-400">${_setupError ? esc(_setupError) : ''}</div>
      <button id="setup-btn-1" onclick="_submitStep1()"
        class="w-full bg-primary text-bg font-semibold py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed">
        Connect
      </button>
    </div>
  `);
  setTimeout(() => document.getElementById('setup-discogs-token')?.focus(), 100);
  _debounceValidate('setup-discogs-token', _validateDiscogs, 500);
  document.getElementById('setup-discogs-token')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _submitStep1();
  });
}

async function _submitStep1() {
  const input = document.getElementById('setup-discogs-token');
  const btn = document.getElementById('setup-btn-1');
  const errEl = document.getElementById('setup-error-1');
  const token = input?.value?.trim();

  if (!token) {
    errEl.textContent = 'Please enter your Discogs token.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discogs_token: token }),
    });
    const data = await res.json();
    if (!data.success) {
      errEl.textContent = data.error || 'Invalid token. Please check and try again.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Connect';
      _setInputStatus('setup-discogs-token', 'invalid');
      return;
    }
    _serverStatus = data;
    _renderStep2();
  } catch (e) {
    errEl.textContent = 'Could not reach the server. Please try again.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Connect';
  }
}

function _renderStep2(errorMsg) {
  const step2Error = errorMsg || '';
  _setupOverlay.innerHTML = _setupCard(`
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold text-on-surface">Claude AI <span class="text-xs font-normal text-outline-v">(optional)</span></h3>
        <p class="text-sm text-on-surface/70 mt-1">
          Enable cover photo identification — snap a photo of a record and Claude Vision will identify it.
          Costs ~$0.007 per photo (~$0.70 per 100).
        </p>
      </div>
      ${_inputWithStatus('setup-anthropic-key', 'sk-ant-...', 'Anthropic API Key')}
      <a href="https://console.anthropic.com/" target="_blank" rel="noopener"
        class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <i class="bi bi-box-arrow-up-right text-xs"></i>
        Get an API key from Anthropic
      </a>
      <div id="setup-error-2" class="${step2Error ? '' : 'hidden'} text-sm text-red-400">${step2Error ? esc(step2Error) : ''}</div>
      <div class="flex gap-3">
        <button onclick="_renderStep1()" class="shrink-0 border border-on-surface/20 text-on-surface/70 font-medium py-2.5 px-4 rounded-lg hover:bg-surface-high transition">
          <i class="bi bi-arrow-left"></i>
        </button>
        <button onclick="_finishSetup()" class="flex-1 border border-on-surface/20 text-on-surface/70 font-medium py-2.5 rounded-lg hover:bg-surface-high transition">
          Skip
        </button>
        <button id="setup-btn-2" onclick="_submitStep2()"
          class="flex-1 bg-primary text-bg font-semibold py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed">
          Save
        </button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('setup-anthropic-key')?.focus(), 100);
  _debounceValidate('setup-anthropic-key', _validateAnthropic, 500);
  document.getElementById('setup-anthropic-key')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _submitStep2();
  });
}

async function _submitStep2() {
  const input = document.getElementById('setup-anthropic-key');
  const btn = document.getElementById('setup-btn-2');
  const errEl = document.getElementById('setup-error-2');
  const key = input?.value?.trim();

  if (!key) {
    _finishSetup();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: key }),
    });
    const data = await res.json();
    if (data.success) {
      _serverStatus = data;
    }
    _finishSetup();
  } catch (e) {
    errEl.textContent = 'Could not save. Please try again.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

async function _finishSetup() {
  if (_setupOverlay) {
    _setupOverlay.remove();
    _setupOverlay = null;
  }
  await loadCollection();
  navigateTo('home');
}
