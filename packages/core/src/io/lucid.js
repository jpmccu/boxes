/**
 * Lucid Standard Import (LSI) exporter for Boxes graph editor.
 *
 * Produces a document.json object conforming to the Lucid Standard Import v1 spec.
 * See: https://developer.lucid.co/docs/overview-si
 *
 * The .lucid file sent to the Lucid API is a ZIP archive that must contain a
 * file named `document.json`.  This module only produces the JSON payload;
 * packaging and upload are handled separately (see scripts/lucid-import.sh).
 *
 * Format summary
 * --------------
 *   { version: 1, pages: [ { id, title, shapes: [...], lines: [...] } ] }
 *
 * Shape fields:
 *   id, type, boundingBox { x, y, w, h }, text, style?, customData?
 *
 * Line fields:
 *   id, lineType, endpoint1, endpoint2, text?, stroke?
 *
 * Endpoint fields:
 *   type ("shapeEndpoint"), style ("none"|"arrow"|…), shapeId, position { x, y }
 */

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Boxes data fields that are not user properties */
const BOXES_INTERNAL = new Set([
  'id', 'source', 'target', 'label', 'labels',
  '_style', '_classes', '_arrowsStyle',
]);

/** Default node dimensions when the graph contains no explicit size */
const DEFAULT_NODE_W = 120;
const DEFAULT_NODE_H = 60;

/**
 * Map Cytoscape shape names to Lucid shape type strings.
 * Lucid accepts a wider set of type strings but these are the reliable built-ins.
 */
const CYTOSCAPE_SHAPE_TO_LUCID = {
  'ellipse':        'circle',
  'circle':         'circle',
  'rectangle':      'rectangle',
  'roundrectangle': 'rectangle',
  'square':         'rectangle',
  'cutrectangle':   'rectangle',
  'bottomroundrectangle': 'rectangle',
  'diamond':        'diamond',
  'triangle':       'triangle',
  'pentagon':       'pentagon',
  'hexagon':        'hexagon',
  'octagon':        'rectangle',
  'star':           'star',
  'barrel':         'rectangle',
  'rhomboid':       'diamond',
  'tag':            'rectangle',
  'vee':            'triangle',
};

/**
 * Build a Lucid shape object from a Boxes node.
 *
 * Cytoscape node positions refer to the centre of the node, while Lucid's
 * boundingBox uses the top-left corner, so we offset accordingly.
 *
 * @param {{ data: object, position?: { x: number, y: number } }} node
 * @returns {object} LSI shape object
 */
function _nodeToShape(node) {
  const { id, label, _style = {} } = node.data;

  const pos = node.position ?? { x: 0, y: 0 };
  const w = Number(_style.width)  || DEFAULT_NODE_W;
  const h = Number(_style.height) || DEFAULT_NODE_H;

  const cyShape = _style.shape;
  const lucidType = CYTOSCAPE_SHAPE_TO_LUCID[cyShape] ?? 'rectangle';

  const shape = {
    id:  String(id),
    type: lucidType,
    boundingBox: {
      x: Math.round(pos.x - w / 2),
      y: Math.round(pos.y - h / 2),
      w: Math.round(w),
      h: Math.round(h),
    },
    text: label || '',
  };

  // ── Style mapping ──────────────────────────────────────────────────────────
  const lucidStyle = {};

  const fillColor = _style['background-color'];
  if (fillColor) {
    lucidStyle.fill = { type: 'color', color: fillColor };
  }

  const strokeColor = _style['border-color'];
  const strokeWidth = _style['border-width'];
  if (strokeColor != null || strokeWidth != null) {
    lucidStyle.stroke = {};
    if (strokeColor != null) lucidStyle.stroke.color = strokeColor;
    if (strokeWidth != null) lucidStyle.stroke.width = Number(strokeWidth);
  }

  if (Object.keys(lucidStyle).length > 0) shape.style = lucidStyle;

  // ── User properties → customData ──────────────────────────────────────────
  const customData = [];
  for (const [k, v] of Object.entries(node.data)) {
    if (!BOXES_INTERNAL.has(k) && v != null) {
      customData.push({ key: k, value: String(v) });
    }
  }
  if (customData.length > 0) shape.customData = customData;

  return shape;
}

/**
 * Build a Lucid line object from a Boxes edge.
 *
 * @param {{ data: object }} edge
 * @returns {object} LSI line object
 */
function _edgeToLine(edge) {
  const { id, source, target, label, _style = {} } = edge.data;

  const line = {
    id: String(id),
    lineType: 'elbow',
    endpoint1: {
      type:    'shapeEndpoint',
      style:   'none',
      shapeId: String(source),
    },
    endpoint2: {
      type:    'shapeEndpoint',
      style:   'arrow',
      shapeId: String(target),
    },
  };

  if (label) {
    line.text = [{ text: label, position: 0.5, side: 'middle' }];
  }

  // ── Line style ─────────────────────────────────────────────────────────────
  const strokeColor = _style['line-color'] ?? _style['target-arrow-color'];
  const strokeWidth = _style['width'];
  if (strokeColor != null || strokeWidth != null) {
    line.stroke = {};
    if (strokeColor != null) line.stroke.color = strokeColor;
    if (strokeWidth != null) line.stroke.width = Number(strokeWidth);
  }

  return line;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a Boxes graph (as returned by `editor.exportGraph()`) into a
 * Lucid Standard Import `document.json` object.
 *
 * The returned object can be `JSON.stringify`-ed and placed inside a ZIP
 * archive (named `document.json`) to form a `.lucid` file ready for upload.
 *
 * @param {object} boxesGraph   Result of `BoxesEditor.exportGraph()`
 * @param {object} [options]
 * @param {string} [options.title='Boxes Export']    Document title shown in Lucid
 * @param {string} [options.pageTitle='Page 1']      Title of the exported page
 * @param {string} [options.product='lucidchart']    Target product: 'lucidchart' | 'lucidspark'
 * @returns {object}  LSI document object (ready to JSON.stringify)
 */
export function exportToLucid(boxesGraph, options = {}) {
  const {
    title     = 'Boxes Export',
    pageTitle = 'Page 1',
    product   = 'lucidchart',
  } = options;

  const { nodes: boxesNodes = [], edges: boxesEdges = [] } =
    boxesGraph?.elements ?? {};

  const shapes = boxesNodes.map(_nodeToShape);
  const lines  = boxesEdges.map(_edgeToLine);

  return {
    version: 1,
    product,
    title,
    pages: [
      {
        id:     'page1',
        title:  pageTitle,
        shapes,
        lines,
      },
    ],
  };
}

// ─── Descriptor (for use with BoxesEditor) ────────────────────────────────────

/**
 * Exporter descriptor compatible with the Boxes I/O plugin manager.
 *
 * Produces the `document.json` content as a plain-JSON string.  To create a
 * `.lucid` file ready for direct API upload, wrap the JSON in a ZIP archive
 * and rename the entry to `document.json` (see scripts/lucid-import.sh).
 */
export const lucidExporter = {
  label:     'Lucid Standard Import JSON',
  extension: '.json',
  mimeType:  'application/json',
  export: (graph, options) => JSON.stringify(exportToLucid(graph, options), null, 2),
};
