/**
 * I/O Plugin Manager — registry for importers and exporters.
 *
 * Importer descriptor shape:
 *   { name, extensions: string[], mimeTypes: string[],
 *     import: async (text: string, options?) => graphData }
 *
 * Exporter descriptor shape:
 *   { name, extension: string, mimeType: string,
 *     export: async (editor: BoxesEditor, options?) => string | Blob }
 */

const _importers = new Map();
const _exporters = new Map();

export function registerImporter(id, descriptor) {
  _importers.set(id, descriptor);
}

export function registerExporter(id, descriptor) {
  _exporters.set(id, descriptor);
}

export function getImporters() {
  return Array.from(_importers.entries()).map(([id, d]) => ({ id, ...d }));
}

export function getExporters() {
  return Array.from(_exporters.entries()).map(([id, d]) => ({ id, ...d }));
}

/** Run a registered importer; returns graph data ready for editor.importGraph(). */
export async function runImport(id, text, options = {}) {
  const importer = _importers.get(id);
  if (!importer) throw new Error(`Unknown importer: ${id}`);
  return importer.import(text, options);
}

/** Run a registered exporter; returns a string or Blob. */
export async function runExport(id, editor, options = {}) {
  const exporter = _exporters.get(id);
  if (!exporter) throw new Error(`Unknown exporter: ${id}`);
  return exporter.export(editor, options);
}
