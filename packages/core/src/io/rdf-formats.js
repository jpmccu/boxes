/**
 * RDF format converters: JSON-LD and RDF/XML.
 *
 * JSON-LD is the canonical intermediate format.  Every conversion pipeline
 * passes through a JSON-LD document so that context semantics (prefix
 * bindings, @type coercion, @vocab, @base) are handled correctly by the
 * jsonld library.
 *
 * Pipeline overview
 * -----------------
 *  Export JSON-LD  : graphDataToJsonLD → JSON.stringify
 *  Import JSON-LD  : JSON.parse → jsonLDToGraphData
 *                    (jsonld.expand for context processing, then importFromTriples)
 *
 *  Export RDF/XML  : graphDataToJsonLD → jsonld.toRDF(N-Quads) → n3 parse → quadsToRdfXml
 *  Import RDF/XML  : parseRdfXmlToQuads (+ namespace extraction) → N-Quads
 *                    → jsonld.fromRDF → expandedToTriples → importFromTriples
 *
 * IRI vs literal determination
 * ----------------------------
 * We do NOT use string pattern matching to decide whether a property value is
 * an IRI.  Instead the @context drives the decision:
 *   A term definition  { "@type": "@id" }  declares a property as IRI-valued.
 *   Everything else is treated as a string literal.
 *
 * Update the template context to add such declarations for properties whose
 * values should be resource references (see templates.js for the OWL example).
 *
 * The jsonld library is loaded lazily (dynamic import) so it is not bundled
 * when unused.
 */

import { Parser as N3Parser, Writer as N3Writer, DataFactory } from 'n3';
import {
  expandIRI,
  importFromTriples,
  matchEdgeType,
  INTERNAL_FIELDS,
  BUILTIN_PREFIXES,
} from './rdf.js';

const { namedNode, blankNode, literal, defaultGraph, quad: makeQuad } = DataFactory;

const RDF_NS         = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS        = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD_NS         = 'http://www.w3.org/2001/XMLSchema#';
const OWL_NS         = 'http://www.w3.org/2002/07/owl#';
const XML_NS         = 'http://www.w3.org/XML/1998/namespace';
const RDF_TYPE       = RDF_NS + 'type';
const XSD_STRING     = XSD_NS + 'string';
const XSD_LANGSTRING = RDF_NS + 'langString';

// ─── Lazy jsonld loader ───────────────────────────────────────────────────────

let _jsonldPromise = null;
async function getJsonLD() {
  if (!_jsonldPromise) {
    _jsonldPromise = import('jsonld').then(m => {
      const jld = m.default ?? m;
      // Disable remote context loading — all contexts must be inline.
      jld.documentLoader = async (url) => {
        throw new Error(
          `Remote JSON-LD context loading is disabled. ` +
          `Inline your @context instead of referencing: ${url}`
        );
      };
      return jld;
    });
  }
  return _jsonldPromise;
}

// ─── Context helpers ──────────────────────────────────────────────────────────

/**
 * Build a Set of predicate keys (both compact and expanded) whose values are
 * declared as IRI references via the JSON-LD "@type": "@id" term definition.
 *
 * Example context entry:  "rdfs:subClassOf": { "@type": "@id" }
 */
function buildIriValuedProps(context, allPrefixes) {
  const iriProps = new Set();
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'object' && value !== null && value['@type'] === '@id') {
      iriProps.add(key);
      const expanded = expandIRI(key, allPrefixes);
      if (expanded && expanded !== key) iriProps.add(expanded);
    }
  }
  return iriProps;
}

// ─── Graph → JSON-LD ─────────────────────────────────────────────────────────

/**
 * Convert Boxes graph data directly to a JSON-LD document.
 *
 * IRI vs literal decisions are driven entirely by the @context:
 *   - Properties declared with  { "@type": "@id" }  produce  { "@id": "…" }  values.
 *   - All other property values are emitted as plain string literals.
 *   - Edge targets in plain-triple edges are always resource references.
 *   - @type values are always resource references (standard JSON-LD semantics).
 */
