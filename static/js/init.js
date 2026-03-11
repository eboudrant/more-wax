// ─────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadCollection();

  // Stop camera whenever the add-modal is closed
  document.getElementById('add-modal').addEventListener('hidden.bs.modal', stopCamera);
});
