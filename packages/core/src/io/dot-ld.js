/**
 * DOT-LD import/export for Boxes graph editor.
 *
 * DOT-LD (DOT Linked Data) is a markdown extension that enables embedding
 * formal knowledge graph structures within technical documentation.
 *
 * Spec: https://github.com/aws-samples/sample-dot-ld-knowledge-graph-syntax
 *
 * Syntax elements:
 *   ::config ... ::           – type definitions and entity assignments
 *   [[EntityName]]            – entity references in prose
 *   ::rel A -> B [label] ::   – directed relationship (also <- and <->)
 */

// ─── Shape mapping ────────────────────────────────────────────────────────────

const DOTLD_TO_CY_SHAPE = {
  'round-rectangle': 'roundrectangle',
  'rectangle': 'rectangle',
  'ellipse': 'ellipse',
  'circle': 'ellipse',
  'diamond': 'diamond',
};

const CY_TO_DOTLD_SHAPE = {
  'roundrectangle': 'round-rectangle',
  'rectangle': 'rectangle',
  'ellipse': 'ellipse',
  'diamond': 'diamond',
};

const DEFAULT_DOTLD_SHAPE = 'round-rectangle';
const DEFAULT_COLOR = '#888888';
const DEFAULT_SIZE = 80;

// ─── Internal field list ──────────────────────────────────────────────────────

/** Boxes fields that are not user properties and must not appear as DOT-LD entity properties */
const BOXES_INTERNAL = new Set([
  'id', 'source', 'target', 'label', 'labels',
  '_style', '_classes', '_arrowsStyle', '_dotldType', '_dotldBidi',
]);

// ─── Colour helper ────────────────────────────────────────────────────────────

function darkenColor(hex, factor = 0.65) {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return '#444444';
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0');
}

// ─── Config block parser ──────────────────────────────────────────────────────

