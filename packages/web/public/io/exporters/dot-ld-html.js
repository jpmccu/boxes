/**
 * DOT-LD HTML Page exporter for Boxes graph editor.
 *
 * Produces a standalone ontology-browsing HTML page in the style of LODE
 * (Live OWL Documentation Environment), using graph and ontology-level
 * metadata for the introductory elements.
 *
 * The page includes:
 *   - Metadata header (title, description, generation date, entity/relationship counts)
 *   - Table of contents
 *   - Entity Types section  (palette node types → analogous to OWL Classes)
 *   - Entities section      (nodes grouped by type, with properties and relationships)
 *   - Relationships section (tabular index of all edges)
 */

// ─── HTML utilities ───────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(str) {
  return String(str ?? '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function entityAnchor(id) {
  return `entity-${slugify(id)}`;
}

function typeAnchor(id) {
  return `type-${slugify(id)}`;
}

function entityLink(id) {
  return `<a href="#${entityAnchor(id)}">${esc(id)}</a>`;
}

function typeLink(id) {
  return `<a href="#${typeAnchor(id)}">${esc(id)}</a>`;
}

// ─── Colour swatch ────────────────────────────────────────────────────────────

function colorSwatch(hex) {
  if (!hex) return '';
  return `<span class="color-swatch" style="background:${esc(hex)};border-color:${esc(hex)}"></span>`;
}

// ─── Ontology metadata extraction ────────────────────────────────────────────

/**
 * Find ontology-level metadata from the graph.
 *
 * Looks for a node whose @type is 'owl:Ontology' or whose _dotldType indicates
 * it is an ontology node.  Falls back to graph.title / graph.description.
 */
function extractOntologyMeta(graph) {
  const nodes   = graph.elements?.nodes || [];
  const meta    = {};

  // Look for an owl:Ontology node or similarly typed node
  const ontNode = nodes.find(n => {
    const t = n.data['@type'] || n.data._dotldType || '';
    return t === 'owl:Ontology' || t.toLowerCase().includes('ontology');
  });

  if (ontNode) {
    const d = ontNode.data;
    meta.iri         = d['@id']                        || d.iri           || '';
    meta.versionIRI  = d['owl:versionIRI']             || d.versionIRI    || '';
    meta.versionInfo = d['owl:versionInfo']            || d.versionInfo   || '';
    meta.creator     = d['dcterms:creator']            || d.creator       || d['dc:creator'] || '';
    meta.publisher   = d['dcterms:publisher']          || d.publisher     || '';
    meta.license     = d['dcterms:license']            || d.license       || '';
    meta.issued      = d['dcterms:issued']             || d.issued        || '';
    // Use node label/id as title fallback
    meta.title       = graph.title || d.label          || d['@id']        || 'Knowledge Graph';
    meta.description = graph.description
      || d['dcterms:description'] || d.description
      || d['rdfs:comment']        || d.comment         || '';
  } else {
    meta.title       = graph.title       || 'Knowledge Graph';
    meta.description = graph.description || '';
  }

  return meta;
}

// ─── Main page builder ────────────────────────────────────────────────────────

