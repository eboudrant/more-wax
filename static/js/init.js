// ─────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────

/** Check backend status and show an error banner if Discogs token is missing or invalid. */
async function _checkStatus() {
  try {
    const status = _serverStatus = await apiGet('/api/status');
    if (!status.discogs_token_set) {
      _showSetupError(
        'Discogs token not configured',
        'Set <code>DISCOGS_TOKEN</code> in your <code>.env</code> file or run <code>./setup.sh</code> to get started.',
        'https://www.discogs.com/settings/developers'
      );
    } else if (!status.discogs_connected) {
      _showSetupError(
        'Discogs token is invalid',
        'The server could not authenticate with Discogs. Check that your <code>DISCOGS_TOKEN</code> is correct.',
        'https://www.discogs.com/settings/developers'
      );
    }
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
  _checkStatus();           // non-blocking — don't await
  await loadCollection();

  // Navigate to initial view from hash
  navigateTo(_getViewFromHash());
});