export function graphDataToJsonLD(graphData, { edgeTypes = [] } = {}) {
  const context     = graphData.context || {};
  const nodes       = graphData.elements?.nodes || [];
  const edges       = graphData.elements?.edges || [];
  const allPrefixes = { ...BUILTIN_PREFIXES, ...context };

  // Which predicates produce IRI-valued objects (from @context semantics)?
  const iriProps = buildIriValuedProps(context, allPrefixes);

  // Cytoscape node id → the @id stored in node data (for edge endpoint resolution)
  const nodeIdToDataId = new Map();
  for (const { data: d } of nodes) {
    nodeIdToDataId.set(d.id, d['@id'] || d.id);
  }

  // Accumulate JSON-LD nodes, keyed by their @id string
  const jsonNodes = new Map();

  function getOrCreate(id) {
    if (!jsonNodes.has(id)) jsonNodes.set(id, { '@id': id });
    return jsonNodes.get(id);
  }

  function addProp(obj, key, value) {
    if (!(key in obj))                 obj[key] = value;
    else if (Array.isArray(obj[key])) obj[key].push(value);
    else                               obj[key] = [obj[key], value];
  }

  // ── Nodes ─────────────────────────────────────────────────────────────────
  for (const { data: d } of nodes) {
    const nodeId = d['@id'] || d.id;
    const obj = getOrCreate(nodeId);
    let hasRdfsLabel = false;

    for (const [key, val] of Object.entries(d)) {
      if (INTERNAL_FIELDS.has(key)) continue;
      if (key === '@id') continue;
      if (val === '' || val === null || val === undefined) continue;

      if (key === '@type') {
        obj['@type'] = String(val); // @type is always an IRI in JSON-LD
        continue;
      }

      const predIRI = expandIRI(key, allPrefixes);
      if (predIRI === RDFS_NS + 'label') hasRdfsLabel = true;

      // Use @context semantics — never string pattern matching
      if (iriProps.has(key) || iriProps.has(predIRI)) {
        addProp(obj, key, { '@id': String(val) });
      } else {
        addProp(obj, key, String(val));
      }
    }

    if (!hasRdfsLabel && d.label) addProp(obj, 'rdfs:label', d.label);
  }

  // ── Edges ─────────────────────────────────────────────────────────────────
  const deferredReverseProps = [];

  for (const { data: d } of edges) {
    const sourceDataId = nodeIdToDataId.get(d.source);
    const targetDataId = nodeIdToDataId.get(d.target);
    if (!sourceDataId || !targetDataId) continue;

    if (d['@type']) {
      // ── Reified edge: becomes its own JSON-LD node ─────────────────────────
      const et     = matchEdgeType(d, edgeTypes, allPrefixes);
      const edgeId = d['@id'] || `_:e${d.id}`;
      const edgeObj = getOrCreate(edgeId);

      const skipKeys = new Set(INTERNAL_FIELDS);
      if (et?.source_property)         skipKeys.add(et.source_property);
      if (et?.target_property)         skipKeys.add(et.target_property);
      if (et?.reverse_source_property) skipKeys.add(et.reverse_source_property);

      let hasRdfsLabel = false;
      for (const [key, val] of Object.entries(d)) {
        if (skipKeys.has(key)) continue;
        if (key === '@id') continue;
        if (val === '' || val === null || val === undefined) continue;

        if (key === '@type') { edgeObj['@type'] = String(val); continue; }

        const predIRI = expandIRI(key, allPrefixes);
        if (predIRI === RDFS_NS + 'label') hasRdfsLabel = true;

        if (iriProps.has(key) || iriProps.has(predIRI)) {
          addProp(edgeObj, key, { '@id': String(val) });
        } else {
          addProp(edgeObj, key, String(val));
        }
      }
      if (!hasRdfsLabel && d.label) addProp(edgeObj, 'rdfs:label', d.label);

      if (et?.source_property) addProp(edgeObj, et.source_property, { '@id': sourceDataId });
      if (et?.target_property) addProp(edgeObj, et.target_property, { '@id': targetDataId });
      if (et?.reverse_source_property) {
        deferredReverseProps.push([sourceDataId, et.reverse_source_property, { '@id': edgeId }]);
      }

    } else if (d['@id']) {
      // ── Plain triple: source –– predicate ––> target ──────────────────────
      // Edge targets are always resource references
      addProp(getOrCreate(sourceDataId), d['@id'], { '@id': targetDataId });
    }
  }

  for (const [id, key, value] of deferredReverseProps) {
    addProp(getOrCreate(id), key, value);
  }

  return {
    '@context': context,
    '@graph':   [...jsonNodes.values()],
  };
}

