# Boxes Quick Start Guide

## Installation

1. **Clone and Install**
   ```bash
   cd boxes
   npm install
   npm run build
   ```

2. **Verify Installation**
   ```bash
   ./test-installation.sh
   ```

## Running the Web Server

```bash
# Development mode
npm run web:dev
```

Then open http://localhost:3001 in your browser.

**Features:**
- Welcome screen with template selection (Ontology or RDF File, Arrows, Blank)
- Editable palette — build your own node/edge types and save them in the file
- File open/save via the browser's file picker
- No desktop installation required

**Production mode:**

```bash
npm run build --workspace=packages/web
npm run web:start
```

Server will run on port 3001 (or the PORT environment variable).

## Running with Docker

```bash
docker compose up
```

Open http://localhost:3001.

## Using in Your Project

### Core Library (Vanilla JS)

```bash
npm install boxes-core
```

**Start from scratch:**

```javascript
import { BoxesEditor } from 'boxes-core';

const editor = new BoxesEditor(document.getElementById('container'), {
  elements: { nodes: [], edges: [] }
});

editor.addNode({ id: 'n1', label: 'My Node' });
```

**Start from a template:**

```javascript
import { BoxesEditor, defaultTemplates, loadTemplateFromUrl } from 'boxes-core';

// Built-in template
const editor = new BoxesEditor(container, {
  template: defaultTemplates['arrows']
});

// Custom template from a .boxes file
const myTemplate = await loadTemplateFromUrl('/templates/domain-model.boxes');
const editor2 = new BoxesEditor(container, { template: myTemplate });
```

### Vue 3

```bash
npm install boxes-vue
```

```vue
<script setup>
import { BoxesEditor } from 'boxes-vue';
import { defaultTemplates } from 'boxes-core';
import { ref } from 'vue';

const editorRef = ref();
</script>

<template>
  <!-- Start from a template object -->
  <BoxesEditor ref="editorRef" :template="defaultTemplates['arrows']" />
</template>
```

### React

```bash
npm install boxes-react
```

```jsx
import { BoxesEditor } from 'boxes-react';
import { defaultTemplates } from 'boxes-core';

function MyComponent() {
  return <BoxesEditor template={defaultTemplates['arrows']} />;
}
```

## Working with Palettes

The palette tab in the right sidebar lists all node and edge types. Hover over an
item to see **✎** (edit) and **×** (delete) buttons. Use **+ Add node type** /
**+ Add edge type** to create new types.

Each node type has:
- **Label** — displayed in the palette and used as the default label for new nodes
- **ID** — unique identifier (used in saved files and programmatic API)
- **Color** — background fill colour
- **Border color** — border colour
- **Shape** — `rectangle`, `roundrectangle`, or `ellipse`
- **Data** — JSON object merged into every new node of this type (e.g. `{"@type":"owl:Class"}`)

Each edge type has:
- **Label**, **ID**, **Color**, **Line style** (solid / dashed / dotted)
- **Data** — JSON object merged into every new edge of this type

After editing the palette, save the file — the palette is stored in the `.boxes`
file and restored when you reopen it.

## The .boxes File Format

`.boxes` files are plain JSON and serve as both saved graphs and templates.
A minimal example:

```json
{
  "version": "1.0.0",
  "title": "My Graph",
  "palette": {
    "nodeTypes": [
      { "id": "person", "label": "Person", "color": "#4A90E2",
        "borderColor": "#2A6AB2", "shape": "ellipse", "data": {} }
    ],
    "edgeTypes": [
      { "id": "knows", "label": "knows", "color": "#E24A4A", "lineStyle": "solid" }
    ]
  },
  "elements": { "nodes": [], "edges": [] },
  "userStylesheet": [],
  "lastLayout": { "name": "preset" },
  "context": {}
}
```

## Common Tasks

### Add a Node with Custom Style

```javascript
editor.addNode(
  { id: 'n1', label: 'Person', '@type': 'owl:Class' },
  { 'background-color': '#FFE4B5', 'shape': 'round-rectangle' }
);
```

### Add an Edge

```javascript
editor.addEdge('n1', 'n2', { label: 'knows' });
```

### Add a Node Using a Palette Type

```javascript
editor.addNodeOfType('person', { x: 200, y: 250 });
```

### Manage Palette Types Programmatically

```javascript
// Add a type
editor.addNodeType({ id: 'company', label: 'Company',
  color: '#FFD700', borderColor: '#B8860B', shape: 'roundrectangle', data: {} });

// Update a type
editor.updateNodeType('company', { color: '#FFA500' });

// Remove a type
editor.removeNodeType('company');

// Same API for edge types
editor.addEdgeType({ id: 'employs', label: 'employs', color: '#888', lineStyle: 'dashed' });
```

### Run a Layout

```javascript
editor.runLayout({ name: 'circle' });
// Available: grid, circle, concentric, breadthfirst, cose, dagre, cola, ...
```

### Export/Import

```javascript
// Export (includes palette, stylesheet, context, elements)
const graphData = editor.exportGraph();
localStorage.setItem('myGraph', JSON.stringify(graphData));

// Import (restores palette, stylesheet, context, and elements)
const saved = JSON.parse(localStorage.getItem('myGraph'));
editor.importGraph(saved);
```

### Listen to Events

```javascript
editor.on('nodeAdded', (data) => {
  console.log('Node added:', data.node);
});

editor.on('paletteChanged', ({ nodeTypes, edgeTypes }) => {
  console.log('Palette updated:', nodeTypes.length, 'node types');
});

editor.on('selectionChange', (data) => {
  console.log('Selected:', data.selected);
});
```

## Troubleshooting

### Tests Fail with Canvas Errors

This is expected. Cytoscape.js requires full Canvas API support. The happy-dom test
environment has limited Canvas support. Most tests pass; rendering tests are best
run in a real browser environment (Playwright, Puppeteer, etc.).

### Module Resolution Errors

Make sure you've built the core package first:

```bash
npm run build --workspace=packages/core
```

## Next Steps

- Read [README.md](README.md) for full API documentation
- Browse built-in templates in `packages/core/src/templates/`
- Add custom styling in the Stylesheet tab in the sidebar
- Build additional features on top of the core library

## Support

- Cytoscape.js documentation: https://js.cytoscape.org/
- Architecture details: [.github/copilot-instructions.md](.github/copilot-instructions.md)
