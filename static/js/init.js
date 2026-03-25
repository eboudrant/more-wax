// ─────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────

/** Check backend status and show an error banner if Discogs token is missing or invalid. */
async function _checkStatus() {
  try {
    const status = _serverStatus = await apiGet('/api/status');
    if (!status.discogs_token_set) {
      showSetupWizard();
      return;
    }
    if (!status.discogs_connected) {
      showSetupWizard('Your Discogs token is no longer valid. Please enter a new one.');
      return;
    }
    if (status.anthropic_key_set && status.anthropic_key_valid === false) {
      showSetupWizard();
      // Skip to step 2 with error
      _setupError = '';
      _renderStep2('Your Anthropic API key is no longer valid.');
    }
    // Re-render status cards now that _serverStatus is populated
    if (typeof _renderStatus === 'function') _renderStatus();
  } catch {
    // Server unreachable — nothing useful to show
  }
}

/** Render a dismissible error banner at the top of the page. */
function _showSetupError(title, message, linkUrl) {
  const el = document.createElement('div');
  el.id = 'setup-error';
  el.style.cssText = `
    position:fixed; top:0; left:0; right:0; z-index:9999;
    padding:16px 20px; display:flex; align-items:center; gap:12px;
    background:#2a1215; border-bottom:1px solid #5c2b2e;
    color:#f5c6cb; font-size:0.9rem; line-height:1.4;
  `;
  el.innerHTML = `
    <span style="font-size:1.4rem">⚠️</span>
    <div style="flex:1">
      <strong style="color:#f8d7da">${title}</strong><br>
      ${message}
      ${linkUrl ? `<br><a href="${linkUrl}" target="_blank" rel="noopener" style="color:#d4a574;text-decoration:underline;font-size:.85rem">Get a Discogs token →</a>` : ''}
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#f5c6cb;font-size:1.2rem;cursor:pointer;padding:4px 8px">✕</button>
  `;
  document.body.prepend(el);
}

window.addEventListener('DOMContentLoaded', async () => {
  // Check auth first — if not authenticated, show login overlay and stop
  const authOk = await checkAuth();
  if (!authOk) return;

  _checkStatus();           // non-blocking — don't await
  _checkCamera();           // hide Add buttons if no camera
  await loadCollection();

  // Navigate to initial view from hash
  navigateTo(_getViewFromHash());
});

/** Hide Add buttons if no camera is available. */
async function _checkCamera() {
  // On touch devices, always show Add (camera is expected)
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
  // mediaDevices is unavailable in insecure contexts (HTTP non-localhost) —
  // camera won't work without HTTPS, so hide Add
  if (!navigator.mediaDevices) { _hideAddButtons(); return; }
  // On desktop, check for a webcam
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some(d => d.kind === 'videoinput');
    if (!hasCamera) _hideAddButtons();
  } catch {
    // Can't determine — keep buttons visible
  }
}

function _hideAddButtons() {
  // Desktop nav "Add"
  const desktopAdd = document.querySelector('nav.hidden.md\\:flex a[onclick*="openScanner"]');
  if (desktopAdd) desktopAdd.style.display = 'none';
  // Mobile bottom nav "Add"
  const mobileAdd = document.querySelector('#bottom-nav a[data-view="add"]');
  if (mobileAdd) mobileAdd.style.display = 'none';
}
