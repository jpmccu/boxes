# Boxes

A self-contained, Cytoscape.js-based Labeled Property Graph (LPG) editor. Drop it into any container element and get a full graph editing experience — canvas, sidebar, palettes, properties panel, stylesheet editor, layout controls, and undo/redo — with no external UI dependencies.

## Features

- **Self-contained UI** — renders its own sidebar, tabs, palettes, and context menu inside whatever container you give it
- **Labeled Property Graph** editing — nodes and edges have labels, typed properties, and CSS styles
- **Per-element CSS styling** stored as graph data, auto-applied via dynamic Cytoscape stylesheets
- **Edge handles** for drawing edges by hovering over a node
- **Layout algorithms** — built-in support for cose, dagre, cola, grid, circle, concentric, breadthfirst, and any other registered Cytoscape layout
- **Undo / redo** with 50-level history
- **Cut / copy / paste** with cascading paste offsets
- **Multi-selection** with box-select; Delete/Backspace removes selected elements
- **Import / export** in Cytoscape.js JSON format
- **Node types** and **edge type palettes** — click a type to select it; double-click the canvas to add a node of the selected type; add, edit, and delete types directly in the palette pane
- **Palette saved with each file** — the `.boxes` file format embeds the full palette, so any saved graph can be reused as a template
- **Template system** — built-in templates (Blank, Arrows, Ontology or RDF File) are JSON files; custom templates are ordinary `.boxes` files
- **Keyboard shortcuts** — Ctrl+Z/Y (undo/redo), Ctrl+C/X/V (copy/cut/paste), Delete/Backspace
- **Context menu** with Edit Properties, Cut, Copy, Paste, Duplicate, Delete
- **Vue 3** and **React 18** thin-wrapper components
- **Docker** support for the web demonstrator

## Packages

| Package | Description |
|---|---|
| `boxes-core` | Core editor library — use this in any JS project |
| `boxes-vue` | Vue 3 component wrapper |
| `boxes-react` | React 18 component wrapper |
| `boxes-web` | Express web server running the live demonstrator |
| `boxes-electron` | Standalone desktop app |

---

## Running with Docker

The fastest way to try Boxes:

```bash
docker compose up
```

Then open **http://localhost:3001** in your browser.

To rebuild after source changes:

```bash
docker compose up --build
```

---

## Running locally

```bash
npm install
npm run build            # build all packages
npm run web:dev          # start the web demo server on :3001
```

---

## Using the Core Library (plain JavaScript)

Install the package:

```bash
npm install boxes-core
```

### Basic setup

```js
import { BoxesEditor } from 'boxes-core';

const editor = new BoxesEditor(document.getElementById('graph'), {
  elements: {
    nodes: [
      { data: { id: 'n1', label: 'Alice' }, position: { x: 100, y: 150 } },
      { data: { id: 'n2', label: 'Bob' },   position: { x: 300, y: 150 } }
    ],
    edges: [
      { data: { id: 'e1', source: 'n1', target: 'n2', label: 'knows' } }
    ]
  }
});
```

The container must have an explicit width and height (e.g. `width: 100vw; height: 100vh`). BoxesEditor fills it completely with the canvas on the left and a collapsible sidebar on the right.

### Constructor options

