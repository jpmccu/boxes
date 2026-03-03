# @boxes/web

Simple static file server for running Boxes graph editor in a web browser.

## Features

- 🌐 Browser-based graph editor (same UI as Electron app)
- 📁 Load/Save files locally via browser's file picker
- 📦 Template support (OWL Ontology, Arrows, Blank)
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

This is a **static file server** - no backend, no database, no APIs.

- Server simply serves HTML/JS files
- All file operations happen in the browser
- Files are saved/loaded using browser's download/upload
- No data is stored on the server

## File Operations

**Open File:**
- Click "Open File" or press Ctrl/Cmd+O
- Browser file picker opens
- Select a .json or .boxes file
- Graph loads into editor

**Save File:**
- Click "Save File" or press Ctrl/Cmd+S
- Browser downloads the file
- File saved to your Downloads folder

**New Graph:**
- Click "New" or press Ctrl/Cmd+N
- Choose a template
- Start editing

## Keyboard Shortcuts

- `Ctrl/Cmd + S` - Save file
- `Ctrl/Cmd + O` - Open file
- `Ctrl/Cmd + N` - New graph

## Deployment

This is just a static file server - deploy anywhere:

### Simple HTTP Server

```bash
cd public
python -m http.server 3001
```

### With Node.js

```bash
npm start
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
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

Just point to the `public/` directory. Build step:

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

Requires modern browser with:
- ES6 modules
- File API
- Blob/download APIs

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT
