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
const TYPE_DEF_RE = /^([\w-]+)\s*:\s*([\w-]+)\s*,\s*(#[0-9A-Fa-f]{6})\s*,\s*(\d+)\s*(?:\/\/.*)?$/;

// Matches an entity assignment:  name: type=typename[, key=val]*
const ENTITY_ASSIGN_RE = /^([\w-]+)\s*:\s*type=([\w-]+)((?:\s*,\s*[\w-]+=(?:"[^"]*"|'[^']*'|[\w-]+))*)\s*(?:\/\/.*)?$/;

// Matches property pairs inside the extra part:  , key=value
const PROP_PAIR_RE = /,\s*([\w-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[\w-]+)/g;

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
  // Anchored: each ::rel must be on a single line; [^\]\n]* prevents newline-spanning
  const REL_RE = /^[ \t]*::rel[ \t]+([\w-]+)[ \t]+(->|<-|<->)[ \t]+([\w-]+)[ \t]+\[([^\]\n]*)\][ \t]*::[ \t]*$/gm;
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
 * Collect all [[EntityName]] references from prose (outside config/rel blocks).
 * Returns a Set of entity name strings.
 */
function parseEntityRefs(text) {
  const stripped = text
    .replace(/::config[\s\S]*?::/g, '')
    .replace(/::rel[^\n]*::/g, '');
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
  const stripped = text
    .replace(/::config[\s\S]*?::/g, '')
    .replace(/::rel[^\n]*::/g, '')
    .replace(/^#+.*/gm, '')
    .replace(/\[\[([\w-]+)\]\]/g, '$1');

  for (const chunk of stripped.split(/\n\n+/)) {
    const line = chunk.trim();
    if (line && !line.startsWith('#')) return line;
  }
  return '';
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Convert a DOT-LD markdown document into the Boxes graph format.
 *
 * @param {string} text - Raw DOT-LD markdown text
 * @returns {{ title, description, palette, elements, userStylesheet, version }}
 */
export function importFromDotLD(text) {
  const { typeDefs, entityAssignments } = parseConfigBlocks(text);
  const rels         = parseRelBlocks(text);
  const entityRefs   = parseEntityRefs(text);
  const title        = extractTitle(text);
  const description  = extractDescription(text);

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

    if (arrow === '<->') {
      // Bidirectional: emit two directed edges, both marked for round-trip export
      const pairId = `bidi_${edgeCounter++}`;
      edges.push({ data: { id: `${pairId}_f`, source, target, label, _dotldBidi: pairId } });
      edges.push({ data: { id: `${pairId}_r`, source: target, target: source, label, _dotldBidi: pairId } });
    } else if (arrow === '<-') {
      // Reversed: the named source *receives* the relationship from target
      edges.push({ data: { id: `e${edgeCounter++}`, source: target, target: source, label } });
    } else {
      edges.push({ data: { id: `e${edgeCounter++}`, source, target, label } });
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
 * @returns {string} DOT-LD markdown text
 */
export function exportToDotLD(boxesGraph) {
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
  import: (text) => importFromDotLD(text),
};

export const dotLdExporter = {
  name: 'DOT-LD Markdown',
  extension: '.md',
  mimeType: 'text/markdown',
  export: (editor) => exportToDotLD(editor.exportGraph()),
};
