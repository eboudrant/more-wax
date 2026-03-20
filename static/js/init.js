// ─────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadCollection();

  // Navigate to initial view from hash
  navigateTo(_getViewFromHash());
});
