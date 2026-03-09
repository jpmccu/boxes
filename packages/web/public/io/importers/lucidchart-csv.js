/**
 * LucidChart CSV importer.
 *
 * Converts LucidChart's CSV export into Boxes graph data.
 *
 * Standard LucidChart CSV columns (these are not treated as custom properties):
 *   Id, Name, Shape Library, Page ID, Contained By, Group,
 *   Line Source, Line Destination, Source Arrow, Destination Arrow,
 *   Status, Comment, Text Area N  (any number)
 *
 * Mapping rules:
 *   - label       → Text Area 1 only (Name is never used as a label)
 *   - name        → Name field (the element type, stored as data.name)
 *   - shape       → detected from Name via LUCID_SHAPE_MAP; applied as a CSS
 *                   class + generated stylesheet rule
 *   - Text Area 2+→ stored as properties (text_area_2, text_area_3, …)
 *   - Custom cols → any column not in the standard set becomes a property on
 *                   the node or edge
 *   - Document / Page rows → skipped (LucidChart structural metadata)
 *
 * Rows with Line Source or Line Destination become edges; all others are nodes.
 */

/** RFC 4180-compliant CSV parser that handles quoted fields with embedded commas/newlines. */
function parseCSV(text) {
  const rows = [];
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let i = 0;

  while (i < src.length) {
    // Skip blank lines
    if (src[i] === '\n') { i++; continue; }

    const row = [];
    while (i < src.length && src[i] !== '\n') {
      if (src[i] === '"') {
        // Quoted field — collect until closing unescaped quote
        i++; // skip opening quote
        let field = '';
        while (i < src.length) {
          if (src[i] === '"') {
            if (src[i + 1] === '"') { field += '"'; i += 2; } // escaped ""
            else { i++; break; } // closing quote
          } else {
            field += src[i++];
          }
        }
        row.push(field);
      } else {
        // Unquoted field
        let field = '';
        while (i < src.length && src[i] !== ',' && src[i] !== '\n') {
          field += src[i++];
        }
        row.push(field.trim());
      }
      if (src[i] === ',') i++; // consume field separator
    }
    if (src[i] === '\n') i++;
    if (row.length > 0 && row.some(f => f !== '')) rows.push(row);
  }

  return rows;
}

/** Case-insensitive header index lookup. */
function colIndex(headers, name) {
  return headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
}

// ── Standard LucidChart columns (not treated as custom user properties) ──────
const STANDARD_COLUMNS = new Set([
  'id', 'name', 'shape library', 'page id', 'contained by', 'group',
  'line source', 'line destination', 'source arrow', 'destination arrow',
  'status', 'comment',
]);

/** Returns true for headers that are LucidChart built-ins (including Text Area N). */
function isStandardColumn(header) {
  const lower = header.trim().toLowerCase();
  return STANDARD_COLUMNS.has(lower) || /^text area\s*\d+$/i.test(lower);
}

// ── LucidChart structural element names to skip ───────────────────────────────
const SKIP_NAMES = new Set(['document', 'page']);

// ── Shape name → Cytoscape shape mapping ─────────────────────────────────────
// Keys are lowercased LucidChart shape template names with trailing digits stripped.
const LUCID_SHAPE_MAP = {
  // Generic shapes
  'rectangle':            'roundrectangle',
  'rect':                 'rectangle',
  'square':               'rectangle',
  'rounded rectangle':    'roundrectangle',
  'round rectangle':      'roundrectangle',
  'ellipse':              'ellipse',
  'oval':                 'ellipse',
  'circle':               'ellipse',
  'diamond':              'diamond',
  'rhombus':              'diamond',
  'triangle':             'triangle',
  'parallelogram':        'rhomboid',
  'hexagon':              'hexagon',
  'octagon':              'octagon',
  'pentagon':             'pentagon',
  'star':                 'star',
  // Flowchart shapes
  'process':              'rectangle',
  'decision':             'diamond',
  'terminator':           'roundrectangle',
  'terminal':             'roundrectangle',
  'start':                'ellipse',
  'end':                  'ellipse',
  'data':                 'rhomboid',
  'predefined process':   'rectangle',
  'database':             'barrel',
  'cylinder':             'barrel',
  'note':                 'rectangle',
  'delay':                'roundrectangle',
  'manual input':         'rhomboid',
  'connector':            'ellipse',
  'off-page connector':   'pentagon',
  'merge':                'diamond',
  'extract':              'triangle',
  'or':                   'ellipse',
  'summing junction':     'ellipse',
  // UML
  'class':                'rectangle',
  'interface':            'rectangle',
  'component':            'rectangle',
  'actor':                'ellipse',
  'use case':             'ellipse',
  'package':              'rectangle',
  'state':                'roundrectangle',
  'initial state':        'ellipse',
  'final state':          'ellipse',
  'action':               'roundrectangle',
  'object':               'rectangle',
  'entity':               'rectangle',
};

/**
 * Detect a Cytoscape shape name from a LucidChart "Name" field value.
 * Strips trailing digits (e.g. "Decision 3" → "decision").
 * Returns null when no mapping is found.
 */
function detectShape(nameStr) {
  if (!nameStr) return null;
  const normalised = nameStr.trim().replace(/\s+\d+$/, '').toLowerCase();
  return LUCID_SHAPE_MAP[normalised] ?? null;
}

