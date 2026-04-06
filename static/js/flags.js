// ─────────────────────────────────────────────────────────────────
//  FEATURE FLAGS
//  Override via localStorage: localStorage.setItem('flag_<name>', 'true')
// ─────────────────────────────────────────────────────────────────
const _FLAG_DEFAULTS = {
  shelfView: false,
};

const FLAGS = Object.fromEntries(
  Object.entries(_FLAG_DEFAULTS).map(([key, defaultVal]) => {
    const override = localStorage.getItem('flag_' + key);
    return [key, override !== null ? override === 'true' : defaultVal];
  })
);
