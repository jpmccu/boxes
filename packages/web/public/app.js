import {
  BoxesEditor, defaultTemplates, loadTemplateFromUrl,
  rdfImporter, rdfExporter,
  jsonldImporter, jsonldExporter,
  rdfXmlImporter, rdfXmlExporter,
} from '/core/boxes-core.js';
import { registerImporter, registerExporter, getImporters, getExporters, runImport, runExport } from './io/io-manager.js';
import { lucidchartCSVImporter } from './io/importers/lucidchart-csv.js';
import { svgExporter } from './io/exporters/svg.js';
import { pdfExporter } from './io/exporters/pdf.js';
import { startTour, isTourDone } from './tour.js';

// ── Register built-in I/O plugins ───────────────────────────────────────────
registerImporter('lucidchart-csv', lucidchartCSVImporter);
registerImporter('rdf', rdfImporter);
registerImporter('jsonld', jsonldImporter);
registerImporter('rdfxml', rdfXmlImporter);
registerExporter('svg', svgExporter);
registerExporter('pdf', pdfExporter);
registerExporter('rdf', rdfExporter);
registerExporter('jsonld', jsonldExporter);
registerExporter('rdfxml', rdfXmlExporter);

let editor = null;
let currentFileName = 'graph.json';
let currentFileHandle = null; // FileSystemFileHandle when opened/saved via File System Access API

const BOXES_FILE_TYPES = [{ description: 'Boxes Graph', accept: { 'application/json': ['.boxes', '.json'] } }];

/**
 * Render the template grid from an array of template objects.
 */
function renderTemplateGrid(templates) {
  const grid = document.getElementById('template-grid');
  grid.innerHTML = '';
  templates.forEach(t => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `<h3>${t.title}</h3><p>${t.description}</p>`;
    card.addEventListener('click', () => startWithTemplate(t));
    grid.appendChild(card);
  });
}

/**
 * Load templates from the default bundled set plus any additional URLs.
 * Extra URLs are fetched at startup; failures are silently skipped.
 * @param {string[]} extraUrls - Optional list of JSON template file URLs to load.
 */
async function loadTemplates(extraUrls = []) {
  const templates = Object.values(defaultTemplates);
  for (const url of extraUrls) {
    try {
      const t = await loadTemplateFromUrl(url);
      templates.push(t);
    } catch (err) {
      console.warn(`Failed to load template from ${url}:`, err);
    }
  }
  renderTemplateGrid(templates);
}

/**
 * Start editing with a given template object (full graph/template JSON).
 * Also accepts a template ID string for backwards compatibility.
 */
function startWithTemplate(templateOrId) {
  const template = (typeof templateOrId === 'string')
    ? (defaultTemplates[templateOrId] || defaultTemplates['blank'])
    : templateOrId;

  document.getElementById('welcome-screen').classList.add('d-none');
  document.getElementById('editor-container').classList.remove('d-none');

  if (editor) { editor.destroy(); editor = null; }
  const container = document.getElementById('editor-container');
  editor = new BoxesEditor(container, { template, layout: { name: 'preset' } });
  window.__editor = editor;
}

function saveToFile() {
  if (!editor) { alert('No graph to save'); return; }
  if ('showSaveFilePicker' in window) {
    _saveWithPicker(currentFileHandle);
  } else {
    _saveDownloadFallback();
  }
}

function saveAsFile() {
  if (!editor) { alert('No graph to save'); return; }
  if ('showSaveFilePicker' in window) {
    _saveWithPicker(null);
  } else {
    _saveDownloadFallback();
  }
}

async function _saveWithPicker(handle) {
  try {
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: currentFileName,
        types: BOXES_FILE_TYPES,
      });
    }
    const graphData = editor.exportGraph();
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(graphData, null, 2));
    await writable.close();
    currentFileHandle = handle;
    currentFileName = handle.name;
  } catch (err) {
    if (err.name !== 'AbortError') {
      alert(`Failed to save: ${err.message}`);
      console.error(err);
    }
  }
}

function _saveDownloadFallback() {
  const graphData = editor.exportGraph();
  const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFileName;
  a.click();
  URL.revokeObjectURL(url);
}

function loadFromFile(file, handle = null) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const graphData = JSON.parse(e.target.result);
      // Start with a blank editor; importGraph will restore palette from the file.
      // Fall back to a named template for old files that have templateId but no palette.
      if (!graphData.palette && graphData.templateId) {
        startWithTemplate(graphData.templateId);
      } else {
        startWithTemplate('blank');
      }
      editor.importGraph(graphData);
      currentFileName = file.name;
      currentFileHandle = handle; // null when opened via legacy <input>
    } catch (err) {
      alert('Failed to load file: Invalid JSON');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

async function openFileDialog() {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: BOXES_FILE_TYPES });
      const file = await handle.getFile();
      loadFromFile(file, handle);
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  } else {
    document.getElementById('file-input').click();
  }
}

document.getElementById('new-btn').addEventListener('click', () => {
  if (confirm('Create a new graph? Current graph will be cleared.')) {
    if (editor) { editor.destroy(); editor = null; }
    currentFileName = 'graph.json';
    currentFileHandle = null;
    document.getElementById('editor-container').classList.add('d-none');
    document.getElementById('welcome-screen').classList.remove('d-none');
  }
});

document.getElementById('open-btn').addEventListener('click', openFileDialog);
document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) loadFromFile(e.target.files[0], null);
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
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); saveAsFile(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToFile(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); openFileDialog(); }
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
      // Suggest the same basename with .boxes for the next Save
      currentFileName = file.name.replace(/\.[^.]+$/, '.boxes');
      currentFileHandle = null; // imported format differs; require Save As to pick destination
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
    const suggestedName = `${base}${exporter.extension}`;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: exporter.name, accept: { [exporter.mimeType]: [exporter.extension] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content instanceof Blob ? content : new Blob([content], { type: exporter.mimeType }));
        await writable.close();
      } catch (pickerErr) {
        if (pickerErr.name !== 'AbortError') throw pickerErr;
      }
    } else {
      triggerDownload(content, suggestedName, exporter.mimeType);
    }
  } catch (err) {
    alert(`Export failed: ${err.message}`);
    console.error(err);
  }
});

buildImportMenu();
buildExportMenu();

loadTemplates();
