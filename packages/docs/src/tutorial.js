/**
 * Tutorial page — BoxesEditor demo initialisation.
 *
 * Each element with class "demo-container" gets a live BoxesEditor instance
 * loaded from the .boxes file given in its data-graph attribute.
 * Instances are lazy-initialised via IntersectionObserver so the page stays
 * fast until a demo scrolls into view.
 *
 * data attributes on .demo-container:
 *   data-graph   required  Path to a .boxes file relative to the page
 *   data-tab     optional  Sidebar tab to activate (palette|properties|stylesheet|layout|context)
 *                          Defaults to 'palette'
 *   data-sidebar optional  '0' to hide the sidebar so the canvas fills the full container
 */

import { BoxesEditor } from 'boxes-core';

async function initDemo(el) {
  const graphUrl  = el.dataset.graph;
  const tabId     = el.dataset.tab     || 'palette';
  const sidebar   = el.dataset.sidebar !== '0';

  // Replace loading placeholder with the actual editor container.
  el.innerHTML = '';
  el.style.position = 'relative';

  const editor = new BoxesEditor(el, { layout: { name: 'preset' } });

  if (!sidebar) {
    const s = el.querySelector('.bxe-sidebar');
    if (s) s.style.display = 'none';
  } else {
    editor.setActiveTab?.(tabId);
  }

  if (graphUrl) {
    try {
      const res  = await fetch(graphUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      editor.importGraph(data);
      // Re-fit after two animation frames to ensure the container is sized.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        editor.cy?.fit(undefined, 40);
        if (sidebar) editor.setActiveTab?.(tabId);
      }));
    } catch (err) {
      el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;
        height:100%;color:#b91c1c;font-size:0.9rem;padding:20px;text-align:center">
        Could not load demo: ${err.message}</div>`;
    }
  }
}

// Lazy-init demos with a 200px pre-scroll margin so the editor is ready
// slightly before it enters the viewport.
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      initDemo(entry.target);
    }
  }
}, { rootMargin: '200px 0px' });

document.querySelectorAll('.demo-container').forEach(el => observer.observe(el));
