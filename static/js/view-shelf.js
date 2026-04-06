// ─────────────────────────────────────────────────────────────────
//  SHELF VIEW — vinyl spines with 3D reveal on hover
// ─────────────────────────────────────────────────────────────────

function _coverUrl(r) {
  return r.local_cover ? `/covers/${r.local_cover}` : (r.cover_image_url || '');
}

function _renderShelf(container, items) {
  const viewH = window.innerHeight;
  const headerH = 110;
  const availH = viewH - headerH;
  const pad = 16;

  const containerW = container.parentElement?.clientWidth || window.innerWidth - 48;
  const usableW = containerW - pad * 2;
  const spineW = 3;
  const perRow = Math.max(1, Math.floor(usableW / spineW));
  const rows = Math.ceil(items.length / perRow);
  const coverH = Math.min(availH, Math.max(40, Math.floor((availH - (rows - 1) * 4) / rows)));
  const expandW = coverH;

  const shelfEl = document.createElement('div');
  shelfEl.className = 'shelf-container';
  shelfEl.style.cssText = `display:flex;flex-direction:column;gap:4px;padding:0 ${pad}px;`;

  for (let row = 0; row < rows; row++) {
    const start = row * perRow;
    const rowItems = items.slice(start, start + perRow);

    const rowEl = document.createElement('div');
    rowEl.className = 'shelf-row';
    rowEl.style.cssText = `display:flex;height:${coverH}px;position:relative;overflow:visible;`;

    const ANIM = '0.35s cubic-bezier(0.4,0,0.2,1)';
    let activeReveal = null;
    let activeIdx = -1;
    let closeTimer = null;
    const spines = [];

    function closeReveal(animate) {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      if (!activeReveal) return;
      if (animate) {
        activeReveal.style.transform = 'perspective(800px) rotateY(90deg)';
        const rev = activeReveal;
        closeTimer = setTimeout(() => { rev.remove(); closeTimer = null; }, 400);
      } else {
        activeReveal.remove();
      }
      activeReveal = null;
      activeIdx = -1;
      spines.forEach(s => { s.style.transform = ''; });
    }

    function openReveal(r, i, spine) {
      if (activeIdx === i) return;
      closeReveal(false);

      const coverSrc = _coverUrl(r);
      const reveal = document.createElement('div');
      reveal.className = 'shelf-reveal';
      const rect = spine.getBoundingClientRect();
      const rowRect = rowEl.getBoundingClientRect();
      const centerX = rect.left - rowRect.left + spineW / 2;
      reveal.style.cssText = `
        position:absolute;top:0;
        left:${centerX - expandW / 2}px;
        width:${expandW}px;height:${coverH}px;
        z-index:20;cursor:pointer;
        border-radius:4px;overflow:hidden;
        transform:perspective(800px) rotateY(90deg);transform-origin:center;
        transition:transform ${ANIM};
        box-shadow:0 8px 32px rgba(0,0,0,0.6);
      `;
      reveal.innerHTML = coverSrc
        ? `<img src="${esc(coverSrc)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`
        : `<div style="width:100%;height:100%;background:#2a2a2a;display:flex;align-items:center;justify-content:center;"><i class="bi bi-vinyl" style="color:#4e453c;font-size:${Math.max(12, coverH * 0.1)}px;"></i></div>`;

      reveal.addEventListener('click', () => showDetail(r.id));
      reveal.addEventListener('mouseleave', (e) => {
        if (e.relatedTarget?.closest?.('.shelf-spine')) return;
        closeReveal(true);
      });

      rowEl.appendChild(reveal);
      activeReveal = reveal;
      activeIdx = i;

      // Double rAF ensures browser paints the 90deg state before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { reveal.style.transform = 'perspective(800px) rotateY(0deg)'; });
      });

      const push = expandW * 0.25;
      spines.forEach((s, si) => {
        if (si < i) s.style.transform = `translateX(-${push}px)`;
        else if (si > i) s.style.transform = `translateX(${push}px)`;
        else s.style.transform = '';
      });
    }

    rowItems.forEach((r, i) => {
      const coverSrc = _coverUrl(r);
      const spine = document.createElement('div');
      spine.className = 'shelf-spine';
      spine.style.cssText = `width:${spineW}px;height:${coverH}px;flex-shrink:0;overflow:hidden;cursor:pointer;border-radius:1px;transition:transform ${ANIM};`;
      spine.innerHTML = coverSrc
        ? `<img src="${esc(coverSrc)}" style="width:${expandW}px;height:${coverH}px;object-fit:cover;pointer-events:none;" loading="lazy">`
        : `<div style="width:${expandW}px;height:${coverH}px;background:#2a2a2a;"></div>`;

      spine.addEventListener('click', () => showDetail(r.id));
      spine.addEventListener('mouseenter', () => openReveal(r, i, spine));
      spine.addEventListener('mouseleave', (e) => {
        if (e.relatedTarget?.closest?.('.shelf-reveal')) return;
        if (e.relatedTarget?.closest?.('.shelf-spine')) return;
        closeReveal(true);
      });

      spines.push(spine);
      rowEl.appendChild(spine);
    });

    shelfEl.appendChild(rowEl);
  }

  container.appendChild(shelfEl);
}