```js
new BoxesEditor(container, {
  // ── Option A: start from a template or saved file ─────────────────────
  // Pass a pre-loaded template / .boxes JSON object.  All fields below are
  // extracted from it; any explicit option listed under Option B overrides
  // the corresponding template field.
  template: loadedTemplateObject,

  // ── Option B: explicit fields (can be combined with template) ─────────

  // Initial graph elements in Cytoscape.js JSON format
  elements: { nodes: [], edges: [] },

  // Initial stylesheet rules (Cytoscape.js selector/style pairs)
  style: [
    { selector: 'node[type="person"]', style: { 'background-color': '#4A90E2' } }
  ],

  // Initial Cytoscape layout (applied when no positions are present)
  layout: { name: 'cose' },

  // Node type palette entries
  nodeTypes: [
    {
      id: 'person',
      label: 'Person',
      color: '#4A90E2',      // fill colour shown in palette and applied to new nodes
      borderColor: '#2A6AB2',
      shape: 'ellipse',      // Cytoscape node shape
      data: {}               // extra data merged into each new node of this type
    }
  ],

  // Edge type palette entries
  edgeTypes: [
    {
      id: 'knows',
      label: 'knows',
      color: '#E24A4A',      // line/arrow colour shown in palette
      lineStyle: 'solid'     // 'solid' | 'dashed' | 'dotted'
    }
  ],

  // Document title and description (saved with the file)
  title: 'My Graph',
  description: 'An example graph',

  // Set false to disable the edge-handle magnet (useful for read-only views)
  edgeHandle: true
})
```

### Palette management

```js
// Query
editor.getNodeTypes();    // returns array of node type objects
editor.getEdgeTypes();    // returns array of edge type objects

// Add
editor.addNodeType({ id: 'company', label: 'Company', color: '#FFD700', borderColor: '#B8860B', shape: 'roundrectangle', data: {} });
editor.addEdgeType({ id: 'employs', label: 'employs', color: '#888', lineStyle: 'dashed' });

// Update (by id)
editor.updateNodeType('company', { color: '#FFA500' });
editor.updateEdgeType('employs', { lineStyle: 'solid' });

// Remove
editor.removeNodeType('company');
editor.removeEdgeType('employs');
```

All palette mutations re-render the palette and fire a `paletteChanged` event.

> **Tip — building templates from the UI:** Switch to the Palette tab in the sidebar. Hover over any palette item to reveal ✎ (edit) and × (delete) buttons. Use **+ Add node type** / **+ Add edge type** at the bottom of each section to add new types. Once the palette is set up the way you want, save the file — the palette is stored in the `.boxes` file and will be restored when the file is reopened.



```js
// Add a node (returns the new node's JSON)
editor.addNode(
  { label: 'Carol', type: 'person' },   // data
  { x: 200, y: 250 }                    // position (optional)
);

// Add a node of a palette type
editor.addNodeOfType('person', { x: 200, y: 250 });

// Add an edge
editor.addEdge('n1', 'n2', { label: 'likes' });

// Remove by ID
editor.removeElement('n1');

// Remove all currently selected elements
editor.removeSelected();

// Update data / style
editor.updateElement('n1', { label: 'Alice (updated)' });
editor.updateElementStyle('n1', { 'background-color': '#ff0000' });

// Replace all elements
editor.loadElements({
  nodes: [{ data: { id: 'a', label: 'A' } }],
  edges: []
});

// Get current elements
const { nodes, edges } = editor.getElements();
```

### Save & load

```js
// Full serialisable snapshot (elements + palette + stylesheet + layout + context)
const snapshot = editor.exportGraph();
localStorage.setItem('graph', JSON.stringify(snapshot));

// Restore (palette, stylesheet, title, and description are all restored)
const saved = JSON.parse(localStorage.getItem('graph'));
editor.importGraph(saved);
```

### Using a `.boxes` file as a template

Any saved `.boxes` file can be loaded as a starting template — it already carries the full palette, stylesheet, and context:

```js
import { defaultTemplates, loadTemplateFromUrl } from 'boxes-core';

// Built-in templates (blank, arrows, owl-ontology)
const editor = new BoxesEditor(container, { template: defaultTemplates['arrows'] });

// Load a custom template JSON from a URL
const myTemplate = await loadTemplateFromUrl('/templates/my-domain.boxes');
const editor2 = new BoxesEditor(container, { template: myTemplate });
```

The template format is identical to the `exportGraph()` snapshot — there is no separate template format. A `.boxes` file *is* a template.

### Layouts