// Matches a type definition:  name: shape, #RRGGBB, size
// Type names may be plain identifiers (equipment) or prefixed IRIs (owl:Class).
// They must start with a letter or underscore (not a digit) to be valid identifiers.
const TYPE_DEF_RE = /^([a-zA-Z_][a-zA-Z0-9_:.@-]*)\s*:\s*([\w-]+)\s*,\s*(#[0-9A-Fa-f]{6})\s*,\s*(\d+)\s*(?:\/\/.*)?$/;

// Matches an entity assignment:  name: type=typename[, key=val]*
// The type value may be a plain identifier or a prefixed IRI (e.g. owl:Class).
// Property keys support @-prefixed names (e.g. @id, @type) and colon-containing names
// (e.g. rdfs:label, skos:definition) for round-tripping RDF-enriched data.
// All identifiers (type names, keys) must start with a letter, underscore, or @.
const ENTITY_ASSIGN_RE = /^([\w-]+)\s*:\s*type=([a-zA-Z_][a-zA-Z0-9_:.@-]*)((?:\s*,\s*(?:@[a-zA-Z_][a-zA-Z0-9_.:-]*|[a-zA-Z_][a-zA-Z0-9_:.-]*)=(?:"[^"]*"|'[^']*'|[\w-]+))*)\s*(?:\/\/.*)?$/;

// Matches property pairs inside the extra part:  , key=value
// Quote contents are capped at 500 characters to prevent backtracking on unclosed quotes.
// Keys support @-prefixed names (@id, @type) and colon-containing prefixed IRIs.
// All keys must start with a letter, underscore, or @.
const PROP_PAIR_RE = /,\s*((?:@[a-zA-Z_][a-zA-Z0-9_.:-]*|[a-zA-Z_][a-zA-Z0-9_:.-]*))\s*=\s*("(?:[^"\\]|\\.){0,500}"|'(?:[^'\\]|\\.){0,500}'|[\w-]+)/g;

/**
 * Parse all ::config ... :: blocks from a DOT-LD document.
 * Returns { typeDefs: Map<name, {shape, color, size}>,
 *           entityAssignments: Map<name, {type, props}> }
 *
 * Uses string-based block extraction (rather than a greedy regex) to avoid
 * catastrophic backtracking on malformed input.
 */
function parseConfigBlocks(text) {
  const typeDefs = new Map();
  const entityAssignments = new Map();

  // Extract config block bodies using string search to avoid ReDoS
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const startMarker = text.indexOf('::config', searchFrom);
    if (startMarker === -1) break;

    const afterMarker = text.indexOf('\n', startMarker);
    if (afterMarker === -1) break;

    // Closing :: must be on its own line (preceded by \n)
    const endMarker = text.indexOf('\n::', afterMarker);
    if (endMarker === -1) break;

    const blockContent = text.slice(afterMarker + 1, endMarker);
    searchFrom = endMarker + 3;

    for (const rawLine of blockContent.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//')) continue;

      // Try entity assignment first (contains "type=")
      const eam = ENTITY_ASSIGN_RE.exec(line);
      if (eam) {
        const entityName = eam[1];
        const typeName = eam[2];
        const propsStr = eam[3] || '';
        const props = {};
        let pm;
        // Reset lastIndex because PROP_PAIR_RE has /g flag
        PROP_PAIR_RE.lastIndex = 0;
        while ((pm = PROP_PAIR_RE.exec(propsStr)) !== null) {
          let val = pm[2];
          if ((val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1).replace(/\\(.)/g, '$1');
          }
          props[pm[1]] = val;
        }
        entityAssignments.set(entityName, { type: typeName, props });
        continue;
      }

      // Try type definition
      const tdm = TYPE_DEF_RE.exec(line);
      if (tdm) {
        typeDefs.set(tdm[1], {
          shape: tdm[2],
          color: tdm[3],
          size: parseInt(tdm[4], 10),
        });
      }
    }
  }

  return { typeDefs, entityAssignments };
}

/**
 * Extract all ::rel blocks from text.
 * Returns array of { source, arrow, target, label }
 * arrow: '->' | '<-' | '<->'
 *
 * Anchored to single lines (m flag) to prevent cross-line backtracking.
 */
function parseRelBlocks(text) {
  const rels = [];
  // Anchored: each ::rel must be on a single line; [^\]\n]{0,200} caps label length
  // and prevents cross-line backtracking.
  const REL_RE = /^[ \t]*::rel[ \t]+([\w-]+)[ \t]+(->|<-|<->)[ \t]+([\w-]+)[ \t]+\[([^\]\n]{0,200})\][ \t]*::[ \t]*$/gm;
  let m;
  while ((m = REL_RE.exec(text)) !== null) {
    rels.push({
      source: m[1],
      arrow:  m[2],
      target: m[3],
      label:  m[4].trim(),
    });
  }
  return rels;
}

/**
 * Remove all ::config ... :: block bodies from text using string search,
 * replacing each block (start marker through closing ::) with whitespace
 * so that line numbers are preserved.
 */
function stripConfigBlocks(text) {
  let result = text;
  let offset = 0;
  while (offset < result.length) {
    const start = result.indexOf('::config', offset);
    if (start === -1) break;
    const afterStart = result.indexOf('\n', start);
    if (afterStart === -1) break;
    const end = result.indexOf('\n::', afterStart);
    if (end === -1) break;
    // Replace the block content with newlines to preserve paragraph structure
    result = result.slice(0, start) + result.slice(end + 3);
    offset = start;
  }
  return result;
}

/**
 * Collect all [[EntityName]] references from prose (outside config/rel blocks).
 * Returns a Set of entity name strings.
 */
function parseEntityRefs(text) {
  const stripped = stripConfigBlocks(text)
    .replace(/^[ \t]*::rel[^\n]*::[ \t]*$/gm, '');
  const refs = new Set();
  const REF_RE = /\[\[([\w-]+)\]\]/g;
  let m;
  while ((m = REF_RE.exec(stripped)) !== null) {
    refs.add(m[1]);
  }
  return refs;
}

/** Extract the document title from the first level-1 Markdown heading. */
function extractTitle(text) {
  const m = text.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : '';
}

/**
 * Extract the first non-empty prose paragraph (not a heading, not a DOT-LD
 * block, not a list marker) to use as the document description.
 */