export const lucidchartCSVImporter = {
  name: 'LucidChart CSV',
  extensions: ['.csv'],
  mimeTypes: ['text/csv', 'application/csv'],

  import(text, _options = {}) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('CSV must have a header row and at least one data row');

    const headers = rows[0];

    const COL_ID         = colIndex(headers, 'Id');
    const COL_NAME       = colIndex(headers, 'Name');
    const COL_CONTAINED  = colIndex(headers, 'Contained By');
    const COL_LINE_SRC   = colIndex(headers, 'Line Source');
    const COL_LINE_DEST  = colIndex(headers, 'Line Destination');
    const COL_SRC_ARROW  = colIndex(headers, 'Source Arrow');
    const COL_DEST_ARROW = colIndex(headers, 'Destination Arrow');
    const COL_COMMENT    = colIndex(headers, 'Comment');

    if (COL_ID === -1) throw new Error('CSV is missing a required "Id" column');

    // Text Area N columns sorted by numeric suffix
    const textAreaCols = headers
      .map((h, i) => ({ name: h.trim(), i }))
      .filter(({ name }) => /^text area\s*\d+$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)[0], 10);
        const numB = parseInt(b.name.match(/\d+/)[0], 10);
        return numA - numB;
      });

    // Custom columns: anything that isn't a standard LucidChart header
    const customCols = headers
      .map((h, i) => ({ name: h.trim(), i }))
      .filter(({ name }) => name && !isStandardColumn(name));

    const getField = (row, idx) =>
      (idx >= 0 && idx < row.length) ? (row[idx] || '').trim() : '';

    const nodes = [];
    const edges = [];
    const detectedShapes = new Set();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const id = getField(row, COL_ID);
      if (!id) continue;

      const nameField = getField(row, COL_NAME);
      const lineSrc   = getField(row, COL_LINE_SRC);
      const lineDest  = getField(row, COL_LINE_DEST);

      // Skip Document and Page structural rows
      if (SKIP_NAMES.has(nameField.toLowerCase())) continue;

      if (lineSrc || lineDest) {
        // ── Edge ────────────────────────────────────────────────────────────
        // Text Area 1 is the edge label; Name is the edge type
        const textArea1 = textAreaCols.length > 0 ? getField(row, textAreaCols[0].i) : '';
        const edgeData  = {
          id:     `e_${id}`,
          source: lineSrc,
          target: lineDest,
          label:  textArea1,
        };

        // Name = element type
        //if (nameField) edgeData.name = nameField;

        const srcArrow  = getField(row, COL_SRC_ARROW);
        const destArrow = getField(row, COL_DEST_ARROW);

        // "Generalization" destination arrow on a Line = rdfs:subClassOf (source subClassOf target)
        if (nameField.toLowerCase() === 'line' && destArrow.toLowerCase() === 'generalization') {
          edgeData['@id'] = 'rdfs:subClassOf';
        }

        const comment = getField(row, COL_COMMENT);
        if (comment) edgeData.comment = comment;

        // Text Area 2+ as named properties
        for (let ti = 1; ti < textAreaCols.length; ti++) {
          const { name, i } = textAreaCols[ti];
          const val = getField(row, i);
          if (val) edgeData[name] = val;
        }

        // Custom columns → properties
        for (const { name, i } of customCols) {
          const val = getField(row, i);
          if (val) edgeData[name] = val;
        }

        edges.push({ data: edgeData });
      } else {
        // ── Node ────────────────────────────────────────────────────────────
        // Text Area 1 = display label; Name = element type
        const textArea1 = textAreaCols.length > 0 ? getField(row, textAreaCols[0].i) : '';
        const label     = textArea1;

        const nodeData = { id, label };

        // Detect Cytoscape shape from Name when Text Area 1 is present
        // (meaning Name is the template/type name, not repurposed as the label)
        const shape = textArea1 ? detectShape(nameField) : null;
        if (shape) detectedShapes.add(shape);

        const parent = getField(row, COL_CONTAINED);
        if (parent) nodeData.parent = parent;

        const comment = getField(row, COL_COMMENT);
        if (comment) nodeData.comment = comment;

        // Text Area 2+ as named properties
        for (let ti = 1; ti < textAreaCols.length; ti++) {
          const { name, i } = textAreaCols[ti];
          const val = getField(row, i);
          if (val) nodeData[name] = val;
        }

        // Custom columns → properties
        for (const { name, i } of customCols) {
          const val = getField(row, i);
          if (val) nodeData[name] = val;
        }

        nodes.push({ data: nodeData, classes: shape ? `lc-${shape}` : '' });
      }
    }

    // Drop edges referencing nodes that were skipped or don't exist
    const nodeIds    = new Set(nodes.map(n => n.data.id));
    const validEdges = edges.filter(
      e => nodeIds.has(e.data.source) && nodeIds.has(e.data.target)
    );

    // One stylesheet rule per detected shape class
    const userStylesheet = [...detectedShapes].map(shape => ({
      selector: `.lc-${shape}`,
      style: { shape },
    }));

    return {
      elements: { nodes, edges: validEdges },
      userStylesheet,
      version: '1.0.0',
    };
  },
};
