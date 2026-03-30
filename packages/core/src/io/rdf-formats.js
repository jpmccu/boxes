/**
 * RDF format converters: JSON-LD and RDF/XML.
 *
 * Pipeline overview
 * -----------------
 *  Export JSON-LD  : graphDataToJsonLD → JSON.stringify
 *  Import JSON-LD  : JSON.parse → jsonLDToGraphData
 *                    (jsonld.expand for context processing, then importFromTriples)
 *
 *  Export RDF/XML  : exportToTurtle → rdflib.parse (text/turtle) → rdflib.serialize (RDF/XML)
 *  Import RDF/XML  : rdflib.parse (application/rdf+xml) → [s,p,o] triples → importFromTriples
 *
 * IRI vs literal determination (JSON-LD path)
 * ----------------------------
 * We do NOT use string pattern matching to decide whether a property value is
 * an IRI.  Instead the @context drives the decision:
 *   A term definition  { "@type": "@id" }  declares a property as IRI-valued.
 *   Everything else is treated as a string literal.
 *
 * The jsonld library is loaded lazily (dynamic import) so it is not bundled
 * when unused.
 */

import { Parser as N3Parser, Writer as N3Writer } from 'n3';
import { graph as rdfGraph, parse as rdfParse, serialize as rdfSerialize } from 'rdflib';
import {
  expandIRI,
  exportToTurtle,
  importFromTriples,
  matchEdgeType,
  INTERNAL_FIELDS,
  BUILTIN_PREFIXES,
} from './rdf.js';

const RDF_NS         = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS        = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD_NS         = 'http://www.w3.org/2001/XMLSchema#';
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

// ─── RDF/XML ↔ rdflib ────────────────────────────────────────────────────────

/**
 * Convert a rdflib store's statements to the [s, p, o] triple array that
 * importFromTriples expects.
 *
 *  NamedNode / BlankNode subjects/objects → string (full IRI or "_:id")
 *  Literal objects                        → { value, language?, datatype? }
 */
function rdfLibToTriples(store) {
  const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
  return store.statements.map(stmt => {
    const s = stmt.subject.termType === 'BlankNode'
      ? '_:' + stmt.subject.value
      : stmt.subject.value;
    const p = stmt.predicate.value;
    const obj = stmt.object;
    if (obj.termType === 'NamedNode') return [s, p, obj.value];
    if (obj.termType === 'BlankNode') return [s, p, '_:' + obj.value];
    // Literal
    const lit = { value: obj.value };
    if (obj.lang)     lit.language = obj.lang;
    else if (obj.datatype && obj.datatype.value !== XSD_STRING)
      lit.datatype = obj.datatype.value;
    return [s, p, lit];
  });
}

/**
 * Serialize a rdflib store to an RDF/XML string.
 * Passing undefined as the base URI causes rdflib to emit absolute IRIs.
 */
function rdfLibSerializeToXml(store) {
  return new Promise((resolve, reject) => {
    rdfSerialize(undefined, store, undefined, 'application/rdf+xml', (err, result) => {
      if (err) reject(new Error('RDF/XML serialization error: ' + err.message));
      else resolve(result);
    });
  });
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
 *
 * Pipeline: exportToTurtle → rdflib.parse (text/turtle) → rdflib.serialize (RDF/XML)
 *
 * Using rdflib ensures correct, standards-compliant RDF/XML output.
 * An ephemeral base URI is used during the Turtle→RDF/XML conversion so that
 * all resulting rdf:about attributes are absolute IRIs.
 */
export async function exportToRdfXml(graphData, options) {
  const opts   = options || {};
  const turtle = exportToTurtle(graphData, opts);
  const store  = rdfGraph();
  // Use a stable ephemeral base so rdflib resolves relative Turtle IRIs
  const base   = 'urn:boxes:export:';
  rdfParse(turtle, store, base, 'text/turtle');
  return rdfLibSerializeToXml(store);
}

/**
 * Import an RDF/XML string into Boxes graph data.
 *
 * Pipeline: rdflib.parse (application/rdf+xml) → [s,p,o] triples → importFromTriples
 *
 * Pass options.baseUri (string) when the document's original URL is known so
 * that relative IRIs (e.g. rdf:about="#i") are resolved correctly.
 */
export async function importFromRdfXml(text, options) {
  const opts    = options || {};
  const baseUri = opts.baseUri || 'urn:boxes:import:';
  const store   = rdfGraph();

  try {
    rdfParse(text, store, baseUri, 'application/rdf+xml');
  } catch (e) {
    throw new Error('RDF/XML parse error: ' + (e.message || e));
  }

  // Extract namespace prefix bindings from the rdflib store for IRI compression
  const parsedPrefixes = {};
  for (const [prefix, ns] of Object.entries(store.namespaces || {})) {
    if (prefix && typeof ns === 'string' && !prefix.startsWith('@')) {
      parsedPrefixes[prefix] = ns;
    }
  }

  const triples = rdfLibToTriples(store);
  return importFromTriples(triples, parsedPrefixes, opts);
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
  defaultTemplateId: 'owl-ontology',
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
  defaultTemplateId: 'owl-ontology',
  async import(text, options) {
    return importFromRdfXml(text, options || {});
  },
};
