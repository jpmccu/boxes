/**
 * Guided tour for the Boxes graph editor.
 *
 * Uses TourGuide.js (https://tourguidejs.com/) loaded on-demand from CDN.
 * The tour covers:
 *   canvas interaction → palette → drawing edges → properties →
 *   undo/redo → stylesheet → palette editing → context →
 *   layout → import/export → save & files → templates
 */

const TOUR_CDN_ESM   = 'https://cdn.jsdelivr.net/npm/@sjmc11/tourguidejs/+esm';
const TOUR_DONE_KEY  = 'boxes-tour-v2-done';

/** True if the user has already completed or dismissed the tour. */
export function isTourDone() {
  return !!localStorage.getItem(TOUR_DONE_KEY);
}

/** Mark the tour as finished so it doesn't auto-start again. */
export function markTourDone() {
  localStorage.setItem(TOUR_DONE_KEY, '1');
}

/**
 * Start the guided tour.
 *
 * The tour is loaded from CDN on first call (lightweight dynamic import).
 * All step targets are CSS selectors resolved at display time, so the editor
 * DOM must already be present when each step is shown.
 */
export async function startTour() {
  const { default: tourguide } = await import(TOUR_CDN_ESM);
  const tg = new tourguide.TourGuideClient({
    steps: [
      // ── 1. Welcome ─────────────────────────────────────────────────────────
      {
        title: 'Welcome to Boxes! 👋',
        content: `<p>Boxes is a <strong>Labeled Property Graph</strong> editor built on Cytoscape.js. You can model anything from OWL ontologies and knowledge graphs to simple diagrams.</p>
                  <p>This tour covers all the major features. Click <strong>Next →</strong> to begin.</p>`,
        order: 1,
      },

      // ── 2. Canvas ──────────────────────────────────────────────────────────
      {
        title: 'The Canvas',
        content: `<ul style="padding-left:1.2em;margin:0">
                    <li><strong>Pan</strong> — drag the background</li>
                    <li><strong>Zoom</strong> — scroll wheel (or pinch on trackpad)</li>
                    <li><strong>Fit view</strong> — press <kbd>F</kbd> to fit all nodes on screen</li>
                    <li><strong>Place a node</strong> — double-click empty space while a node type is active in the Palette</li>
                    <li><strong>Select</strong> — click a node or edge; hold <kbd>Shift</kbd> and drag to box-select multiple</li>
                    <li><strong>Move</strong> — drag any selected node(s)</li>
                    <li><strong>Delete</strong> — select then press <kbd>Delete</kbd> or <kbd>Backspace</kbd></li>
                  </ul>`,
        order: 2,
      },

      // ── 3. Palette ─────────────────────────────────────────────────────────
      {
        title: 'Palette — Node & Edge Types',
        content: `<p>The <strong>Palette (✦)</strong> tab shows the node types and edge types defined for this graph.</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li>Click a <strong>node type</strong> to make it active, then <strong>double-click</strong> the canvas to place a node of that type</li>
                    <li>Click an <strong>edge type</strong> to make it active, then drag from a node's blue handle to another node to draw an edge</li>
                    <li>The active type is highlighted; press <kbd>Esc</kbd> to deactivate</li>
                  </ul>`,
        target: '.bxe-tab-btn[data-tab="palette"]',
        order: 3,
      },

      // ── 4. Drawing edges ───────────────────────────────────────────────────
      {
        title: 'Drawing Edges',
        content: `<p>To connect two nodes:</p>
                  <ol style="padding-left:1.2em;margin:0">
                    <li>Select an <strong>edge type</strong> in the Palette</li>
                    <li><strong>Hover</strong> over the source node — a blue ● handle appears</li>
                    <li><strong>Drag</strong> from the handle to the target node and release</li>
                  </ol>
                  <p style="margin-top:6px">💡 You can draw edges between any two nodes regardless of their types — the edge type determines the label and default style.</p>`,
        order: 4,
      },

      // ── 5. Properties ──────────────────────────────────────────────────────
      {
        title: 'Properties — Edit Elements',
        content: `<p>Select a node or edge on the canvas, then switch to the <strong>Properties (☰)</strong> tab to edit it:</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li>Display <strong>label</strong> — shown on the canvas</li>
                    <li><strong>@id</strong> — unique identifier (used as the IRI for RDF export)</li>
                    <li>Any additional data fields defined by the palette type's default data</li>
                  </ul>
                  <p style="margin-top:6px">All edits are live — the canvas updates as you type.</p>`,
        target: '.bxe-tab-btn[data-tab="properties"]',
        order: 5,
      },

      // ── 6. Undo / Redo ─────────────────────────────────────────────────────
      {
        title: 'Undo & Redo',
        content: `<p>Every graph change is tracked in a 50-step undo history.</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li>Press <kbd>Ctrl+Z</kbd> / <kbd>⌘Z</kbd> to <strong>undo</strong></li>
                    <li>Press <kbd>Ctrl+Y</kbd> / <kbd>⌘Y</kbd> to <strong>redo</strong></li>
                    <li>The <strong>↩</strong> and <strong>↪</strong> buttons at the top of the sidebar do the same thing</li>
                  </ul>`,
        target: '.bxe-toolbar',
        order: 6,
      },

      // ── 7. Stylesheet ──────────────────────────────────────────────────────
      {
        title: 'Stylesheet — Visual Styling',
        content: `<p>The <strong>Stylesheet (✏)</strong> tab contains the CSS rules that control how nodes and edges are rendered.</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li>Rules use <strong>Cytoscape.js selectors</strong> — e.g. <code>node</code>, <code>edge</code>, <code>node[label="Person"]</code>, or <code>.highlighted</code></li>
                    <li>Edit selector or property values inline; changes apply instantly</li>
                    <li>Add a new rule by typing into the blank selector field at the bottom</li>
                    <li>Delete a rule with the 🗑 button; delete a property with the × button</li>
                  </ul>
                  <p style="margin-top:6px">The stylesheet is saved with the file and restored on load.</p>`,
        target: '.bxe-tab-btn[data-tab="stylesheet"]',
        order: 7,
      },

      // ── 8. Palette editing ─────────────────────────────────────────────────
      {
        title: 'Editing the Palette',
        content: `<p>The palette is fully editable — you can customise it to match your domain:</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li><strong>Hover</strong> over any palette item to reveal <strong>✎</strong> (edit) and <strong>×</strong> (delete) buttons</li>
                    <li>Click <strong>+ Add node type</strong> or <strong>+ Add edge type</strong> at the bottom of each section</li>
                    <li>Set the label, colour, shape (nodes) or line style (edges), and optional default data</li>
                  </ul>
                  <p style="margin-top:6px">The palette is saved with the file — so <strong>Save</strong> your work and share the <code>.boxes</code> file as a reusable template.</p>`,
        target: '.bxe-tab-btn[data-tab="palette"]',
        order: 8,
      },

      // ── 9. Context ─────────────────────────────────────────────────────────
      {
        title: 'Context — Namespace Prefixes',
        content: `<p>The <strong>Context (@)</strong> tab manages JSON-LD namespace prefixes used during RDF import and export.</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li>Prefixes like <code>owl:</code>, <code>rdfs:</code>, and <code>skos:</code> are pre-populated in the OWL template</li>
                    <li>Long IRIs are compressed on export — e.g. <code>http://www.w3.org/2002/07/owl#Class</code> → <code>owl:Class</code></li>
                    <li>Add custom prefixes for your own namespaces</li>
                  </ul>
                  <p style="margin-top:6px">💡 Only relevant for graphs that use IRI-based identifiers.</p>`,
        target: '.bxe-tab-btn[data-tab="context"]',
        order: 9,
      },

      // ── 10. Layout ─────────────────────────────────────────────────────────
      {
        title: 'Layout — Auto-Arrange Nodes',
        content: `<p>The <strong>Layout (⊕)</strong> tab automatically positions your nodes using graph layout algorithms:</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li><em>Dagre</em> — top-down directed hierarchy; great for class trees</li>
                    <li><em>Cola</em> — physics-based; handles complex, interconnected graphs</li>
                    <li><em>KLay</em> — hierarchical with neat edge routing</li>
                    <li><em>Concentric / Grid / Circle</em> — geometric arrangements</li>
                    <li><em>Random</em> — quick starting point before switching to another algorithm</li>
                  </ul>
                  <p style="margin-top:6px">💡 Select a subset of nodes first to lay out only those, leaving the rest untouched.</p>`,
        target: '.bxe-tab-btn[data-tab="layout"]',
        order: 10,
      },

      // ── 11. Import & Export ────────────────────────────────────────────────
      {
        title: 'Import & Export',
        content: `<p>Boxes can exchange data with other tools via the <strong>Import</strong> and <strong>Export</strong> menus in the toolbar.</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li><strong>Import → RDF / Turtle</strong> — load an existing Turtle or Trig file; nodes and edges are created from RDF triples</li>
                    <li><strong>Import → JSON-LD / RDF/XML</strong> — other RDF serialisations</li>
                    <li><strong>Export → RDF / Turtle</strong> — Turtle ready for Protégé, SPARQL endpoints, or any RDF toolchain</li>
                    <li><strong>Export → JSON-LD / RDF/XML</strong> — alternative serialisation formats</li>
                  </ul>
                  <p style="margin-top:6px">Importing merges into the current graph, preserving the existing stylesheet.</p>`,
        target: '#import-btn',
        order: 11,
      },

      // ── 12. Save, Open & Files ─────────────────────────────────────────────
      {
        title: 'Save, Open & File Format',
        content: `<p>Boxes uses <code>.boxes</code> files (JSON) as its native format. The file captures <em>everything</em>: nodes, edges, palette, stylesheet, layout, and namespace context.</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li><strong>Save</strong> — <kbd>Ctrl+S</kbd> / <kbd>⌘S</kbd> overwrites the current file (or prompts on first save)</li>
                    <li><strong>Save As</strong> — <kbd>Ctrl+Shift+S</kbd> / <kbd>⌘⇧S</kbd> saves to a new file</li>
                    <li><strong>Open</strong> — load any <code>.boxes</code> file; the palette and stylesheet are restored automatically</li>
                    <li><strong>New</strong> — returns to the template picker to start fresh</li>
                  </ul>`,
        target: '#save-btn',
        order: 12,
      },

      // ── 13. Templates ──────────────────────────────────────────────────────
      {
        title: 'Templates & Reuse',
        content: `<p>Any <code>.boxes</code> file can be used as a template — just <strong>Open</strong> it and the palette, stylesheet, and context come with it.</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li>Built-in templates (Blank, Arrows, Ontology) are on the <strong>welcome screen</strong></li>
                    <li>To create your own template: build your palette, add stylesheet rules, clear the elements, and <strong>Save As</strong> a new <code>.boxes</code> file</li>
                    <li>Share that file with teammates — opening it gives them your exact palette and styles</li>
                  </ul>
                  <p style="margin-top:6px">Click <strong>New</strong> in the toolbar to return to the template picker at any time.</p>`,
        target: '#new-btn',
        order: 13,
      },

      // ── 14. Done ───────────────────────────────────────────────────────────
      {
        title: "You're all set! 🎉",
        content: `<p>Here's a quick workflow to try right now:</p>
                  <ol style="padding-left:1.2em;margin:0">
                    <li>Place a few nodes from the <strong>Palette</strong></li>
                    <li>Connect them with edges</li>
                    <li>Edit labels in the <strong>Properties</strong> tab</li>
                    <li>Run the <strong>Dagre</strong> layout to tidy things up</li>
                    <li>Hit <kbd>Ctrl+S</kbd> to save your work</li>
                  </ol>
                  <p style="margin-top:6px">Click <strong>? Tour</strong> in the toolbar at any time to replay this guide.</p>`,
        order: 14,
      },
    ],

    // ── Behaviour ───────────────────────────────────────────────────────────
    exitOnClickOutside: false,   // require explicit close so users don't lose their place
    showStepDots:       true,
    showStepProgress:   true,
    completeOnFinish:   false,   // we track completion ourselves via localStorage
    debug:              false,
    dialogPlacement:    'bottom', // keep dialog below targets, away from screen edges

    // ── Appearance ──────────────────────────────────────────────────────────
    progressBar:   '#3498db',
    backdropColor: 'rgba(0,0,0,0.32)',
    dialogMaxWidth: 380,
    nextLabel:     'Next →',
    prevLabel:     '← Back',
    finishLabel:   'Done',
  });

  // Mark as done when user finishes or explicitly closes
  tg.onFinish(markTourDone);
  tg.onAfterExit(markTourDone);

  tg.start();
}
