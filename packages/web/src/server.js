import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

// Serve static files
const publicPath = isDev ? join(__dirname, '../public') : join(__dirname, '../dist');
const corePath = join(__dirname, '../../core/dist');

// Serve core library at /core
app.use('/core', express.static(corePath));

app.use(express.static(publicPath));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   Boxes Web Server                    ║
╚═══════════════════════════════════════╝

🌐 Server running at: http://localhost:${PORT}
📦 Environment: ${isDev ? 'development' : 'production'}

${isDev ? `
🔧 Serving files from: public/
   All graph operations use browser local storage
   Files are saved/loaded via browser download/upload
` : `
🚀 Serving built files from: dist/
`}

Press Ctrl+C to stop
  `);
});

export default app;
