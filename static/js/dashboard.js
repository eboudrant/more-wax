// ─────────────────────────────────────────────────────────────────
//  DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  if (!collection.length) return;

  // Total count
  const countEl = document.getElementById('dash-count');
  if (countEl) countEl.textContent = collection.length;

  // Total estimated value
  const total = collection.reduce((sum, r) => {
    const p = parseFloat(r.price_median);
    return sum + (isNaN(p) ? 0 : p);
  }, 0);
  const valueEl = document.getElementById('dash-value');
  if (valueEl) {
    valueEl.textContent = total > 0 ? `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  }

  // Recently added (last 8 by id desc)
  const recent = [...collection].sort((a, b) => b.id - a.id).slice(0, 8);
  const grid = document.getElementById('dash-recent');
  if (grid) {
    grid.innerHTML = recent.map(r => recordCardHtml(r)).join('');
  }
}
