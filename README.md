# Boxes

A Cytoscape.js-based Labeled Property Graph (LPG) editor with CSS styling capabilities.

## Features

- Visual graph editor powered by Cytoscape.js
- CSS-based node and edge styling
- Property editing for nodes and edges
- Multiple layout algorithms
- Import/export graphs in JSON format
- Framework wrappers for Vue 3 and React
- Standalone Electron desktop app

## Packages

- **@boxes/core** - Core library
- **@boxes/vue** - Vue 3 component
- **@boxes/react** - React component
- **@boxes/electron** - Desktop application
- **@boxes/web** - Web server (run via Node.js)

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build all packages
npm run build
```

### Using the Electron App

```bash
# Run in development mode
npm run electron:dev
```

The app will open with a welcome screen showing available templates:
- **OWL Ontology** - Styled for semantic web ontologies with owl:Class, owl:Ontology, etc.
- **Arrows** - Basic graph template similar to Arrows.app
- **Blank** - Empty graph with minimal styling

### Using the Web Server

Run Boxes as a web application accessible via browser:

```bash
# Start the API server
npm run web:dev

# In another terminal, start Vite dev server (during development)
cd packages/web
npm run dev
```

Then open http://localhost:3000 in your browser.

**Features:**
- Web-based graph editor with same UI as Electron app
- Save/Load graphs via REST API
- Template selection
- Export graphs to JSON
- No installation required - just run the server

**Production deployment:**

```bash
# Build the web app
npm run build --workspace=packages/web

# Start the production server (serves built files + API)
npm run web:start
```

### Using the Core Library

```javascript
import { BoxesEditor } from '@boxes/core';

const container = document.getElementById('graph-container');
const editor = new BoxesEditor(container, {
  elements: {
    nodes: [{ data: { id: 'n1', label: 'Node 1' } }],
    edges: []
  }
});

// Add a node
editor.addNode({ id: 'n2', label: 'Node 2' });

// Add an edge
editor.addEdge('n1', 'n2', { label: 'connects' });

// Export the graph
const graphData = editor.exportGraph();
```

### Using the Vue Component

```vue
<template>
  <BoxesEditor 
    :elements="elements"
    @nodeAdded="handleNodeAdded"
  />
</template>

<script setup>
import { BoxesEditor } from '@boxes/vue';
import { ref } from 'vue';

const elements = ref({
  nodes: [{ data: { id: 'n1', label: 'Node 1' } }],
  edges: []
});

function handleNodeAdded(data) {
  console.log('Node added:', data.node);
}
</script>
```

### Using the React Component

```jsx
import { useRef } from 'react';
import { BoxesEditor } from '@boxes/react';

function App() {
  const editorRef = useRef();

  const handleAddNode = () => {
    editorRef.current?.addNode({ 
      id: 'n1', 
      label: 'New Node' 
    });
  };

  return (
    <>
      <button onClick={handleAddNode}>Add Node</button>
      <BoxesEditor 
        ref={editorRef}
        onNodeAdded={(data) => console.log('Added:', data)}
      />
    </>
  );
}
```

## Development

### Project Structure

```
boxes/
├── packages/
│   ├── core/           # Core library (Cytoscape.js wrapper)
│   ├── vue/            # Vue 3 integration
│   ├── react/          # React integration
│   ├── electron/       # Electron desktop app
│   └── web/            # Web server and browser app
├── package.json        # Root package.json with workspaces
└── ...
```

### Build Commands

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=packages/core

# Watch mode for development
npm run dev --workspace=packages/core
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests for specific package
npm run test --workspace=packages/core
```

**Note:** Tests that require Cytoscape.js rendering need a real browser environment. The happy-dom test environment lacks full Canvas support. Template and basic structure tests will pass.

### Linting

```bash
# Lint all files
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Building Electron Distributables

```bash
# Create distributable (AppImage, snap, etc.)
npm run build:dist --workspace=packages/electron

# Platform-specific builds
npm run build:mac --workspace=packages/electron
npm run build:win --workspace=packages/electron
npm run build:linux --workspace=packages/electron
```

## Architecture

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for detailed development guidelines, architecture overview, and conventions.

## Key Concepts

### Cytoscape.js Styling

Boxes uses a hybrid approach to handle CSS styling:
- Styles are stored in element `data._style` objects
- Dynamic stylesheets are generated from these stored styles
- Cytoscape's selector-based styling is used for rendering

### Templates

Templates provide starting points with predefined styles:
- Define element structures and stylesheet rules
- Can be extended with custom templates in Electron app
- Located in `packages/electron/templates/`

### Layout Algorithms

Built-in layouts: grid, circle, concentric, breadthfirst, cose. Additional Cytoscape.js layouts can be added as needed.

## License

MIT
