// ─────────────────────────────────────────────────────────────────
//  DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  if (!collection.length) return;

  // Total count
  const countEl = document.getElementById('dash-count');
  if (countEl) countEl.textContent = collection.length;

  // Recently added (last 8 by id desc)
  const recent = [...collection].sort((a, b) => b.id - a.id).slice(0, 8);
  const grid = document.getElementById('dash-recent');
  if (grid) {
    grid.innerHTML = recent.map(r => recordCardHtml(r)).join('');
  }
}
