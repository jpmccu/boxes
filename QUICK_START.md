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

## Running the Electron App

```bash
npm run electron:dev
```

This opens the Boxes desktop application with:
- Welcome screen with template selection
- OWL Ontology, Arrows, and Blank templates
- File operations (New, Open, Save)
- Graph editing toolbar

## Running the Web Server

```bash
# Development mode (with hot reload)
npm run web:dev
```

Then open http://localhost:3001 in your browser.

**Features:**
- Same UI as Electron app, but runs in browser
- REST API for saving/loading graphs
- No desktop installation required
- Access from any device on your network

**Production mode:**

```bash
# Build and start
npm run build --workspace=packages/web
npm run web:start
```

Server will run on port 3001 (or PORT environment variable).

## Using in Your Project

### Core Library (Vanilla JS)

```bash
npm install boxes-core
```

```javascript
import { BoxesEditor } from 'boxes-core';

const editor = new BoxesEditor(document.getElementById('container'), {
  elements: { nodes: [], edges: [] }
});

editor.addNode({ id: 'n1', label: 'My Node' });
```

### Vue 3

```bash
npm install boxes-vue
```

```vue
<script setup>
import { BoxesEditor } from 'boxes-vue';
import { ref } from 'vue';

const editorRef = ref();
</script>

<template>
  <BoxesEditor ref="editorRef" />
</template>
```

### React

```bash
npm install boxes-react
```

```jsx
import { BoxesEditor } from 'boxes-react';

function MyComponent() {
  return <BoxesEditor />;
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

### Run a Layout

```javascript
editor.runLayout({ name: 'circle' });
// Available: grid, circle, concentric, breadthfirst, cose
```

### Export/Import

```javascript
// Export
const graphData = editor.exportGraph();
localStorage.setItem('myGraph', JSON.stringify(graphData));

// Import
const saved = JSON.parse(localStorage.getItem('myGraph'));
editor.importGraph(saved);
```

### Listen to Events

```javascript
editor.on('nodeAdded', (data) => {
  console.log('Node added:', data.node);
});

editor.on('selectionChange', (data) => {
  console.log('Selected:', data.selected);
});
```

## Troubleshooting

### Tests Fail with Canvas Errors

This is expected. Cytoscape.js requires full Canvas API support. The happy-dom test environment has limited Canvas support. Template tests should pass.

To run full integration tests, use a real browser environment (Playwright, Puppeteer, etc.).

### Electron Build Fails

The `npm run build` command builds the libraries but not Electron distributables. To create Electron distributables:

```bash
npm run build:dist --workspace=packages/electron
```

This requires proper build tools for your platform.

### Module Resolution Errors

Make sure you've built the core package first:

```bash
npm run build --workspace=packages/core
```

## Next Steps

- Read [.github/copilot-instructions.md](.github/copilot-instructions.md) for detailed architecture
- Explore templates in `packages/electron/templates/`
- Add custom styling in your Cytoscape.js stylesheet
- Build additional features on top of the core library

## Support

For issues and questions, refer to:
- Cytoscape.js documentation: https://js.cytoscape.org/
- This project's copilot-instructions.md for architecture details

## Web Server API

When running the web server, you can use the REST API:

### Endpoints

- `GET /api/health` - Server health check
- `GET /api/templates` - List available templates
- `POST /api/graphs` - Save a graph
  ```json
  { "name": "My Graph", "data": { ... } }
  ```
- `GET /api/graphs` - List saved graphs
- `GET /api/graphs/:id` - Load a specific graph
- `DELETE /api/graphs/:id` - Delete a graph

### Example Usage

```javascript
// Save a graph
const response = await fetch('http://localhost:3001/api/graphs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Graph',
    data: editor.exportGraph()
  })
});

// Load a graph
const graph = await fetch('http://localhost:3001/api/graphs/my-graph')
  .then(r => r.json());
editor.importGraph(graph.data);
```

**Note:** In production, replace in-memory storage with a database (MongoDB, PostgreSQL, etc.).
