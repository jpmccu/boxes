/**
 * Arrows.app import/export for Boxes graph editor.
 *
 * Arrows.app format reference: https://github.com/neo4j-labs/arrows.app
 *
 * Arrows stores graphs as JSON with this shape:
 *   { nodes: [...], relationships: [...], style: {...} }
 * or wrapped:
 *   { graph: { nodes, relationships, style }, ... }
 *
 * Node fields:   id, position{x,y}, caption, labels[], properties{}, style{}
 * Rel fields:    id, fromId, toId, type, properties{}, style{}
 *
 * Style translation
 * -----------------
 * Arrows uses its own CSS-like property names; Cytoscape uses different ones.
 * We map the common ones on import and reverse them on export.  Unknown
 * Arrows style properties are stored under data._arrowsStyle so they survive
 * a round-trip even if they have no Cytoscape equivalent.
 */

// ─── Internal field lists ─────────────────────────────────────────────────────

/** Boxes data fields that are not user properties */
const BOXES_INTERNAL = new Set([
  'id', 'source', 'target', 'label', 'labels',
  '_style', '_classes', '_arrowsStyle',
]);

// ─── Style translation tables ─────────────────────────────────────────────────

const ARROWS_NODE_STYLE_TO_CYTOSCAPE = {
  'node-color':        'background-color',
  'border-color':      'border-color',
  'border-width':      'border-width',
  'caption-color':     'color',
  'caption-font-size': 'font-size',
  'caption-font':      'font-family',
};

const ARROWS_REL_STYLE_TO_CYTOSCAPE = {
  'arrow-color':  null,   // fan-out: see _arrowsStyleToEdge
  'line-color':   'line-color',
  'arrow-width':  'width',
  'text-color':   'color',
  'font-size':    'font-size',
};

const CYTOSCAPE_NODE_STYLE_TO_ARROWS = Object.fromEntries(
  Object.entries(ARROWS_NODE_STYLE_TO_CYTOSCAPE)
    .filter(([, v]) => v !== null)
    .map(([a, c]) => [c, a])
);

