import { BoxesEditor, defaultTemplates, rdfImporter, rdfExporter } from '/core/boxes-core.js';
import { registerImporter, registerExporter, getImporters, getExporters, runImport, runExport } from './io/io-manager.js';
import { lucidchartCSVImporter } from './io/importers/lucidchart-csv.js';
import { svgExporter } from './io/exporters/svg.js';
import { startTour, isTourDone } from './tour.js';

// ── Register built-in I/O plugins ───────────────────────────────────────────
registerImporter('lucidchart-csv', lucidchartCSVImporter);
registerImporter('rdf', rdfImporter);
registerExporter('svg', svgExporter);
registerExporter('rdf', rdfExporter);

let editor = null;
let currentFileName = 'graph.json';
let currentTemplateId = 'blank';

function loadTemplates() {
  const grid = document.getElementById('template-grid');
  grid.innerHTML = '';
  Object.keys(defaultTemplates).forEach(key => {
    const t = defaultTemplates[key];
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `<h3>${t.name}</h3><p>${t.description}</p>`;
    card.addEventListener('click', () => startWithTemplate(key));
    grid.appendChild(card);
  });
}

function startWithTemplate(templateId) {
  currentTemplateId = templateId;
  const currentTemplate = defaultTemplates[templateId] || defaultTemplates['blank'];

  document.getElementById('welcome-screen').classList.add('d-none');
  document.getElementById('editor-container').classList.remove('d-none');

  if (editor) { editor.destroy(); editor = null; }
  const container = document.getElementById('editor-container');
  editor = new BoxesEditor(container, {
    elements: currentTemplate.elements,
    style: currentTemplate.style,
    nodeTypes: currentTemplate.nodeTypes || [],
    edgeTypes: currentTemplate.edgeTypes || [],
    context: currentTemplate.context || {},
    layout: { name: 'preset' }
  });
}

function saveToFile() {
  if (!editor) { alert('No graph to save'); return; }
  const graphData = editor.exportGraph();
  graphData.templateId = currentTemplateId;
  const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFileName;
  a.click();
  URL.revokeObjectURL(url);
}

function loadFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const graphData = JSON.parse(e.target.result);
      const templateId = graphData.templateId || 'blank';
      startWithTemplate(templateId);
      editor.importGraph(graphData);
      currentFileName = file.name;
    } catch (err) {
      alert('Failed to load file: Invalid JSON');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

document.getElementById('new-btn').addEventListener('click', () => {
  if (confirm('Create a new graph? Current graph will be cleared.')) {
    if (editor) { editor.destroy(); editor = null; }
    currentFileName = 'graph.json';
    document.getElementById('editor-container').classList.add('d-none');
    document.getElementById('welcome-screen').classList.remove('d-none');
  }
});

document.getElementById('open-btn').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) loadFromFile(e.target.files[0]);
  e.target.value = '';
});
document.getElementById('save-btn').addEventListener('click', saveToFile);

document.getElementById('tour-btn').addEventListener('click', () => {
  // If no editor is open yet, start with the OWL Ontology template first
  if (!editor) {
    startWithTemplate('owl-ontology');
    setTimeout(startTour, 400);
  } else {
    startTour();
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToFile(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); document.getElementById('file-input').click(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); document.getElementById('new-btn').click(); }
});

// ── Import / Export UI ──────────────────────────────────────────────────────

/** Ensure the editor is initialised before importing; uses the blank template if needed. */
function ensureEditor() {
  if (!editor) startWithTemplate('blank');
}

/** Trigger a file download in the browser. */
function triggerDownload(content, filename, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Populate the Import dropdown from registered importers. */
function buildImportMenu() {
  const menu = document.getElementById('import-menu');
  menu.innerHTML = '';
  for (const imp of getImporters()) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'dropdown-item';
    btn.textContent = imp.name;
    btn.dataset.importerId = imp.id;
    li.appendChild(btn);
    menu.appendChild(li);
  }
}

/** Populate the Export dropdown from registered exporters. */
function buildExportMenu() {
  const menu = document.getElementById('export-menu');
  menu.innerHTML = '';
  for (const exp of getExporters()) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'dropdown-item';
    btn.textContent = exp.name;
    btn.dataset.exporterId = exp.id;
    li.appendChild(btn);
    menu.appendChild(li);
  }
}

// Delegate clicks on import menu items
document.getElementById('import-menu').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-importer-id]');
  if (!btn) return;
  const importerId = btn.dataset.importerId;
  const importer = getImporters().find(i => i.id === importerId);
  if (!importer) return;

  const fileInput = document.getElementById('import-file-input');
  fileInput.accept = importer.extensions.join(',');
  fileInput.dataset.pendingImporterId = importerId;
  fileInput.click();
});

// Handle file selected for import
document.getElementById('import-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const importerId = e.target.dataset.pendingImporterId;
  if (!importerId) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const graphData = await runImport(importerId, ev.target.result, {
        context:   editor?.context   || {},
        edgeTypes: editor?.getEdgeTypes?.() || [],
      });
      ensureEditor();

      // Preserve existing stylesheet: keep all current rules and append any
      // incoming rules whose selectors aren't already defined.
      const existing = editor.getStylesheet();
      const existingSelectors = new Set(existing.map(r => r.selector));
      const merged = [
        ...existing,
        ...(graphData.userStylesheet || []).filter(r => !existingSelectors.has(r.selector)),
      ];
      graphData.userStylesheet = merged;

      editor.importGraph(graphData);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
      console.error(err);
    }
  };
  reader.readAsText(file);
});

// Delegate clicks on export menu items
document.getElementById('export-menu').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-exporter-id]');
  if (!btn) return;
  if (!editor) { alert('No graph to export'); return; }

  const exporterId = btn.dataset.exporterId;
  const exporter = getExporters().find(ex => ex.id === exporterId);
  if (!exporter) return;

  try {
    const content = await runExport(exporterId, editor);
    const base = currentFileName.replace(/\.[^.]+$/, '') || 'graph';
    triggerDownload(content, `${base}${exporter.extension}`, exporter.mimeType);
  } catch (err) {
    alert(`Export failed: ${err.message}`);
    console.error(err);
  }
});

buildImportMenu();
buildExportMenu();

loadTemplates();
