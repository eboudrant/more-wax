// ─────────────────────────────────────────────────────────────────
//  VIEW ROUTER
// ─────────────────────────────────────────────────────────────────
const VIEWS = ['dashboard', 'collection'];

function navigateTo(view) {
  if (!VIEWS.includes(view)) view = 'dashboard';
  currentView = view;

  // Show/hide view containers
  VIEWS.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === view) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });

  // Update hash without triggering hashchange
  if (location.hash !== `#${view}`) {
    history.replaceState(null, '', `#${view}`);
  }

  // Update bottom nav active state
  document.querySelectorAll('.bottom-nav-item').forEach(a => {
    if (a.dataset.view === view) a.classList.add('active');
    else a.classList.remove('active');
  });

  // Update top nav active state
  document.querySelectorAll('.nav-link-top').forEach(a => {
    if (a.dataset.view === view) a.classList.add('active');
    else a.classList.remove('active');
  });

  // Trigger view-specific rendering
  if (view === 'dashboard') renderDashboard();
  if (view === 'collection') renderCollection();
}

function _getViewFromHash() {
  const h = location.hash.replace('#', '');
  return VIEWS.includes(h) ? h : 'dashboard';
}

window.addEventListener('hashchange', () => {
  navigateTo(_getViewFromHash());
});