function buildHtmlPage(graph) {
  const meta      = extractOntologyMeta(graph);
  const nodes     = graph.elements?.nodes || [];
  const edges     = graph.elements?.edges || [];
  const nodeTypes = (graph.palette?.nodeTypes || []).filter(nt => nt.id !== '_undefined');
  const generated = new Date().toISOString().split('T')[0];

  // ── Build lookup structures ──────────────────────────────────────────────
  const nodeById  = new Map(nodes.map(n => [n.data.id, n]));

  // Index incoming / outgoing edges per node
  const outgoing  = new Map(nodes.map(n => [n.data.id, []]));
  const incoming  = new Map(nodes.map(n => [n.data.id, []]));
  for (const edge of edges) {
    const { source, target } = edge.data;
    if (outgoing.has(source)) outgoing.get(source).push(edge);
    if (incoming.has(target)) incoming.get(target).push(edge);
  }

  // Group nodes by type
  const nodesByType = new Map();
  for (const nt of nodeTypes) nodesByType.set(nt.id, []);
  const untypedNodes = [];

  for (const node of nodes) {
    const typeName = node.data._dotldType
      || (node.data['@type'] && nodeTypes.find(nt => nt.id === node.data['@type'])?.id)
      || null;
    if (typeName && nodesByType.has(typeName)) {
      nodesByType.get(typeName).push(node);
    } else {
      untypedNodes.push(node);
    }
  }

  // ── Sections ─────────────────────────────────────────────────────────────

  // 1. Entity types
  const entityTypesSections = nodeTypes.map(nt => {
    const members = nodesByType.get(nt.id) || [];
    const dotldShape = nt.shape
      ? { roundrectangle: 'round-rectangle', rectangle: 'rectangle', ellipse: 'ellipse', diamond: 'diamond' }[nt.shape] || nt.shape
      : 'round-rectangle';

    const memberLinks = members.length
      ? members.map(n => entityLink(n.data.id)).join(', ')
      : '<em>(no entities)</em>';

    return `
    <div class="entity-type-entry" id="${esc(typeAnchor(nt.id))}">
      <h3>${colorSwatch(nt.color)}${esc(nt.id)}</h3>
      <dl>
        <dt>Shape</dt><dd>${esc(dotldShape)}</dd>
        <dt>Color</dt><dd>${colorSwatch(nt.color)} ${esc(nt.color || '—')}</dd>
        ${nt._dotldSize ? `<dt>Size</dt><dd>${esc(nt._dotldSize)}</dd>` : ''}
        <dt>Members (${members.length})</dt><dd>${memberLinks}</dd>
      </dl>
    </div>`;
  }).join('\n');

  // 2. Entities
  const renderNode = (node) => {
    const d         = node.data;
    const typeName  = d._dotldType || d['@type'] || '';
    const typeLabel = typeName && nodeTypes.find(nt => nt.id === typeName)
      ? typeLink(typeName) : esc(typeName) || '<em>untyped</em>';

    // User properties (non-internal)
    const internalKeys = new Set(['id', 'label', '_dotldType', '_style', '_classes', '_dotldBidi']);
    const propRows = Object.entries(d)
      .filter(([k]) => !internalKeys.has(k) && !k.startsWith('_'))
      .map(([k, v]) => `<tr><td class="prop-key">${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join('');

    const propTable = propRows
      ? `<table class="props-table"><thead><tr><th>Property</th><th>Value</th></tr></thead><tbody>${propRows}</tbody></table>`
      : '<em>(no additional properties)</em>';

    // Outgoing relationships
    const outEdges = outgoing.get(d.id) || [];
    const outList  = outEdges.length
      ? '<ul>' + outEdges.map(e => {
          const lbl = e.data.label || '—';
          const tgt = e.data.target;
          return `<li><span class="rel-label">${esc(lbl)}</span> → ${nodeById.has(tgt) ? entityLink(tgt) : esc(tgt)}</li>`;
        }).join('') + '</ul>'
      : '<em>(none)</em>';

    // Incoming relationships
    const inEdges = incoming.get(d.id) || [];
    const inList  = inEdges.length
      ? '<ul>' + inEdges.map(e => {
          const lbl = e.data.label || '—';
          const src = e.data.source;
          return `<li>${nodeById.has(src) ? entityLink(src) : esc(src)} <span class="rel-label">${esc(lbl)}</span> →</li>`;
        }).join('') + '</ul>'
      : '<em>(none)</em>';

    return `
    <div class="entity-entry" id="${esc(entityAnchor(d.id))}">
      <h3>${esc(d.label || d.id)}</h3>
      <dl>
        <dt>Type</dt><dd>${typeLabel}</dd>
        <dt>Properties</dt><dd>${propTable}</dd>
        <dt>Outgoing relationships</dt><dd>${outList}</dd>
        <dt>Incoming relationships</dt><dd>${inList}</dd>
      </dl>
    </div>`;
  };

  const typedEntitiesHtml = nodeTypes.map(nt => {
    const members = nodesByType.get(nt.id) || [];
    if (members.length === 0) return '';
    return `<div class="type-group">
      <h3 class="type-group-heading">${colorSwatch(nt.color)}${esc(nt.id)}</h3>
      ${members.map(renderNode).join('\n')}
    </div>`;
  }).join('\n');

  const untypedEntitiesHtml = untypedNodes.length
    ? `<div class="type-group">
        <h3 class="type-group-heading">Untyped Entities</h3>
        ${untypedNodes.map(renderNode).join('\n')}
      </div>`
    : '';

  // 3. Relationships table
  const relRows = edges.map(e => {
    const { source, target, label } = e.data;
    const srcLink = nodeById.has(source) ? entityLink(source) : esc(source);
    const tgtLink = nodeById.has(target) ? entityLink(target) : esc(target);
    return `<tr><td>${srcLink}</td><td class="rel-label">${esc(label || '—')}</td><td>${tgtLink}</td></tr>`;
  }).join('\n');

  const relTable = relRows
    ? `<table class="rel-table">
        <thead><tr><th>Source</th><th>Relationship</th><th>Target</th></tr></thead>
        <tbody>${relRows}</tbody>
       </table>`
    : '<p><em>No relationships defined.</em></p>';

  // ── TOC entries ───────────────────────────────────────────────────────────
  let tocCounter = 1;
  const tocItems = [];
  if (nodeTypes.length > 0)        tocItems.push({ n: tocCounter++, id: 'entity-types',  label: 'Entity Types' });
  if (nodes.length > 0)            tocItems.push({ n: tocCounter++, id: 'entities',       label: 'Entities' });
  if (edges.length > 0)            tocItems.push({ n: tocCounter++, id: 'relationships',  label: 'Relationships' });

  const tocHtml = tocItems.map(t =>
    `<li><a href="#${t.id}">${t.n}. ${t.label}</a></li>`
  ).join('\n');

  // ── Metadata DL entries ───────────────────────────────────────────────────
  const metaRows = [
    meta.iri         && `<dt>IRI</dt><dd><code>${esc(meta.iri)}</code></dd>`,
    meta.versionIRI  && `<dt>Version IRI</dt><dd><code>${esc(meta.versionIRI)}</code></dd>`,
    meta.versionInfo && `<dt>Version</dt><dd>${esc(meta.versionInfo)}</dd>`,
    meta.creator     && `<dt>Author</dt><dd>${esc(meta.creator)}</dd>`,
    meta.publisher   && `<dt>Publisher</dt><dd>${esc(meta.publisher)}</dd>`,
    meta.license     && `<dt>License</dt><dd>${esc(meta.license)}</dd>`,
    meta.issued      && `<dt>Issued</dt><dd>${esc(meta.issued)}</dd>`,
    `<dt>Generated</dt><dd>${esc(generated)}</dd>`,
    `<dt>Entities</dt><dd>${esc(nodes.length)}</dd>`,
    `<dt>Relationships</dt><dd>${esc(edges.length)}</dd>`,
  ].filter(Boolean).join('\n');

  // ── Assemble page ─────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(meta.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #222;
      background: #fff;
      margin: 0;
      padding: 0;
    }

    /* Layout */
    #page-wrapper { display: flex; min-height: 100vh; }

    #sidebar {
      width: 240px;
      min-width: 200px;
      flex-shrink: 0;
      background: #f4f6f8;
      border-right: 1px solid #dce0e6;
      padding: 1.5rem 1rem;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }

    #sidebar h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin: 0 0 0.5rem; }
    #sidebar ul { list-style: none; padding: 0; margin: 0; }
    #sidebar li { margin: 0.25rem 0; }
    #sidebar a  { color: #2471A3; text-decoration: none; font-size: 0.9rem; }
    #sidebar a:hover { text-decoration: underline; }

    #main {
      flex: 1;
      padding: 2rem 2.5rem;
      max-width: 900px;
    }

    /* Header */
    #header { border-bottom: 3px solid #2471A3; padding-bottom: 1.5rem; margin-bottom: 2rem; }
    #header h1 { font-size: 1.8rem; margin: 0 0 0.75rem; color: #1a3a5c; }

    #meta-dl { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; margin: 0; font-size: 0.88rem; }
    #meta-dl dt { font-weight: 600; color: #555; white-space: nowrap; }
    #meta-dl dd { margin: 0; color: #333; }
    #meta-dl code { font-family: monospace; font-size: 0.85em; background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 3px; }

    #description { margin-top: 1rem; color: #444; }

    /* Sections */
    section { margin-bottom: 3rem; }
    section > h2 {
      font-size: 1.3rem;
      border-bottom: 2px solid #dce0e6;
      padding-bottom: 0.4rem;
      color: #1a3a5c;
      margin-bottom: 1.5rem;
    }

    /* Entity type entries */
    .entity-type-entry {
      background: #f9fafc;
      border: 1px solid #dce0e6;
      border-radius: 6px;
      padding: 1rem 1.25rem;
      margin-bottom: 1rem;
    }
    .entity-type-entry h3 { margin: 0 0 0.5rem; font-size: 1rem; color: #1a3a5c; }

    /* Entity entries */
    .type-group { margin-bottom: 2rem; }
    .type-group-heading {
      font-size: 1rem;
      font-weight: 700;
      color: #555;
      border-bottom: 1px dashed #dce0e6;
      padding-bottom: 0.25rem;
      margin: 1.5rem 0 0.75rem;
    }

    .entity-entry {
      background: #fff;
      border: 1px solid #dce0e6;
      border-left: 4px solid #2471A3;
      border-radius: 4px;
      padding: 0.9rem 1.1rem;
      margin-bottom: 1rem;
    }
    .entity-entry h3 { margin: 0 0 0.5rem; font-size: 0.95rem; font-weight: 700; color: #1a3a5c; }

    /* Definition lists */
    dl { margin: 0; }
    dl dt { font-weight: 600; color: #555; font-size: 0.85rem; margin-top: 0.5rem; }
    dl dd { margin: 0 0 0.25rem 0; font-size: 0.9rem; }
    dl dd ul { margin: 0.25rem 0 0; padding-left: 1.2rem; }
    dl dd ul li { margin: 0.15rem 0; }

    /* Tables */
    .props-table, .rel-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
      margin-top: 0.25rem;
    }
    .props-table th, .props-table td,
    .rel-table th,  .rel-table td {
      border: 1px solid #dce0e6;
      padding: 0.3rem 0.6rem;
      text-align: left;
    }
    .props-table th, .rel-table th { background: #f4f6f8; font-weight: 600; color: #555; }
    .prop-key { font-family: monospace; font-size: 0.85em; color: #555; }

    /* Relationship label pill */
    .rel-label {
      display: inline-block;
      background: #e8f0f8;
      color: #1a3a5c;
      border-radius: 3px;
      padding: 0.1em 0.45em;
      font-size: 0.82em;
      font-weight: 600;
    }

    /* Colour swatch */
    .color-swatch {
      display: inline-block;
      width: 0.9em;
      height: 0.9em;
      border: 1px solid rgba(0,0,0,0.15);
      border-radius: 2px;
      vertical-align: middle;
      margin-right: 0.35em;
    }

    /* Links */
    a { color: #2471A3; }
    a:hover { color: #1a5276; }

    /* Back to top */
    .back-top { font-size: 0.8rem; color: #888; float: right; }

    @media print {
      #sidebar { display: none; }
      #main { max-width: 100%; padding: 1rem; }
    }
  </style>
</head>
<body>
<div id="page-wrapper">

  <!-- Sidebar / Table of Contents -->
  <nav id="sidebar" aria-label="Table of Contents">
    <h2>Contents</h2>
    <ul>
      <li><a href="#header">Overview</a></li>
      ${tocHtml}
    </ul>
  </nav>

  <!-- Main content -->
  <main id="main">

    <!-- Header / Ontology metadata -->
    <div id="header">
      <h1>${esc(meta.title)}</h1>
      <dl id="meta-dl">
        ${metaRows}
      </dl>
      ${meta.description ? `<p id="description">${esc(meta.description)}</p>` : ''}
    </div>

    ${nodeTypes.length > 0 ? `
    <!-- Entity Types -->
    <section id="entity-types">
      <h2>${tocItems.find(t => t.id === 'entity-types')?.n ?? 1}. Entity Types</h2>
      <p>The following types are defined in this knowledge graph. Each type specifies the visual shape and colour used for its member entities.</p>
      ${entityTypesSections}
    </section>` : ''}

    ${nodes.length > 0 ? `
    <!-- Entities -->
    <section id="entities">
      <h2>${tocItems.find(t => t.id === 'entities')?.n ?? 1}. Entities</h2>
      <p>Detailed view of all ${nodes.length} entities, grouped by type, showing properties and relationships.</p>
      ${typedEntitiesHtml}
      ${untypedEntitiesHtml}
    </section>` : ''}

    ${edges.length > 0 ? `
    <!-- Relationships -->
    <section id="relationships">
      <h2>${tocItems.find(t => t.id === 'relationships')?.n ?? 1}. Relationships</h2>
      <p>All ${edges.length} relationships defined in this knowledge graph.</p>
      ${relTable}
    </section>` : ''}

  </main>
</div>
</body>
</html>`;
}

// ─── Exporter descriptor ──────────────────────────────────────────────────────

export const dotLdHtmlExporter = {
  name: 'DOT-LD HTML Page',
  extension: '.html',
  mimeType: 'text/html',

  export(editor) {
    const graph = editor.exportGraph();
    if ((!graph.elements?.nodes?.length) && (!graph.elements?.edges?.length)) {
      throw new Error('Nothing to export — graph is empty');
    }
    return buildHtmlPage(graph);
  },
};
