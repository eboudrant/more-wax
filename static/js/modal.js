// ─────────────────────────────────────────────────────────────────
//  CUSTOM MODAL SYSTEM (replaces Bootstrap Modal)
// ─────────────────────────────────────────────────────────────────
const AppModal = (() => {
  const _instances = {};   // id -> { el, backdrop, options, visible }
  let _scrollY = 0;

  function _getOrCreate(id) {
    if (_instances[id]) return _instances[id];
    const el = document.getElementById(id);
    if (!el) return null;
    const inst = { el, backdrop: null, visible: false, options: {} };
    _instances[id] = inst;
    return inst;
  }

  function show(id, options = {}) {
    const inst = _getOrCreate(id);
    if (!inst || inst.visible) return;
    inst.options = { staticBackdrop: false, ...options };
    inst.visible = true;

    // Create backdrop
    const bd = document.createElement('div');
    bd.className = 'app-modal-backdrop';
    if (!inst.options.staticBackdrop) {
      bd.addEventListener('click', () => hide(id));
    }
    document.body.appendChild(bd);
    inst.backdrop = bd;

    // Lock body scroll
    _scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_scrollY}px`;
    document.body.style.width = '100%';

    // Show modal
    inst.el.classList.add('app-modal-visible');
    requestAnimationFrame(() => {
      bd.classList.add('active');
      inst.el.classList.add('active');
    });

    // Escape key
    inst._escHandler = (e) => {
      if (e.key === 'Escape') hide(id);
    };
    document.addEventListener('keydown', inst._escHandler);

    // data-dismiss="modal" click delegation
    inst._dismissHandler = (e) => {
      const btn = e.target.closest('[data-dismiss="modal"]');
      if (btn) hide(id);
    };
    inst.el.addEventListener('click', inst._dismissHandler);
  }

  function hide(id) {
    const inst = _instances[id];
    if (!inst || !inst.visible) return;
    inst.visible = false;

    // Animate out
    inst.el.classList.remove('active');
    if (inst.backdrop) inst.backdrop.classList.remove('active');

    // Cleanup after transition
    setTimeout(() => {
      inst.el.classList.remove('app-modal-visible');
      if (inst.backdrop) {
        inst.backdrop.remove();
        inst.backdrop = null;
      }

      // Restore scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, _scrollY);

      // Remove listeners
      if (inst._escHandler) {
        document.removeEventListener('keydown', inst._escHandler);
        inst._escHandler = null;
      }
      if (inst._dismissHandler) {
        inst.el.removeEventListener('click', inst._dismissHandler);
        inst._dismissHandler = null;
      }

      // Dispatch hidden event
      inst.el.dispatchEvent(new CustomEvent('modal:hidden'));
    }, 250);
  }

  function getInstance(id) {
    const inst = _instances[id];
    if (!inst || !inst.visible) return null;
    return { hide: () => hide(id), el: inst.el, visible: inst.visible };
  }

  return { show, hide, getInstance };
})();