function extractDescription(text) {
  const stripped = stripConfigBlocks(text)
    .replace(/^[ \t]*::rel[^\n]*::[ \t]*$/gm, '')
    .replace(/^#+.*/gm, '')
    .replace(/\[\[([\w-]+)\]\]/g, '$1');

  for (const chunk of stripped.split(/\n\n+/)) {
    const line = chunk.trim();
    if (line && !line.startsWith('#')) return line;
  }
  return '';
}

// ─── Palette type lookup helpers ──────────────────────────────────────────────

/**
 * Build lookup maps for palette nodeTypes (by id and by label).
 */
function buildNodeTypeLookup(nodeTypes) {
  const byId    = new Map();
  const byLabel = new Map();
  for (const nt of (nodeTypes || [])) {
    if (nt.id)    byId.set(nt.id, nt);
    if (nt.label) byLabel.set(nt.label, nt);
  }
  return (name) => byId.get(name) || byLabel.get(name) || null;
}

/**
 * Build a lookup function for palette edgeTypes.
 * Matches by: label → id → local name of data['@id'].
 */
function buildEdgeTypeLookup(edgeTypes) {
  const byLabel   = new Map();
  const byId      = new Map();
  const byLocalId = new Map();

  for (const et of (edgeTypes || [])) {
    if (et.label) byLabel.set(et.label, et);
    if (et.id)    byId.set(et.id, et);
    if (et.data?.['@id']) {
      const atId = et.data['@id'];
      // Find the last namespace separator (`:` for prefix, `#` for fragment).
      // Math.max returns the greater position; both return -1 when absent, so
      // if only one separator exists the other -1 is safely ignored.
      const sep  = Math.max(atId.lastIndexOf(':'), atId.lastIndexOf('#'));
      if (sep !== -1) {
        const local = atId.slice(sep + 1);
        if (local && !byLocalId.has(local)) byLocalId.set(local, et);
      }
    }
  }

  return (label) =>
    byLabel.get(label) || byId.get(label) || byLocalId.get(label) || null;
}

/**
 * Merge palette type data fields into an element's data object.
 * Template values are applied only when the data key is not already present.
 * Empty string, null and undefined template values are skipped.
 */
function mergeTypeData(data, typeData) {
  if (!typeData) return;
  for (const [k, v] of Object.entries(typeData)) {
    if (v === '' || v === null || v === undefined) continue;
    if (!(k in data)) data[k] = v;
  }
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Convert a DOT-LD markdown document into the Boxes graph format.
 *
 * @param {string} text    - Raw DOT-LD markdown text
 * @param {object} options
 *   @param {object} options.context   - Prefix → namespace map (passed through for context)
 *   @param {Array}  options.nodeTypes - Palette node type definitions; used to enrich nodes
 *                                       with RDF data (@type, @id, …) from the matching type.
 *   @param {Array}  options.edgeTypes - Palette edge type definitions; used to enrich edges
 *                                       with RDF data (@id for plain triples, @type for
 *                                       reified edges, etc.) matched by relationship label.
 * @returns {{ title, description, palette, elements, userStylesheet, version }}
 */
export function importFromDotLD(text, options = {}) {
  const { typeDefs, entityAssignments } = parseConfigBlocks(text);
  const rels         = parseRelBlocks(text);
  const entityRefs   = parseEntityRefs(text);
  const title        = extractTitle(text);
  const description  = extractDescription(text);

  const findPaletteNodeType = buildNodeTypeLookup(options.nodeTypes);
  const findPaletteEdgeType = buildEdgeTypeLookup(options.edgeTypes);

  // ── Collect all entity names ──────────────────────────────────────────────
  const allEntityNames = new Set([
    ...entityAssignments.keys(),
    ...entityRefs,
    ...rels.flatMap(r => [r.source, r.target]),
  ]);

  // ── Determine whether any entities lack an explicit type ──────────────────
  const hasUndefined = [...allEntityNames].some(n => !entityAssignments.has(n));

  // ── Build palette nodeTypes from type definitions ─────────────────────────
  const nodeTypes = [];
  for (const [typeName, td] of typeDefs) {
    const cyShape = DOTLD_TO_CY_SHAPE[td.shape] || 'roundrectangle';
    nodeTypes.push({
      id:          typeName,
      label:       typeName,
      data:        { _dotldType: typeName },
      color:       td.color,
      borderColor: darkenColor(td.color),
      shape:       cyShape,
      _dotldSize:  td.size,
    });
  }

  if (hasUndefined) {
    nodeTypes.push({
      id:          '_undefined',
      label:       'Entity',
      data:        { _dotldType: '_undefined' },
      color:       '#DDDDDD',
      borderColor: '#888888',
      shape:       'roundrectangle',
    });
  }

  // ── Build palette edgeTypes from relationship labels ──────────────────────
  const edgeLabelSet = new Set(rels.map(r => r.label).filter(Boolean));
  const edgeTypes = edgeLabelSet.size > 0
    ? [...edgeLabelSet].map(label => ({
        id:        label,
        label,
        data:      {},
        color:     '#555555',
        lineStyle: 'solid',
      }))
    : [{ id: 'default', label: 'edge', data: {}, color: '#666666', lineStyle: 'solid' }];

  // ── Build nodes ───────────────────────────────────────────────────────────
  const nodeTypeMap = new Map(nodeTypes.map(nt => [nt.id, nt]));
  const nodes = [];

  for (const name of allEntityNames) {
    const assignment = entityAssignments.get(name);
    const typeName   = assignment?.type || '_undefined';

    const data = {
      id:         name,
      label:      name,
      _dotldType: typeName,
      ...(assignment?.props || {}),
    };

    // Enrich with palette nodeType data (@type, @id, etc.) when available.
    // Template values are only applied for keys not already set by the entity assignment.
    const paletteNt = findPaletteNodeType(typeName);
    mergeTypeData(data, paletteNt?.data);

    const nt = nodeTypeMap.get(typeName);
    if (nt?._dotldSize) {
      data._style = {
        'width':  nt._dotldSize,
        'height': Math.round(nt._dotldSize * 0.55),
      };
    }

    nodes.push({ data, classes: `dotld-type-${typeName}` });
  }

  // ── Build edges ───────────────────────────────────────────────────────────
  const edges = [];
  let edgeCounter = 0;

  for (const rel of rels) {
    const { source, arrow, target, label } = rel;

    // Enrich edge data with palette edgeType fields (@id for plain triples,
    // @type / other data fields for reified edges), matched by relationship label.
    const paletteEt = findPaletteEdgeType(label);
    const extraEdgeData = {};
    if (paletteEt?.data) {
      for (const [k, v] of Object.entries(paletteEt.data)) {
        if (v !== '' && v !== null && v !== undefined) extraEdgeData[k] = v;
      }
    }

    if (arrow === '<->') {
      // Bidirectional: emit two directed edges, both marked for round-trip export
      const pairId = `bidi_${edgeCounter++}`;
      edges.push({ data: { id: `${pairId}_f`, source, target, label, _dotldBidi: pairId, ...extraEdgeData } });
      edges.push({ data: { id: `${pairId}_r`, source: target, target: source, label, _dotldBidi: pairId, ...extraEdgeData } });
    } else if (arrow === '<-') {
      // Reversed: the named source *receives* the relationship from target
      edges.push({ data: { id: `e${edgeCounter++}`, source: target, target: source, label, ...extraEdgeData } });
    } else {
      edges.push({ data: { id: `e${edgeCounter++}`, source, target, label, ...extraEdgeData } });
    }
  }

  // ── Build userStylesheet from type definitions ────────────────────────────
  const userStylesheet = [];
  for (const [typeName, td] of typeDefs) {
    const cyShape = DOTLD_TO_CY_SHAPE[td.shape] || 'roundrectangle';
    userStylesheet.push({
      selector: `.dotld-type-${typeName}`,
      style: {
        'background-color': td.color,
        'border-color':     darkenColor(td.color),
        'border-width':     2,
        'shape':            cyShape,
        'width':            td.size,
        'height':           Math.round(td.size * 0.55),
        'color':            '#000000',
        'font-size':        12,
        'text-valign':      'center',
        'text-halign':      'center',
      },
    });
  }

  if (hasUndefined) {
    userStylesheet.push({
      selector: '.dotld-type-_undefined',
      style: {
        'background-color': '#DDDDDD',
        'border-color':     '#888888',
        'border-width':     2,
        'shape':            'roundrectangle',
        'color':            '#000000',
        'font-size':        12,
        'text-valign':      'center',
        'text-halign':      'center',
      },
    });
  }

  return {
    title,
    description,
    palette: { nodeTypes, edgeTypes },
    elements: { nodes, edges },
    userStylesheet,
    version: '1.0.0',
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

function escapePropertyValue(value) {
  const str = String(value);
  if (/^[\w-]+$/.test(str)) return str;
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Convert a Boxes graph (as returned by editor.exportGraph()) into a DOT-LD
 * markdown document.
 *
 * @param {object} boxesGraph - Result of BoxesEditor.exportGraph()
 * @param {object} options
 *   @param {object} options.context   - Prefix → namespace map (reserved for future use)
 *   @param {Array}  options.edgeTypes - Palette edge type definitions (reserved for future use)
 * @returns {string} DOT-LD markdown text
 */
export function exportToDotLD(boxesGraph, { context = {}, edgeTypes = [] } = {}) {
  const { title = '', description = '', palette, elements } = boxesGraph;
  const nodes     = elements?.nodes || [];
  const edges     = elements?.edges || [];
  const nodeTypes = palette?.nodeTypes || [];

  const lines = [];

  // ── Document title ────────────────────────────────────────────────────────
  lines.push(`# ${title || 'Knowledge Graph'}`, '');
  if (description) lines.push(description, '');

  // ── Config block ──────────────────────────────────────────────────────────
  lines.push('::config');

  // Type definitions
  const typesToEmit = nodeTypes.filter(nt => nt.id !== '_undefined');
  if (typesToEmit.length > 0) {
    lines.push('// Type definitions');
    for (const nt of typesToEmit) {
      const dotldShape = CY_TO_DOTLD_SHAPE[nt.shape] || DEFAULT_DOTLD_SHAPE;
      const color      = nt.color || DEFAULT_COLOR;
      const size       = nt._dotldSize || DEFAULT_SIZE;
      lines.push(`${nt.id}: ${dotldShape}, ${color}, ${size}`);
    }
    lines.push('');
  }

  // Entity assignments
  if (nodes.length > 0) {
    lines.push('// Entity assignments');
    for (const node of nodes) {
      const { id, _dotldType, ...rest } = node.data;
      const typeName = _dotldType && _dotldType !== '_undefined' ? _dotldType : 'entity';

      const propParts = [];
      for (const [k, v] of Object.entries(rest)) {
        if (BOXES_INTERNAL.has(k)) continue;
        if (v === '' || v === undefined || v === null) continue;
        propParts.push(`${k}=${escapePropertyValue(v)}`);
      }

      const propsStr = propParts.length > 0 ? ', ' + propParts.join(', ') : '';
      lines.push(`${id}: type=${typeName}${propsStr}`);
    }
  }

  lines.push('::', '');

  // ── Entity references in prose ────────────────────────────────────────────
  if (nodes.length > 0) {
    lines.push('## Entities', '');
    const mentions = nodes.map(n => `[[${n.data.id}]]`).join(', ');
    lines.push(`This knowledge graph contains the following entities: ${mentions}.`, '');
  }

  // ── Relationship blocks ───────────────────────────────────────────────────
  if (edges.length > 0) {
    lines.push('## Relationships', '');
    // Deduplicate <-> pairs: the importer generates two directed edges sharing
    // the same _dotldBidi token; we emit a single <-> for each pair.
    const emittedBidiTokens = new Set();
    for (const edge of edges) {
      const { source, target, label, _dotldBidi } = edge.data;
      const edgeLabel = label || 'related';

      if (_dotldBidi) {
        if (emittedBidiTokens.has(_dotldBidi)) continue;
        emittedBidiTokens.add(_dotldBidi);
        lines.push(`::rel ${source} <-> ${target} [${edgeLabel}] ::`);
      } else {
        lines.push(`::rel ${source} -> ${target} [${edgeLabel}] ::`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Importer / exporter descriptors ─────────────────────────────────────────

export const dotLdImporter = {
  name: 'DOT-LD Markdown',
  extensions: ['.md'],
  mimeTypes: ['text/markdown', 'text/plain'],
  import: (text, options) => importFromDotLD(text, options),
};

export const dotLdExporter = {
  name: 'DOT-LD Markdown',
  extension: '.md',
  mimeType: 'text/markdown',
  export: (editor, options) => exportToDotLD(editor.exportGraph(), {
    context:   editor.context || {},
    edgeTypes: editor.getEdgeTypes ? editor.getEdgeTypes() : [],
    ...(options || {}),
  }),
};
