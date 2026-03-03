# Boxes - Copilot Instructions

## Project Overview

Boxes is a Cytoscape.js-based Labeled Property Graph (LPG) editor with CSS styling capabilities. It provides similar functionality to Arrows but exposes Cytoscape.js's CSS styling system as part of the graph data model.

**Core Components:**
- **Core Library** - Pure JavaScript library for graph editing
- **Vue 3 Wrapper** - Vue component integration
- **React Wrapper** - React component integration
- **Electron App** - Standalone desktop application

## Architecture

### Data Model
- **Format**: Cytoscape.js elements JSON format
- **Graph Type**: Labeled Property Graph
- Nodes and edges contain:
  - Labels (types/categories)
  - Properties (arbitrary key-value data)
  - CSS styles (Cytoscape.js style objects)

### Module Structure
```
boxes/
├── packages/
│   ├── core/           # Core library (Cytoscape.js wrapper)
│   ├── vue/            # Vue 3 integration
│   ├── react/          # React integration
│   └── electron/       # Electron desktop app
├── package.json        # Root package.json with workspaces
└── ...
```

**Note**: This is a monorepo using npm workspaces. The root `package.json` should define:
```json
{
  "workspaces": ["packages/*"]
}
```

### Core Library Responsibilities
- Initialize and manage Cytoscape.js instance
- Handle graph editing operations (add/remove/update nodes and edges)
- Manage property editing for nodes and edges
- Handle CSS style editing and application
- Let users run any of the installed graph layout algorithms, or enable the library user to pass in a layout algorithm as needed.
- Import/export elements JSON format
- Provide event system for graph changes

### Framework Wrappers
**CRITICAL**: Cytoscape.js requires a DOM container and manipulates it directly. Framework wrappers must:

- **Vue 3**: 
  - Use `ref` for container element
  - Initialize Cytoscape in `onMounted` hook
  - Destroy instance in `onUnmounted` 
  - Pass graph updates via `watch` on props
  - Expose Cytoscape instance via `defineExpose` for imperative access
  
- **React**: 
  - Use `useRef` for container element
  - Initialize in `useEffect` with empty deps
  - Clean up (destroy) in effect return function
  - Use `useEffect` to apply prop changes to Cytoscape instance
  - Expose methods via `useImperativeHandle` with `forwardRef`

- **Both**: Don't let frameworks manage the Cytoscape canvas - treat it as an imperative library

### Electron App
- Uses the core library for graph editing
- Provides file system access for loading/saving graphs
- Desktop-specific features (menus, shortcuts, etc.)
- Implement an "empty document" starting state that asks users to load an existing file or create a blank one.
- Provide "empty document" templates for:
  - "OWL Ontology": includes default styling for the OWL meta-types (especially owl:Class and owl:Ontology, but also the property types), that's driven off of the @type data property. It should use the default styling from CMap Ontology edition.
  - "Arrows"

## Build & Development

### Setup
```bash
npm install
```

### Development
```bash
# Core library development
npm run dev

# Build all packages
npm run build

# Run Electron app in dev mode
npm run electron:dev
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests for a specific package
npm run test -- packages/core

# Run a single test file
npm run test -- packages/core/tests/graph-operations.test.js
```

### Linting
```bash
# Lint all files
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

## Key Conventions

### Code Style
- Pure JavaScript (no TypeScript)
- Use ES modules
- Use Vite for building
- ESLint for code quality

### Graph Operations
- Always validate graph structure before modifications
- Emit events for all graph changes (add, remove, update)
- Preserve existing CSS styles when updating properties
- Use Cytoscape.js selectors for bulk operations

### Data Format
- Input/output format is Cytoscape.js elements JSON:
  ```javascript
  {
    nodes: [{ data: { id, label, ...properties } }],
    edges: [{ data: { id, source, target, label, ...properties } }]
  }
  ```

**IMPORTANT - Cytoscape.js Styling Architecture**:
- Cytoscape.js uses **stylesheet-based styling**, NOT inline `style` properties on elements
- Styles are defined separately in a stylesheet array and applied via selectors
- Example:
  ```javascript
  cytoscape({
    elements: { nodes: [...], edges: [...] },
    style: [
      { selector: 'node', style: { 'background-color': 'blue' } },
      { selector: 'node[label="Person"]', style: { 'shape': 'ellipse' } },
      { selector: '.highlighted', style: { 'border-width': 3 } }
    ]
  })
  ```
- **For Boxes**: Since we want CSS as part of the graph data, we need to:
  1. Store style information in element `data` or `classes`
  2. Dynamically generate stylesheets from stored style data
  3. Apply classes to elements for style association

### CSS Styling Strategy
Since Cytoscape.js doesn't support inline styles, Boxes uses this approach:

1. **Store style data in element's `data` object**:
   ```javascript
   { data: { id: 'n1', label: 'Person', _style: { 'background-color': 'red' } } }
   ```

2. **Generate dynamic stylesheets** from `_style` data:
   - Create unique selectors per element (e.g., `[id="n1"]`)
   - Rebuild stylesheet when styles change
   
3. **Support class-based presets**:
   - Store class names: `{ data: { id: 'n1', _classes: ['person', 'highlighted'] } }`
   - Apply via Cytoscape's `element.classes()` method
   - Define preset styles in the stylesheet

4. **Real-time style editing**:
   - Update element's `data._style`
   - Regenerate affected stylesheet rules
   - Call `cy.style().update()` to apply changes

**Export format**: Include both element data (with `_style`) and stylesheet rules

### Component API
- Core library exports a single class/factory function
- Framework wrappers expose props/hooks for:
  - Initial graph data
  - Event callbacks (onChange, onSelect, etc.)
  - Configuration options
- Keep wrapper APIs consistent across Vue and React

### Testing Strategy
- Use Vitest for all tests
- **DOM environment required**: Configure Vitest with `environment: 'jsdom'` or `'happy-dom'`
  - Cytoscape.js needs browser APIs (Canvas, DOM)
  - Cannot easily mock Cytoscape.js without losing functionality
- Test core library:
  - Graph operations (add/remove/update nodes and edges)
  - Style management and stylesheet generation
  - Import/export with various graph structures
  - Event emission
- Test framework wrappers:
  - Component mounting/unmounting
  - Prop changes triggering graph updates
  - Event callbacks firing correctly
  - Memory leaks (ensure Cytoscape instances are destroyed)

### Electron Specifics
- Keep Electron app minimal - it's a wrapper around core library
- Use preload scripts for secure IPC
- Support standard desktop patterns (Cmd+S to save, etc.)
- Handle unsaved changes on quit

## Dependencies

### Core
- `cytoscape` - The graph visualization engine

### Development
- `vite` - Build tool
- `vitest` - Testing framework
- `jsdom` or `happy-dom` - DOM environment for tests
- `eslint` - Linting

### Framework Wrappers
- Vue wrapper: `vue` (v3.x)
- React wrapper: `react` (v18.x) + `react-dom`

### Electron
- `electron` - Desktop framework
- `electron-builder` - Packaging

### Build Targets
- Core library should export:
  - ESM build for modern bundlers
  - UMD build for direct browser usage
  - Consider separate builds for development (with warnings) and production

## File Naming
- Use kebab-case for files: `graph-editor.js`, `style-panel.js`
- Test files: `*.test.js` alongside source or in `tests/` directory
- Config files: Standard names (`vite.config.js`, `eslint.config.js`)