const CYTOSCAPE_EDGE_STYLE_TO_ARROWS = {
  'line-color':           'line-color',
  'target-arrow-color':   'arrow-color',
  'width':                'arrow-width',
  'color':                'text-color',
  'font-size':            'font-size',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _arrowsNodeStyleToCytoscape(arrowsStyle) {
  const cyStyle = {};
  const leftover = {};
  for (const [key, value] of Object.entries(arrowsStyle)) {
    if (key === 'node-size') {
      const size = Number(value);
      if (!isNaN(size)) {
        cyStyle['width'] = size;
        cyStyle['height'] = size;
      }
      continue;
    }
    const cyKey = ARROWS_NODE_STYLE_TO_CYTOSCAPE[key];
    if (cyKey) {
      cyStyle[cyKey] = value;
    } else {
      leftover[key] = value;
    }
  }
  return { cyStyle, leftover };
}

function _arrowsEdgeStyleToCytoscape(arrowsStyle) {
  const cyStyle = {};
  const leftover = {};
  for (const [key, value] of Object.entries(arrowsStyle)) {
    if (key === 'arrow-color') {
      cyStyle['line-color'] = value;
      cyStyle['target-arrow-color'] = value;
      cyStyle['source-arrow-color'] = value;
      continue;
    }
    const cyKey = ARROWS_REL_STYLE_TO_CYTOSCAPE[key];
    if (cyKey) {
      cyStyle[cyKey] = value;
    } else {
      leftover[key] = value;
    }
  }
  return { cyStyle, leftover };
}

function _cytoscapeNodeStyleToArrows(cyStyle) {
  const arrowsStyle = {};
  let width, height;
  for (const [key, value] of Object.entries(cyStyle)) {
    if (key === 'width')  { width  = value; continue; }
    if (key === 'height') { height = value; continue; }
    const aKey = CYTOSCAPE_NODE_STYLE_TO_ARROWS[key];
    if (aKey) arrowsStyle[aKey] = value;
  }
  if (width !== undefined || height !== undefined) {
    arrowsStyle['node-size'] = width ?? height;
  }
  return arrowsStyle;
}

function _cytoscapeEdgeStyleToArrows(cyStyle) {
  const arrowsStyle = {};
  for (const [key, value] of Object.entries(cyStyle)) {
    const aKey = CYTOSCAPE_EDGE_STYLE_TO_ARROWS[key];
    if (aKey && !arrowsStyle[aKey]) arrowsStyle[aKey] = value; // first wins
  }
  return arrowsStyle;
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Convert an Arrows.app JSON object into the Boxes graph format.
 *
 * @param {object} arrowsData - Parsed Arrows.app JSON
 * @returns {{ elements: { nodes: object[], edges: object[] }, userStylesheet: object[] }}
 */
export function importFromArrows(arrowsData) {
  // Support both the flat format and the { graph: {...} } wrapper
  const raw = arrowsData?.graph ?? arrowsData;
  if (!raw || !Array.isArray(raw.nodes)) {
    throw new Error('Invalid Arrows.app format: missing nodes array');
  }

  const nodes = raw.nodes.map(n => {
    const { cyStyle, leftover } = _arrowsNodeStyleToCytoscape(n.style || {});

    const data = {
      id: n.id,
      label: n.caption || '',
    };

    // Multi-label support: store as array under `labels`
    if (Array.isArray(n.labels) && n.labels.length > 0) {
      data.labels = n.labels;
    }

    // User properties
    for (const [k, v] of Object.entries(n.properties || {})) {
      if (!BOXES_INTERNAL.has(k)) data[k] = v;
    }

    if (Object.keys(cyStyle).length > 0) data._style = cyStyle;
    if (Object.keys(leftover).length > 0) data._arrowsStyle = leftover;

    const node = { data };
    if (n.position) node.position = { x: n.position.x, y: n.position.y };
    return node;
  });

  const nodeIds = new Set(nodes.map(n => n.data.id));

  const edges = (raw.relationships || [])
    .filter(r => nodeIds.has(r.fromId) && nodeIds.has(r.toId))
    .map(r => {
      const { cyStyle, leftover } = _arrowsEdgeStyleToCytoscape(r.style || {});

      const data = {
        id: r.id,
        source: r.fromId,
        target: r.toId,
        label: r.type || '',
      };

      for (const [k, v] of Object.entries(r.properties || {})) {
        if (!BOXES_INTERNAL.has(k)) data[k] = v;
      }

      if (Object.keys(cyStyle).length > 0) data._style = cyStyle;
      if (Object.keys(leftover).length > 0) data._arrowsStyle = leftover;

      return { data };
    });

  return {
    elements: { nodes, edges },
    userStylesheet: [],
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Convert a Boxes graph (as returned by editor.exportGraph()) into the
 * Arrows.app JSON format.
 *
 * @param {object} boxesGraph - Result of BoxesEditor.exportGraph()
 * @returns {object} Arrows.app JSON object (ready to JSON.stringify)
 */
export function exportToArrows(boxesGraph) {
  const { nodes: boxesNodes = [], edges: boxesEdges = [] } =
    boxesGraph?.elements ?? {};

  const nodes = boxesNodes.map(n => {
    const { id, label, labels, _style, _arrowsStyle, ...rest } = n.data;

    // Strip internal/non-property fields
    const properties = {};
    for (const [k, v] of Object.entries(rest)) {
      if (!BOXES_INTERNAL.has(k)) properties[k] = v;
    }

    const arrowsStyle = {
      ..._cytoscapeNodeStyleToArrows(_style || {}),
      ...(_arrowsStyle || {}),     // restore original Arrows-only style props
    };

    return {
      id,
      position: n.position ?? { x: 0, y: 0 },
      caption: label || '',
      labels: Array.isArray(labels) ? labels : (label ? [label] : []),
      properties,
      style: arrowsStyle,
    };
  });

  const relationships = boxesEdges.map(e => {
    const { id, source, target, label, _style, _arrowsStyle, ...rest } = e.data;

    const properties = {};
    for (const [k, v] of Object.entries(rest)) {
      if (!BOXES_INTERNAL.has(k)) properties[k] = v;
    }

    const arrowsStyle = {
      ..._cytoscapeEdgeStyleToArrows(_style || {}),
      ...(_arrowsStyle || {}),
    };

    return {
      id,
      fromId: source,
      toId: target,
      type: label || '',
      properties,
      style: arrowsStyle,
    };
  });

  return { nodes, relationships, style: {} };
}

// ─── Importer / exporter descriptors (for use with BoxesEditor) ──────────────

export const arrowsImporter = {
  label: 'Arrows.app JSON',
  extension: '.json',
  mimeType: 'application/json',
  import: (text) => importFromArrows(JSON.parse(text)),
};

export const arrowsExporter = {
  label: 'Arrows.app JSON',
  extension: '.json',
  mimeType: 'application/json',
  export: (graph) => JSON.stringify(exportToArrows(graph), null, 2),
};