// ─── JSON-LD → Graph ──────────────────────────────────────────────────────────

/**
 * Convert expanded JSON-LD (output of jsonld.expand) to the [s, p, o] triple
 * array that importFromTriples expects.
 *
 * In the expanded form all IRIs are fully qualified and literals carry explicit
 * datatype/language metadata — so no IRI detection is needed here.
 */
function expandedToTriples(expanded) {
  const triples = [];

  for (const node of (expanded || [])) {
    const s = node['@id'];
    if (!s) continue;

    for (const typeIri of (node['@type'] || [])) {
      triples.push([s, RDF_TYPE, typeIri]);
    }

    for (const [pred, values] of Object.entries(node)) {
      if (pred === '@id' || pred === '@type') continue;

      for (const val of (Array.isArray(values) ? values : [values])) {
        if (val['@id'] !== undefined) {
          triples.push([s, pred, val['@id']]);
        } else if ('@value' in val) {
          const lit = { value: String(val['@value']) };
          if (val['@language']) {
            lit.language = val['@language'];
          } else if (val['@type'] && val['@type'] !== XSD_STRING && val['@type'] !== XSD_LANGSTRING) {
            lit.datatype = val['@type'];
          }
          triples.push([s, pred, lit]);
        }
      }
    }
  }

  return triples;
}

/**
 * Convert a JSON-LD document to Boxes graph data.
 *
 * Uses jsonld.expand() so the full @context — including @type coercion,
 * @vocab, and @base — is processed correctly by the jsonld library.
 * The resulting fully-qualified triples are passed to importFromTriples.
 */
async function jsonLDToGraphData(doc, options = {}) {
  const jld = await getJsonLD();

  const docContext = (typeof doc['@context'] === 'object' && !Array.isArray(doc['@context']))
    ? doc['@context']
    : {};
  const templateContext = options.context || {};
  const mergedContext   = { ...docContext, ...templateContext };

  const parsedPrefixes = {};
  for (const [k, v] of Object.entries(mergedContext)) {
    if (!k.startsWith('@') && typeof v === 'string') parsedPrefixes[k] = v;
  }

  const expanded = await jld.expand(doc);
  const triples  = expandedToTriples(expanded);

  return importFromTriples(triples, parsedPrefixes, { ...options, context: mergedContext });
}

// ─── n3 helpers ───────────────────────────────────────────────────────────────

function parseTurtleToQuads(text, format) {
  return new Promise((resolve, reject) => {
    const quads  = [];
    const parser = new N3Parser(format ? { format } : {});
    parser.parse(text, (err, quad, prefixes) => {
      if (err) return reject(err);
      if (quad) quads.push(quad);
      else resolve({ quads, prefixes: prefixes || {} });
    });
  });
}

function quadsToNQuadsStr(quads) {
  return new Promise((resolve, reject) => {
    const writer = new N3Writer({ format: 'N-Triples' });
    writer.addQuads(quads);
    writer.end((err, result) => err ? reject(err) : resolve(result));
  });
}

// ─── RDF/XML serializer ───────────────────────────────────────────────────────

