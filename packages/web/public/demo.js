/**
 * Embedded demo viewer for tutorial iframes.
 *
 * URL params:
 *   ?graph=<url>     Path to a .boxes file to load (required)
 *   ?tab=<id>        Which sidebar tab to show on load (palette|properties|stylesheet|layout|context)
 *                    Defaults to 'palette'
 *   ?sidebar=0       Hide the sidebar so the canvas fills 100% of the iframe
 */

import { BoxesEditor } from '/core/boxes-core.js';

const params  = new URLSearchParams(location.search);
const graphUrl = params.get('graph');
const tabParam  = params.get('tab') || 'palette';
const showSidebar = params.get('sidebar') !== '0';

const container = document.getElementById('demo-container');
const errorEl   = document.getElementById('demo-error');

if (!showSidebar) container.classList.add('no-sidebar');

// Create editor with a preset layout (positions come from the graph file).
const editor = new BoxesEditor(container, { layout: { name: 'preset' } });

// Activate the requested sidebar tab.
editor.setActiveTab?.(tabParam);

if (!graphUrl) {
  // No graph specified — just show empty editor.
} else {
  fetch(graphUrl)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      editor.importGraph(data);
      // Re-fit after a frame to ensure the container is fully sized.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (editor.cy) editor.cy.fit(undefined, 40);
          // Activate the tab after load too (importGraph may reset it).
          editor.setActiveTab?.(tabParam);
        });
      });
    })
    .catch(err => {
      errorEl.style.display = 'flex';
      errorEl.textContent = `Could not load demo graph: ${err.message}`;
    });
}
