// ─────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadCollection();

  // Navigate to initial view from hash
  navigateTo(_getViewFromHash());

  // Stop camera whenever the add-modal is closed
  document.getElementById('add-modal').addEventListener('modal:hidden', stopCamera);
});