```js
// List what's registered
const layouts = editor.getAvailableLayouts();
// e.g. ['cose', 'dagre', 'cola', 'grid', 'circle', 'concentric', 'breadthfirst', 'preset', 'random', 'null']

// Run a layout
editor.runLayout({ name: 'dagre', rankDir: 'TB' });
editor.runLayout({ name: 'cose', animate: true });
```

### Undo / redo

```js
editor.undo();            // returns true if something was undone
editor.redo();
editor.canUndo();         // boolean
editor.canRedo();
```

### Cut / copy / paste

```js
// Copy selected nodes (+ edges between them)
editor.copy();

// Cut (copy then delete)
editor.cut();

// Paste with a 20px cascade offset per call
editor.paste();

editor.canPaste();        // boolean — true when clipboard is non-empty
```

### Stylesheet

```js
// Get/set the full user stylesheet
const rules = editor.getStylesheet();
editor.setStylesheet([
  { selector: 'node', style: { 'background-color': '#888' } }
]);

// CRUD individual rules
editor.addStyleRule({ selector: '.highlight', style: { 'border-width': 4 } });
editor.updateStyleRule(0, 'node', { 'background-color': '#333' });
editor.removeStyleRule(0);
```

### Selection

```js
editor.getSelected();                   // array of Cytoscape element objects
editor.selectElements(['n1', 'n2']);    // select by ID
```

### Raw Cytoscape instance

```js
const cy = editor.getCytoscape();
// Full access to Cytoscape.js API
cy.fit();
cy.zoom(1.5);
```

### Events

```js
editor.on('nodeAdded',    ({ node })    => console.log('added', node));
editor.on('edgeAdded',    ({ edge })    => console.log('added', edge));
editor.on('elementRemoved', ({ element }) => console.log('removed', element));
editor.on('select',       ({ target }) => console.log('selected', target.id()));
editor.on('historyChange',({ canUndo, canRedo }) => updateButtons(canUndo, canRedo));
editor.on('clipboardChange', ({ hasClipboard }) => updatePasteButton(hasClipboard));

editor.off('nodeAdded', handler);  // remove a specific handler
```

| Event | Payload |
|---|---|
| `change` | `{ type, target }` — any graph mutation |
| `select` / `unselect` | `{ target }` |
| `selectionChange` | `{ type, target, selected[] }` |
| `nodeAdded` | `{ node }` (JSON) |
| `edgeAdded` | `{ edge }` (JSON) |
| `elementRemoved` | `{ element }` (JSON) |
| `elementUpdated` | `{ element }` (JSON) |
| `styleUpdated` | `{ stylesheet }` |
| `layoutRun` | `{ name, options }` |
| `elementsLoaded` | `{ elements }` |
| `graphImported` | `{ graphData }` |
| `paletteChanged` | `{ nodeTypes, edgeTypes }` |
| `edgeHandleComplete` | `{ sourceId, targetId, edgeType }` |
| `historyChange` | `{ canUndo, canRedo }` |
| `clipboardChange` | `{ hasClipboard }` |
| `paste` | `{ nodes, edges }` |

### Cleanup

```js
editor.destroy();   // removes DOM, event listeners, and the Cytoscape instance
```

---

## Using the Vue 3 Component

Install:

```bash
npm install boxes-vue boxes-core
```

### Basic usage

```vue
<template>
  <BoxesEditor
    :elements="elements"
    :node-types="nodeTypes"
    :edge-types="edgeTypes"
    style="width: 100%; height: 100vh"
    @node-added="onNodeAdded"
    @history-change="onHistoryChange"
  />
</template>

<script setup>
import { ref } from 'vue';
import { BoxesEditor } from 'boxes-vue';

const elements = ref({
  nodes: [
    { data: { id: 'n1', label: 'Alice' }, position: { x: 100, y: 150 } },
    { data: { id: 'n2', label: 'Bob' },   position: { x: 300, y: 150 } }
  ],
  edges: [
    { data: { id: 'e1', source: 'n1', target: 'n2', label: 'knows' } }
  ]
});

const nodeTypes = [
  { id: 'person', label: 'Person', color: '#4A90E2', shape: 'ellipse' }
];

const edgeTypes = [
  { id: 'knows', label: 'knows', color: '#E24A4A', lineStyle: 'solid' }
];

function onNodeAdded({ node }) {
  console.log('node added:', node);
}

function onHistoryChange({ canUndo, canRedo }) {
  console.log('undo:', canUndo, 'redo:', canRedo);
}
</script>
```

