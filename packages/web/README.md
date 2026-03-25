# boxes-web

Simple static file server for running Boxes graph editor in a web browser.

## Features

- �� Browser-based graph editor powered by `boxes-core`
- 📁 Load/Save `.boxes` files locally via the browser's file picker
- 🎨 Template support — built-in templates (Ontology or RDF File, Arrows, Blank) plus any `.boxes` file can serve as a template
- 🧩 **Editable palette** — add, edit, and delete node/edge types directly in the Palette tab; the palette is saved with each file
- ⌨️ Keyboard shortcuts (Ctrl/Cmd+S, Ctrl/Cmd+O, Ctrl/Cmd+N)
- 📱 Works on any modern browser

## Quick Start

### Development

```bash
npm run dev
```

Opens at http://localhost:3001

### Production

```bash
# Build frontend
npm run build

# Start production server
npm start
```

## How It Works

This is a **static file server** — no backend, no database, no APIs.

- Server simply serves HTML/JS files
- All file operations happen in the browser
- Files are saved/loaded using the browser's file picker (or download/upload fallback)
- No data is stored on the server

## Templates and Palettes

When you open Boxes you are presented with a template selector. Each template is a
`.boxes` file (JSON) that carries its own palette (node types and edge types),
stylesheet, and optional starter graph content.

**Any `.boxes` file can be used as a template.** The palette, stylesheet, and
context are all embedded in the file and restored when you open it.

### Editing the palette

1. Open (or create) a graph.
2. Switch to the **Palette** tab in the right sidebar.
3. Hover over a palette item to reveal the **✎ edit** and **× delete** buttons.
4. Click **+ Add node type** or **+ Add edge type** to create new types.
5. Each type has a label, unique ID, colour(s), shape/line style, and an optional
   JSON data template for default properties added to new nodes/edges of that type.
6. Save the file — the updated palette is stored in the `.boxes` file.

### Loading custom templates from a URL

`boxes-core` exports a `loadTemplateFromUrl(url)` helper. In `app.js`, pass extra
template URLs to `loadTemplates()` to populate the template grid at startup:

```js
// In your own fork of app.js:
loadTemplates(['/my-templates/domain-model.boxes']);
```

## File Operations

**Open File:**
- Click **Open File** or press Ctrl/Cmd+O
- Browser file picker opens
- Select a `.boxes` or `.json` file
- Graph (including palette) loads into editor

**Save File:**
- Click **Save File** or press Ctrl/Cmd+S
- Saves in place if the file was opened with the File System Access API
- Falls back to browser download otherwise

**Save As:**
- Press Ctrl/Cmd+Shift+S
- Always opens the save-file picker

**New Graph:**
- Click **New** or press Ctrl/Cmd+N
- Choose a template from the welcome screen
- Start editing

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + S` | Save file |
| `Ctrl/Cmd + Shift + S` | Save As |
| `Ctrl/Cmd + O` | Open file |
| `Ctrl/Cmd + N` | New graph |

## The `.boxes` File Format

`.boxes` files are plain JSON. Example:

```json
{
  "version": "1.0.0",
  "title": "My Graph",
  "description": "Optional description",
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

The format is the same whether the file is a saved graph or a template — there is
no separate template format.

## Deployment

Since it's just static files, deploy anywhere:

### Simple HTTP Server

```bash
cd packages/web/public
python -m http.server 3001
```

### With Node.js

```bash
npm run web:start
```

### Docker

```bash
docker compose up
```

### Nginx

```nginx
server {
    listen 80;
    root /path/to/boxes/packages/web/public;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### GitHub Pages / Netlify / Vercel

Point to the `public/` directory. Build step:

```bash
npm run build --workspace=packages/web
# Serves from dist/
```

## Privacy

Since there's no backend:
- ✅ All data stays local to your browser
- ✅ No server-side storage
- ✅ No data collection
- ✅ Works offline (after initial load)
- ✅ Complete privacy

## Browser Compatibility

Requires a modern browser with:
- ES6 modules
- File API / File System Access API (optional, for in-place save)
- Blob/download APIs

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

Apache 2.0
