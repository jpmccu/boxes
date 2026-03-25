# Boxes Web Server

Simple static file server for running Boxes in a web browser.

## What It Does

Serves the Boxes graph editor as a web app. All file operations happen **locally in your browser** — no backend storage, no APIs, no database.

## Quick Start

```bash
npm run web:dev
```

Open http://localhost:3001 in your browser.

## How It Works

1. **Server** serves static HTML/JS files
2. **Browser** runs the full graph editor (`boxes-core`)
3. **Files** are loaded/saved via the browser's file picker
4. **No backend** — everything is client-side

## Features

- ✅ Load and save `.boxes` / `.json` graph files from your computer
- ✅ Keyboard shortcuts (Ctrl+S, Ctrl+O, Ctrl+N)
- ✅ Editable palette — build and save custom node/edge type palettes
- ✅ Built-in templates (Ontology or RDF File, Arrows, Blank)
- ✅ Any `.boxes` file can be reopened as a template
- ✅ No installation required
- ✅ Works on any device with a modern browser
- ✅ Complete privacy (no server storage)

## Deployment

Since it's just static files, deploy anywhere:

**Simple:**
```bash
cd packages/web/public
python -m http.server 3001
```

**Node.js:**
```bash
npm run web:start
```

**Cloud:**
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
- Any static hosting

## vs Electron App

| Feature | Electron | Web |
|---------|----------|-----|
| Installation | Required | None |
| File Access | Direct | Via picker |
| Offline | Yes | After initial load |
| Platform | Desktop only | Any browser |
| Updates | Manual | Automatic |

## Privacy

All data stays in your browser:
- No server-side storage
- No data collection
- No tracking
- Files never leave your computer (except when you download them)

See `packages/web/README.md` for full deployment details and the `.boxes` file format.