### Imperative API via template ref

```vue
<template>
  <button @click="saveGraph">Save</button>
  <button @click="loadGraph">Load</button>
  <BoxesEditor ref="editorRef" :elements="elements" style="height: 80vh" />
</template>

<script setup>
import { ref } from 'vue';
import { BoxesEditor } from 'boxes-vue';

const editorRef = ref(null);
const elements = ref({ nodes: [], edges: [] });

function saveGraph() {
  const data = editorRef.value?.exportGraph();
  localStorage.setItem('graph', JSON.stringify(data));
}

function loadGraph() {
  const saved = JSON.parse(localStorage.getItem('graph') || 'null');
  if (saved) editorRef.value?.importGraph(saved);
}
</script>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `template` | `Object` | — | Pre-loaded template / `.boxes` JSON; individual props below take precedence |
| `elements` | `Object` | `{ nodes:[], edges:[] }` | Initial graph elements |
| `style` | `Array` | `[]` | Stylesheet rules |
| `layout` | `Object` | `{ name: 'preset' }` | Layout config |
| `nodeTypes` | `Array` | `[]` | Node palette types |
| `edgeTypes` | `Array` | `[]` | Edge palette types |

> **Watching elements:** The component watches `elements` for changes and calls `loadElements` automatically. This replaces the entire graph, so prefer using the ref API (`addNode`, `addEdge`) for incremental updates.

### Events

The Vue component forwards all core events as kebab-case Vue events: `@node-added`, `@edge-added`, `@element-removed`, `@history-change`, `@clipboard-change`, etc. See the event table in the core section for the full list.

### Exposed ref methods

All methods from the core API are available via the template ref: `addNode`, `addEdge`, `removeElement`, `removeSelected`, `updateElement`, `runLayout`, `exportGraph`, `importGraph`, `undo`, `redo`, `copy`, `cut`, `paste`, `getStylesheet`, `setStylesheet`, `getCytoscape`, `getNodeTypes`, `getEdgeTypes`, `addNodeType`, `updateNodeType`, `removeNodeType`, `addEdgeType`, `updateEdgeType`, `removeEdgeType`, and more.

---

## Using the React Component

Install:

```bash
npm install boxes-react boxes-core
```

### Basic usage

```jsx
import { BoxesEditor } from 'boxes-react';

export default function App() {
  const nodeTypes = [
    { id: 'person', label: 'Person', color: '#4A90E2', shape: 'ellipse' }
  ];
  const edgeTypes = [
    { id: 'knows', label: 'knows', color: '#E24A4A', lineStyle: 'solid' }
  ];

  return (
    <BoxesEditor
      elements={{
        nodes: [
          { data: { id: 'n1', label: 'Alice' }, position: { x: 100, y: 150 } },
          { data: { id: 'n2', label: 'Bob' },   position: { x: 300, y: 150 } }
        ],
        edges: [
          { data: { id: 'e1', source: 'n1', target: 'n2', label: 'knows' } }
        ]
      }}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeAdded={({ node }) => console.log('added', node)}
      onHistoryChange={({ canUndo, canRedo }) => console.log(canUndo, canRedo)}
      style={{ width: '100%', height: '100vh' }}
    />
  );
}
```

### Imperative API via ref

```jsx
import { useRef } from 'react';
import { BoxesEditor } from 'boxes-react';

