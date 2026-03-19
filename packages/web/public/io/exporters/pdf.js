/**
 * PDF exporter for Boxes graph editor.
 *
 * Delegates to BoxesEditor.exportPdf(), which lazily loads cytoscape-pdf-export
 * (and PDFKit) so the large bundle is only fetched when the user actually
 * exports a PDF.
 */

export const pdfExporter = {
  name: 'PDF Document',
  extension: '.pdf',
  mimeType: 'application/pdf',

  async export(editor, options = {}) {
    if (!editor.getCytoscape()?.nodes().length) {
      throw new Error('Nothing to export — graph is empty');
    }
    return editor.exportPdf(options);
  },
};
