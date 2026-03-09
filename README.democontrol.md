# Presenter README

## How do I log in?

No login required. Open a browser and navigate to the web app.

To start the server if it isn't already running:

```bash
cd packages/web
npm run dev
```

---

## What should I show?

### 1. Welcome screen & templates
- The app opens on a template-selection screen. Point out the **OWL Ontology** card — it comes pre-loaded with `owl:`, `rdfs:`, `skos:`, and `sh:` namespaces and all the edge types needed for a real ontology.
- Click **OWL Ontology** to start.

### 2. Guided tour
- Click **❓ Tour** in the top-right of the toolbar to launch the step-by-step walkthrough.
- The tour covers the canvas, palette, edge drawing, properties, context prefixes, layout, and save/export — great for a live demo.

### 3. Placing nodes and drawing edges
- The **Palette tab (✦)** on the left sidebar lists node types (`owl:Class`, `sh:NodeShape`, etc.) and edge types (`rdfs:subClassOf`, `owl:ObjectProperty`, etc.).
- Select a node type, then **click the canvas** to place a node.
- **Hover** over a node to reveal the blue draw-handle at the top; **drag** it to another node to create a typed relationship.
- Select a node or edge and open the **Properties tab (☰)** to edit its label and IRI.

### 4. Auto-layout
- Open the **Layout tab (⊕)** and try **Dagre** for a clean class hierarchy, or **KLay** for orthogonal routing.
- Select specific nodes first to apply layout to only those nodes — great for tidying part of a large graph.

### 5. Context / namespace prefixes
- The **Context tab (@)** shows the JSON-LD prefixes loaded from the template.
- Add or edit entries to extend the namespace (e.g. add a custom `ex:` prefix for your org's URIs).

### 6. RDF round-trip
- **Export → RDF / Turtle** to download a `.ttl` file. Open it in a text editor to show the Turtle syntax with proper prefixes.
- **Import → RDF / Turtle** to reload it and confirm the graph reconstructs correctly.

### 7. LucidChart import
- **Import → LucidChart CSV** to bring in a diagram exported from LucidChart.
- Lines with a *Generalization* destination arrow are automatically mapped to `rdfs:subClassOf` edges.

### 8. Save & reload
- **Save** (or **Ctrl+S**) downloads a `.json` snapshot.
- **Open** reloads it exactly, preserving node positions, properties, and context.

---

## What should I avoid?

- **Don't close the browser tab mid-demo** — there is no server-side persistence; all state is in memory until saved.
- **Don't import a Turtle file built outside the app** unless you've verified the prefixes match the template context — mismatched prefixes will create uncompressed IRI node IDs.
- **Don't run layout on the whole graph without checking** — on a large graph it will reposition everything and can't be undone easily (Ctrl+Z works, but positions are lost).

---

## Anything critical I must know?

- The **Tour button resets** its "seen" state per browser via `localStorage`. If you want to demo the tour again, run `localStorage.removeItem('boxes-tour-v1-done')` in the browser console.
- The **core library** is served from `packages/core/dist/`. If you've made code changes, run `npm run build` inside `packages/core` before starting the web server.
- **Keyboard shortcuts**: `Ctrl+S` save, `Ctrl+Z` undo, `Ctrl+Y` redo, `Ctrl+O` open, `Delete`/`Backspace` remove selected elements.
- The Electron desktop app (`packages/electron`) offers the same features with native file dialogs — use it if a browser isn't convenient.
