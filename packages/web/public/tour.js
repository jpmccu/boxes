/**
 * Guided tour for the Boxes graph editor.
 *
 * Uses TourGuide.js (https://tourguidejs.com/) loaded on-demand from CDN.
 * The tour walks the user through creating a simple OWL ontology:
 *   canvas interaction → palette → drawing edges → properties →
 *   context prefixes → layout → save & export
 */

const TOUR_CDN_ESM   = 'https://cdn.jsdelivr.net/npm/@sjmc11/tourguidejs/+esm';
const TOUR_DONE_KEY  = 'boxes-tour-v1-done';

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
      {
        title: 'Welcome to Boxes! 👋',
        content: `<p>This short tour will walk you through building a simple OWL ontology — placing classes, drawing relationships, and exporting to Turtle/RDF.</p>
                  <p>Click <strong>Next</strong> to begin.</p>`,
        order: 1,
      },
      {
        title: 'The Canvas',
        content: `<ul style="padding-left:1.2em;margin:0">
                    <li><strong>Pan</strong> — drag the background</li>
                    <li><strong>Zoom</strong> — scroll wheel</li>
                    <li><strong>Place a node</strong> — double-click empty space with a node type active in the Palette</li>
                    <li><strong>Select</strong> — click a node or edge; shift-drag box to multi-select</li>
                    <li><strong>Delete</strong> — select then press <kbd>Delete</kbd> or <kbd>Backspace</kbd></li>
                  </ul>`,
        order: 2,
      },
      {
        title: 'Palette — Node & Edge Types',
        content: `<p>The <strong>Palette (✦)</strong> tab lists the node types and edge types available for this template.</p>
                  <p>Click a type to make it <em>active</em>, then double click the canvas to place a node, or drag from a node's blue handle to draw an edge of that type.</p>
                  <p>For an OWL ontology, try selecting <em>owl:Class</em> and placing a few class nodes.</p>`,
        target: '.bxe-tab-btn[data-tab="palette"]',
        order: 3,
      },
      {
        title: 'Drawing Relationships',
        content: `<p>To draw an edge between two nodes:</p>
                  <ol style="padding-left:1.2em;margin:0">
                    <li>Select an <strong>edge type</strong> in the Palette (e.g. <em>rdfs:subClassOf</em>)</li>
                    <li><strong>Hover</strong> over the source node — a blue handle appears at the bottom of each node</li>
                    <li><strong>Drag</strong> the handle to the target node and release</li>
                  </ol>
                  <p style="margin-top:6px">The source node will be the <em>subclass</em> and the target the <em>superclass</em> for subClassOf links.</p>`,
        order: 4,
      },
      {
        title: 'Properties — Edit Elements',
        content: `<p>Click any node or edge on the canvas to select it, then open the <strong>Properties (☰)</strong> tab to edit:</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li>Display <strong>label</strong></li>
                    <li>IRI / <code>@id</code> (the full URI for this resource)</li>
                    <li>Template-specific data fields</li>
                  </ul>`,
        target: '.bxe-tab-btn[data-tab="properties"]',
        order: 5,
      },
      {
        title: 'Context — Namespace Prefixes',
        content: `<p>The <strong>Context (@)</strong> tab manages JSON-LD namespace prefixes for your ontology, such as <code>owl:</code>, <code>rdfs:</code>, and <code>skos:</code>.</p>
                  <p>These prefixes are used when exporting to Turtle/RDF — IRIs in your graph are compressed using them (e.g. <code>http://www.w3.org/2002/07/owl#Class</code> → <code>owl:Class</code>).</p>`,
        target: '.bxe-tab-btn[data-tab="context"]',
        order: 6,
      },
      {
        title: 'Layout — Auto-Arrange Nodes',
        content: `<p>The <strong>Layout (⊕)</strong> tab automatically positions your nodes. Useful algorithms for ontologies:</p>
                  <ul style="padding-left:1.2em;margin:0">
                    <li><em>Dagre</em> — clean top-down class hierarchy</li>
                    <li><em>Cola</em> — physics-based, good for complex graphs</li>
                    <li><em>KLay</em> — hierarchical with neat edge routing</li>
                  </ul>
                  <p style="margin-top:6px">💡 Select specific nodes first to lay out only those.</p>`,
        target: '.bxe-tab-btn[data-tab="layout"]',
        order: 7,
      },
      {
        title: 'Save & Export',
        content: `<p><strong>Save</strong> downloads your graph as a <code>.json</code> file you can reopen in Boxes at any time.</p>
                  <p><strong>Export → RDF / Turtle</strong> produces Turtle syntax ready for use in Protégé, SPARQL endpoints, or any RDF toolchain.</p>
                  <p>💡 Use <kbd>Ctrl+S</kbd> / <kbd>⌘S</kbd> to save quickly.</p>`,
        target: '#save-btn',
        order: 8,
      },
      {
        title: "You're all set! 🎉",
        content: `<p>Try it now:</p>
                  <ol style="padding-left:1.2em;margin:0">
                    <li>Place a few <em>owl:Class</em> nodes from the Palette</li>
                    <li>Name them in the Properties tab</li>
                    <li>Connect them with <em>rdfs:subClassOf</em> edges</li>
                    <li>Run the <em>Dagre</em> layout to tidy things up</li>
                    <li>Export as Turtle to share your ontology</li>
                  </ol>
                  <p style="margin-top:6px">Click <strong>Tour</strong> in the toolbar at any time to replay this guide.</p>`,
        order: 9,
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