export default function App() {
  const editorRef = useRef(null);

  const handleSave = () => {
    const data = editorRef.current?.exportGraph();
    localStorage.setItem('graph', JSON.stringify(data));
  };

  const handleLoad = () => {
    const saved = JSON.parse(localStorage.getItem('graph') || 'null');
    if (saved) editorRef.current?.importGraph(saved);
  };

  const handleUndo = () => editorRef.current?.undo();
  const handleRedo = () => editorRef.current?.redo();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div>
        <button onClick={handleSave}>Save</button>
        <button onClick={handleLoad}>Load</button>
        <button onClick={handleUndo}>Undo</button>
        <button onClick={handleRedo}>Redo</button>
      </div>
      <BoxesEditor
        ref={editorRef}
        style={{ flex: 1 }}
        onEdgeHandleComplete={({ sourceId, targetId }) =>
          console.log(`Edge: ${sourceId} → ${targetId}`)
        }
      />
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `template` | `Object` | — | Pre-loaded template / `.boxes` JSON; individual props below take precedence |
| `elements` | `Object` | `{ nodes:[], edges:[] }` | Initial graph elements |
| `style` | `Array` | `[]` | Stylesheet rules |
| `layout` | `Object` | `{ name: 'preset' }` | Layout config |
| `nodeTypes` | `Array` | `[]` | Node palette types |
| `edgeTypes` | `Array` | `[]` | Edge palette types |
| `onChange` | `Function` | — | Called on any graph mutation |
| `onSelect` | `Function` | — | Called when an element is selected |
| `onUnselect` | `Function` | — | Called when an element is deselected |
| `onSelectionChange` | `Function` | — | Called on any selection change |
| `onNodeAdded` | `Function` | — | Called when a node is added |
| `onEdgeAdded` | `Function` | — | Called when an edge is added |
| `onElementRemoved` | `Function` | — | Called when an element is removed |
| `onElementUpdated` | `Function` | — | Called when element data/style changes |
| `onStyleUpdated` | `Function` | — | Called when the stylesheet changes |
| `onLayoutRun` | `Function` | — | Called after a layout runs |
| `onElementsLoaded` | `Function` | — | Called after `loadElements` |
| `onGraphImported` | `Function` | — | Called after `importGraph` |
| `onPaletteChanged` | `Function` | — | `{ nodeTypes, edgeTypes }` — called when palette is edited |
| `onEdgeHandleComplete` | `Function` | — | Called when a new edge is drawn |
| `onHistoryChange` | `Function` | — | `{ canUndo, canRedo }` |
| `onClipboardChange` | `Function` | — | `{ hasClipboard }` |

> **Note:** The editor initialises once on mount. Prop changes (other than `elements` / `layout` in the Vue wrapper) do not re-initialise the editor. Use the `ref` API to drive graph changes programmatically.

### Exposed ref methods

`addNode`, `addEdge`, `addNodeOfType`, `removeElement`, `removeSelected`, `updateElement`, `updateElementStyle`, `runLayout`, `getAvailableLayouts`, `getElements`, `loadElements`, `exportGraph`, `importGraph`, `getSelected`, `selectElements`, `getCytoscape`, `getNodeTypes`, `getEdgeTypes`, `addNodeType`, `updateNodeType`, `removeNodeType`, `addEdgeType`, `updateEdgeType`, `removeEdgeType`, `getEdgeType`, `setEdgeType`, `getStylesheet`, `setStylesheet`, `addStyleRule`, `updateStyleRule`, `removeStyleRule`, `undo`, `redo`, `canUndo`, `canRedo`, `copy`, `cut`, `paste`, `canPaste`.

---

## Data formats

### Elements JSON

```js
{
  nodes: [
    {
      data: {
        id: 'n1',          // required — must be unique
        label: 'Alice',    // displayed as the node label
        type: 'person',    // optional — used for palette-based styling
        _style: {          // optional — per-element CSS overrides
          'background-color': '#4A90E2',
          'width': '80px'
        }
        // ...any other application-specific properties
      },
      position: { x: 100, y: 150 }   // omit to let the layout place the node
    }
  ],
  edges: [
    {
      data: {
        id: 'e1',
        source: 'n1',      // required
        target: 'n2',      // required
        label: 'knows',
        _style: { 'line-color': '#E24A4A' }
      }
    }
  ]
}
```

### Exported graph snapshot

`exportGraph()` returns an object suitable for JSON serialisation and re-loading with `importGraph()`. This is also the `.boxes` file format and the template format — they are all the same thing.

```js
{
  version: '1.0.0',
  title: 'My Graph',                  // optional document title
  description: 'Description text',    // optional description
  palette: {
    nodeTypes: [                       // node type palette entries
      { id: 'person', label: 'Person', color: '#4A90E2', borderColor: '#2A6AB2',
        shape: 'ellipse', data: {} }
    ],
    edgeTypes: [                       // edge type palette entries
      { id: 'knows', label: 'knows', color: '#E24A4A', lineStyle: 'solid' }
    ]
  },
  elements: { nodes: [...], edges: [...] },  // full Cytoscape JSON
  userStylesheet: [{ selector, style }, ...],
  lastLayout: { name: 'dagre', options: { rankDir: 'TB' } },
  context: {}                          // namespace context (e.g. JSON-LD prefixes)
}
```

All fields are restored by `importGraph()`. Files saved by older versions of Boxes that contain a `templateId` field but no `palette` will fall back to the named built-in template for their palette.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Double-click canvas | Add node of selected type |
| Ctrl/⌘ + Z | Undo |
| Ctrl/⌘ + Y / Shift+Z | Redo |
| Ctrl/⌘ + C | Copy selected |
| Ctrl/⌘ + X | Cut selected |
| Ctrl/⌘ + V | Paste |
| Delete / Backspace | Remove selected elements |

---

## Development

### Project structure

```
boxes/
├── packages/
│   ├── core/           # Core editor — all UI and graph logic
│   ├── vue/            # Thin Vue 3 wrapper
│   ├── react/          # Thin React 18 wrapper
│   ├── web/            # Express server + browser demonstrator
│   └── electron/       # Desktop app
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### Build commands

```bash
npm install                                     # install all workspaces
npm run build                                   # build every package
npm run build --workspace=packages/core         # build one package
npm run dev --workspace=packages/core           # watch mode
```

### Testing

```bash
npm test                  # run all tests
npm run test:watch        # watch mode
```

> Tests that exercise Cytoscape rendering require a real browser (`canvas.getContext` is not available in happy-dom). Core graph-logic tests pass; rendering tests are best run in a headless Chromium via Playwright or similar.

### Linting

```bash
npm run lint
npm run lint:fix
```

---

## Architecture notes

- **Self-contained core** — `BoxesEditor` renders its entire UI (canvas + sidebar) into the container using `_injectCSS()` and `_createUI()`. Framework wrappers are single-`<div>` mount points.
- **Stylesheet strategy** — per-element styles are stored in `data._style`; `_generateElementStyles()` turns these into `node[id="n1"]` CSS rules and merges them with user stylesheet rules each time the graph changes.
- **Undo / redo** — each mutation calls `_pushUndo()` which serialises the full graph via `exportGraph()` (stripping transient edgehandles classes). History is capped at 50 entries.
- **Edge handles** — uses `cytoscape-edgehandles` with a custom DOM handle div positioned over the bottom of hovered nodes.
- **Layouts** — registered layouts are discovered at runtime by probing the Cytoscape extensions registry; the layout panel is built dynamically.
- **Template / palette system** — templates are plain JSON files stored in `packages/core/src/templates/` and bundled into the JS module. The `.boxes` file format *is* the template format: `exportGraph()` always writes `palette`, `title`, `description`, and `context`. `importGraph()` always restores them. The Vite build copies template JSON files to `dist/templates/` so they are also fetch-accessible at `/core/templates/*.json`.

## License

Apache 2.0