function quadsToRdfXml(quads, context) {
  const ctx  = context || {};
  const nsMap = { rdf: RDF_NS, rdfs: RDFS_NS, xsd: XSD_NS, owl: OWL_NS };
  for (const [k, v] of Object.entries(ctx)) {
    if (!k.startsWith('@') && typeof v === 'string') nsMap[k] = v;
  }

  function splitQName(iri) {
    for (const [pfx, ns] of Object.entries(nsMap)) {
      if (iri.startsWith(ns)) {
        const local = iri.slice(ns.length);
        if (local && /^[A-Za-z_][\w.\-]*$/.test(local)) return { prefix: pfx, local };
      }
    }
    return null;
  }
  const qn  = iri => { const p = splitQName(iri); return p ? `${p.prefix}:${p.local}` : null; };
  const esc = s   => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const bySubj = new Map(), order = [];
  for (const q of quads) {
    const sid = q.subject.termType === 'BlankNode' ? '_:' + q.subject.value : q.subject.value;
    if (!bySubj.has(sid)) { bySubj.set(sid, new Map()); order.push(sid); }
    const pm = bySubj.get(sid);
    if (!pm.has(q.predicate.value)) pm.set(q.predicate.value, []);
    pm.get(q.predicate.value).push(q.object);
  }

  const used = new Set(['rdf']);
  const mark = iri => { const p = splitQName(iri); if (p) used.add(p.prefix); };
  for (const [sid, pm] of bySubj) {
    if (!sid.startsWith('_:')) mark(sid);
    for (const [pred, objs] of pm) {
      mark(pred);
      for (const o of objs) {
        if (o.termType === 'NamedNode') mark(o.value);
        if (o.datatype) mark(o.datatype.value);
      }
    }
  }

  const xmlnsDecls = [...used].filter(p => nsMap[p])
    .map(p => `  xmlns:${p}="${esc(nsMap[p])}"`)
    .join('\n');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF\n${xmlnsDecls}>\n\n`;

  for (const sid of order) {
    const pm      = bySubj.get(sid);
    const isBlank = sid.startsWith('_:');
    const types   = pm.get(RDF_TYPE) || [];
    const typeQN  = types[0] ? qn(types[0].value) : null;
    const elem    = typeQN || 'rdf:Description';
    const subjAttr = isBlank
      ? `rdf:nodeID="${esc(sid.slice(2))}"`
      : `rdf:about="${esc(sid)}"`;

    xml += `  <${elem} ${subjAttr}>\n`;
    for (const [pred, objs] of pm) {
      if (pred === RDF_TYPE && typeQN) continue;
      const pq = qn(pred) || `<${pred}>`;
      for (const o of objs) {
        if (o.termType === 'NamedNode') {
          xml += `    <${pq} rdf:resource="${esc(o.value)}"/>\n`;
        } else if (o.termType === 'BlankNode') {
          xml += `    <${pq} rdf:nodeID="${esc(o.value)}"/>\n`;
        } else {
          const attrs = o.language
            ? ` xml:lang="${esc(o.language)}"`
            : (o.datatype && o.datatype.value !== XSD_STRING
                ? ` rdf:datatype="${esc(o.datatype.value)}"` : '');
          xml += `    <${pq}${attrs}>${esc(o.value)}</${pq}>\n`;
        }
      }
    }
    xml += `  </${elem}>\n\n`;
  }
  xml += '</rdf:RDF>\n';
  return xml;
}

// ─── RDF/XML parser ───────────────────────────────────────────────────────────

function parseRdfXmlToQuads(xmlText) {
  const dom      = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parseErr = dom.querySelector('parseerror, parsererror');
  if (parseErr) throw new Error('RDF/XML parse error: ' + parseErr.textContent.trim());

  const root   = dom.documentElement;
  const quads  = [];
  let _bnCount = 0;
  const newBN  = () => blankNode('b' + (++_bnCount));

  const nsCache = new Map();
  function getNsMap(el) {
    if (nsCache.has(el)) return nsCache.get(el);
    const map = el.parentElement ? { ...getNsMap(el.parentElement) } : {};
    for (const attr of el.attributes) {
      if (attr.name === 'xmlns')               map['']              = attr.value;
      else if (attr.name.startsWith('xmlns:')) map[attr.name.slice(6)] = attr.value;
    }
    nsCache.set(el, map);
    return map;
  }

  function expandAttr(attr, nsMap) {
    const col = attr.name.indexOf(':');
    if (col === -1) return attr.name;
    const pfx = attr.name.slice(0, col);
    const loc = attr.name.slice(col + 1);
    if (pfx === 'xml') return XML_NS + loc;
    return nsMap[pfx] ? nsMap[pfx] + loc : attr.name;
  }

  const expandTag = el => el.namespaceURI ? el.namespaceURI + el.localName : el.tagName;

  function resolveIri(iri, base) {
    if (!iri) return iri;
    if (iri.startsWith('#') && base) return base.split('#')[0] + iri;
    if (!iri.includes(':') && base) { try { return new URL(iri, base).href; } catch { return iri; } }
    return iri;
  }

  const RDF_DESC = RDF_NS + 'Description';
  const RDF_RDF  = RDF_NS + 'RDF';

  function processNode(el, base) {
    const elBase = el.getAttributeNS(XML_NS, 'base') || base;
    const aboutV = el.getAttributeNS(RDF_NS, 'about')  ?? el.getAttribute('rdf:about');
    const idV    = el.getAttributeNS(RDF_NS, 'ID')     ?? el.getAttribute('rdf:ID');
    const nidV   = el.getAttributeNS(RDF_NS, 'nodeID') ?? el.getAttribute('rdf:nodeID');

    let subj;
    if (aboutV !== null) subj = namedNode(resolveIri(aboutV, elBase) || aboutV);
    else if (idV !== null) subj = namedNode(resolveIri('#' + idV, elBase) || '#' + idV);
    else if (nidV !== null) subj = blankNode(nidV);
    else subj = newBN();

    const typeIri = expandTag(el);
    if (typeIri !== RDF_DESC && typeIri !== RDF_RDF) {
      quads.push(makeQuad(subj, namedNode(RDF_TYPE), namedNode(typeIri), defaultGraph()));
    }

    for (const attr of el.attributes) {
      const aIri = expandAttr(attr, getNsMap(el));
      if (aIri.startsWith(RDF_NS) || attr.name.startsWith('xmlns') || attr.name.startsWith('xml:')) continue;
      quads.push(makeQuad(subj, namedNode(aIri), literal(attr.value), defaultGraph()));
    }

    for (const child of el.children) processProp(child, subj, elBase);
    return subj;
  }

  function processProp(el, subj, base) {
    const elBase = el.getAttributeNS(XML_NS, 'base') || base;
    const pred   = namedNode(expandTag(el));
    const resV   = el.getAttributeNS(RDF_NS, 'resource') ?? el.getAttribute('rdf:resource');
    const nidV   = el.getAttributeNS(RDF_NS, 'nodeID')   ?? el.getAttribute('rdf:nodeID');
    const dtV    = el.getAttributeNS(RDF_NS, 'datatype') ?? el.getAttribute('rdf:datatype');
    const langV  = el.getAttributeNS(XML_NS, 'lang')     ?? el.getAttribute('xml:lang');
    const ptV    = el.getAttributeNS(RDF_NS, 'parseType')?? el.getAttribute('rdf:parseType');

    if (resV !== null) {
      quads.push(makeQuad(subj, pred, namedNode(resolveIri(resV, elBase) || resV), defaultGraph()));
    } else if (nidV !== null) {
      quads.push(makeQuad(subj, pred, blankNode(nidV), defaultGraph()));
    } else if (ptV === 'Resource') {
      const inner = newBN();
      quads.push(makeQuad(subj, pred, inner, defaultGraph()));
      for (const c of el.children) processProp(c, inner, elBase);
    } else if (el.children.length === 1) {
      const objNode = processNode(el.children[0], elBase);
      quads.push(makeQuad(subj, pred, objNode, defaultGraph()));
    } else if (el.children.length > 1) {
      for (const c of el.children) processNode(c, elBase);
    } else {
      const obj = langV ? literal(el.textContent, langV)
        : dtV ? literal(el.textContent, namedNode(dtV))
        : literal(el.textContent);
      quads.push(makeQuad(subj, pred, obj, defaultGraph()));
    }
  }

  const topBase = root.getAttributeNS(XML_NS, 'base') || null;
  if (expandTag(root) === RDF_RDF) {
    for (const child of root.children) processNode(child, topBase);
  } else {
    processNode(root, topBase);
  }

  // Collect all prefix → namespace declarations from every element in the document.
  // These become parsedPrefixes for IRI compression in importFromTriples.
  const declaredPrefixes = {};
  for (const el of dom.getElementsByTagName('*')) {
    for (const attr of el.attributes) {
      if (attr.name.startsWith('xmlns:') && attr.value) {
        const prefix = attr.name.slice(6);
        if (!declaredPrefixes[prefix]) declaredPrefixes[prefix] = attr.value;
      }
    }
  }

  return { quads, prefixes: declaredPrefixes };
}

// ─── Public export functions ──────────────────────────────────────────────────

/** Export Boxes graph data to a JSON-LD string. */
export async function exportToJsonLD(graphData, options) {
  const opts = options || {};
  const doc = graphDataToJsonLD(graphData, {
    edgeTypes: opts.edgeTypes || [],
  });
  return JSON.stringify(doc, null, 2);
}

/** Import a JSON-LD string into Boxes graph data. */
export async function importFromJsonLD(text, options) {
  const opts = options || {};
  let doc;
  try { doc = JSON.parse(text); }
  catch (e) { throw new Error('Invalid JSON-LD: ' + e.message); }
  return jsonLDToGraphData(doc, opts);
}

/**
 * Export Boxes graph data to an RDF/XML string.
 * Pipeline: graphDataToJsonLD → jsonld.toRDF (N-Quads) → n3.parse → quadsToRdfXml
 */
export async function exportToRdfXml(graphData, options) {
  const opts    = options || {};
  const jld     = await getJsonLD();
  const context = Object.assign({}, graphData.context, opts.context);
  const doc     = graphDataToJsonLD(graphData, { edgeTypes: opts.edgeTypes || [] });
  const nquads  = await jld.toRDF(doc, { format: 'application/n-quads' });
  const { quads } = await parseTurtleToQuads(nquads, 'N-Quads');
  return quadsToRdfXml(quads, context);
}

/**
 * Import an RDF/XML string into Boxes graph data.
 * Pipeline: parseRdfXmlToQuads → n3.Writer (N-Quads) → jsonld.fromRDF
 *           → expandedToTriples → importFromTriples
 *
 * XML namespace declarations are extracted as parsedPrefixes so they appear in
 * the graph's context and are used for IRI compression throughout.
 */
export async function importFromRdfXml(text, options) {
  const opts   = options || {};
  const jld    = await getJsonLD();
  const { quads, prefixes: xmlPrefixes } = parseRdfXmlToQuads(text);
  const nquads   = await quadsToNQuadsStr(quads);
  const expanded = await jld.fromRDF(nquads, { format: 'application/n-quads' });
  const triples  = expandedToTriples(Array.isArray(expanded) ? expanded : []);
  return importFromTriples(triples, xmlPrefixes, opts);
}

// ─── IO plugin descriptors ────────────────────────────────────────────────────

export const jsonldExporter = {
  name: 'JSON-LD',
  extension: '.jsonld',
  mimeType: 'application/ld+json',
  async export(editor, options) {
    const opts = options || {};
    const graphData = editor.exportGraph();
    return exportToJsonLD(graphData, {
      context:   editor.context || {},
      edgeTypes: editor.getEdgeTypes ? editor.getEdgeTypes() : [],
      ...opts,
    });
  },
};

export const jsonldImporter = {
  name: 'JSON-LD',
  extensions: ['.jsonld', '.json'],
  mimeTypes:  ['application/ld+json', 'application/json'],
  async import(text, options) {
    return importFromJsonLD(text, options || {});
  },
};

export const rdfXmlExporter = {
  name: 'RDF/XML',
  extension: '.rdf',
  mimeType: 'application/rdf+xml',
  async export(editor, options) {
    const opts = options || {};
    const graphData = editor.exportGraph();
    return exportToRdfXml(graphData, {
      context:   editor.context || {},
      edgeTypes: editor.getEdgeTypes ? editor.getEdgeTypes() : [],
      ...opts,
    });
  },
};

export const rdfXmlImporter = {
  name: 'RDF/XML',
  extensions: ['.rdf', '.owl', '.xml'],
  mimeTypes:  ['application/rdf+xml', 'application/owl+xml', 'text/xml'],
  async import(text, options) {
    return importFromRdfXml(text, options || {});
  },
};
