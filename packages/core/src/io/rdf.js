/**
 * RDF (Turtle) importer and exporter for Boxes graph editor.
 *
 * Supports round-trip conversion between the Boxes graph format and RDF Turtle.
 *
 * Edge type mapping rules (keyed off template edge type definitions):
 *
 *   Plain triple  – edge.data has '@id' but NO '@type'
 *                   → emitted as  <source> <@id> <target>
 *
 *   Reified edge  – edge.data has '@type'
 *                   → emitted as a new RDF resource whose URI comes from
 *                     edge.data['@id'] (or a blank node if absent).
 *                   The edge type definition controls how source/target nodes
 *                   are connected to the resource:
 *
 *     source_property         – resource  ──source_property──►  source-node
 *     target_property         – resource  ──target_property──►  target-node
 *     reverse_source_property – source-node ──rsp──►  resource
 *                               (i.e. the triple goes on the SOURCE, not the resource)
 */

// ─── Well-known IRIs ──────────────────────────────────────────────────────────

const RDF_NS   = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS  = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD_NS   = 'http://www.w3.org/2001/XMLSchema#';
const RDF_TYPE = RDF_NS + 'type';
const RDFS_LABEL = RDFS_NS + 'label';

// Additional predicates used as display label fallbacks, in priority order
const DC_TITLE    = 'http://purl.org/dc/elements/1.1/title';
const DCT_TITLE   = 'http://purl.org/dc/terms/title';
const SKOS_PREF   = 'http://www.w3.org/2004/02/skos/core#prefLabel';
const SCHEMA_NAME = 'http://schema.org/name';
const FOAF_NAME   = 'http://xmlns.com/foaf/0.1/name';
const FOAF_NICK   = 'http://xmlns.com/foaf/0.1/nick';
const LABEL_PREDICATES = [RDFS_LABEL, DC_TITLE, DCT_TITLE, SKOS_PREF, SCHEMA_NAME, FOAF_NAME, FOAF_NICK];

export const BUILTIN_PREFIXES = {
  rdf:  RDF_NS,
  rdfs: RDFS_NS,
  xsd:  XSD_NS,
};

// Data fields that are Cytoscape internals – never serialised to RDF
export const INTERNAL_FIELDS = new Set(['id', 'source', 'target', 'parent', '_style', '_classes', 'label']);

// ─── IRI utilities ────────────────────────────────────────────────────────────

/**
 * Expand a prefixed name (e.g. "owl:Class") to a full IRI.
 * Handles JSON-LD @vocab (applied to bare terms with no colon) and @base.
 * Pass-through for full IRIs and blank nodes.
 */
export function expandIRI(term, prefixes) {
  if (!term || typeof term !== 'string') return term;
  if (term.startsWith('http://') || term.startsWith('https://') ||
      term.startsWith('urn:')    || term.startsWith('_:')) return term;
  const colon = term.indexOf(':');
  if (colon === -1) {
    // Bare term: apply @vocab (JSON-LD default vocabulary) if available
    const vocab = prefixes['@vocab'];
    if (vocab && typeof vocab === 'string') return vocab + term;
    return term;
  }
  const prefix = term.slice(0, colon);
  const local  = term.slice(colon + 1);
  const all    = { ...BUILTIN_PREFIXES, ...prefixes };
  return all[prefix] !== undefined ? all[prefix] + local : term;
}

/**
 * Compress a full IRI to the shortest matching prefixed name.
 * Skips JSON-LD meta-keys (@vocab, @base, etc.) – they are not valid Turtle prefix names.
 * Returns the full IRI unchanged when no prefix matches.
 */
export function compressIRI(iri, prefixes) {
  if (!iri || typeof iri !== 'string' || iri.startsWith('_:')) return iri;
  const all = { ...BUILTIN_PREFIXES, ...prefixes };
  let best = null, bestLen = 0;
  for (const [prefix, ns] of Object.entries(all)) {
    if (prefix.startsWith('@')) continue;   // @vocab, @base are not valid Turtle prefixes
    if (typeof ns !== 'string') continue;   // safety: skip non-string namespace values
    if (iri.startsWith(ns) && ns.length > bestLen) {
      const local = iri.slice(ns.length);
      // Local part must be a valid PN_LOCAL (simplified check)
      if (local && /^[A-Za-z_\u00C0-\uFFFF][A-Za-z0-9_.\-\u00B7-\uFFFF]*$/.test(local)) {
        best = prefix; bestLen = ns.length;
      }
    }
  }
  return best !== null ? `${best}:${iri.slice(bestLen)}` : iri;
}

// ─── Turtle parser ────────────────────────────────────────────────────────────

/**
 * Parse a Turtle document into a list of triples.
 *
 * Returns { prefixes: Object, triples: Array<[s, p, o]> }
 *
 * Term representation:
 *   IRI / blank node  → string  (full IRI or "_:label")
 *   Literal           → { value: string, language?: string, datatype?: string }
 */
class TurtleParser {
  constructor(text) {
    this.s   = text;
    this.i   = 0;
    this.prefixes = { ...BUILTIN_PREFIXES };
    this.base     = '';
    this.triples  = [];
    this._bn      = 0;  // blank-node counter
  }

  parse() {
    while (this.i < this.s.length) {
      this._ws();
      if (this.i >= this.s.length) break;
      const c = this.s[this.i];

      // Line comment
      if (c === '#') { this._skipLine(); continue; }

      // @prefix / @base directives
      if (c === '@') {
        this.i++;
        const kw = this._readName().toLowerCase();
        this._ws();
        if (kw === 'prefix') {
          const p = this._readPrefixLabel();
          this._ws();
          const iri = this._readIRIRef();
          this._ws(); this._consumeChar('.');
          this.prefixes[p] = iri;
        } else if (kw === 'base') {
          this.base = this._readIRIRef();
          this._ws(); this._consumeChar('.');
        }
        continue;
      }

      // SPARQL-style PREFIX / BASE (case-insensitive)
      if (/[A-Za-z]/.test(c)) {
        const kw = this._peekKeyword().toUpperCase();
        if (kw === 'PREFIX') {
          this._skipKeyword();
          this._ws();
          const p = this._readPrefixLabel();
          this._ws();
          const iri = this._readIRIRef();
          this.prefixes[p] = iri;
          continue;
        }
        if (kw === 'BASE') {
          this._skipKeyword();
          this._ws();
          this.base = this._readIRIRef();
          continue;
        }
      }

      this._parseTripleSet();
    }
    return { prefixes: this.prefixes, triples: this.triples };
  }

  // ── Whitespace / comment helpers ──

  _ws() {
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { this.i++; continue; }
      if (c === '#') { this._skipLine(); continue; }
      break;
    }
  }

  _skipLine() {
    while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++;
  }

  _readName() {
    let n = '';
    while (this.i < this.s.length && /[A-Za-z0-9_\-]/.test(this.s[this.i])) n += this.s[this.i++];
    return n;
  }

  _peekKeyword() {
    let j = this.i, n = '';
    while (j < this.s.length && /[A-Za-z]/.test(this.s[j])) n += this.s[j++];
    return n;
  }

  _skipKeyword() {
    while (this.i < this.s.length && /[A-Za-z]/.test(this.s[this.i])) this.i++;
  }

  _readPrefixLabel() {
    let n = '';
    while (this.i < this.s.length && this.s[this.i] !== ':') n += this.s[this.i++];
    this.i++; // skip ':'
    return n.trim();
  }

  _readIRIRef() {
    this._ws();
    if (this.s[this.i] !== '<') throw new Error(`Expected '<' at pos ${this.i}: "${this.s.slice(this.i, this.i + 20)}"`);
    this.i++;
    let iri = '';
    while (this.i < this.s.length && this.s[this.i] !== '>') {
      if (this.s[this.i] === '\\') { this.i++; iri += this.s[this.i++]; }
      else iri += this.s[this.i++];
    }
    this.i++; // skip '>'
    if (this.base && !iri.includes('://')) {
      try { return new URL(iri, this.base).href; } catch (_) { /* fall through */ }
    }
    return iri;
  }

  _consumeChar(ch) {
    if (this.i < this.s.length && this.s[this.i] === ch) this.i++;
  }

  // ── Triple set ──

  _parseTripleSet() {
    const subj = this._parseTerm(true);
    if (subj === null) {
      while (this.i < this.s.length && this.s[this.i] !== '.') this.i++;
      this._consumeChar('.');
      return;
    }
    this._ws();
    this._parsePredicateObjectList(subj);
    this._ws();
    this._consumeChar('.');
  }

  // ── Term ──

  _parseTerm(asSubject = false) {
    this._ws();
    if (this.i >= this.s.length) return null;
    const c = this.s[this.i];

    // Full IRI
    if (c === '<') return this._readIRIRef();

    // Blank node label
    if (c === '_' && this.s[this.i + 1] === ':') {
      this.i += 2;
      let label = '';
      while (this.i < this.s.length && /[A-Za-z0-9_.\-]/.test(this.s[this.i])) label += this.s[this.i++];
      return '_:' + label;
    }

    // Anonymous blank node [ ... ] or []
    if (c === '[') {
      this.i++;
      const bn = '_:b' + (++this._bn);
      this._ws();
      if (this.s[this.i] !== ']') {
        this._parsePredicateObjectList(bn);
        this._ws();
      }
      this._consumeChar(']');
      return bn;
    }

    // String literal
    if (c === '"' || c === "'") return this._parseStringLiteral();

    // Numeric literal
    if (/[0-9]/.test(c) || ((c === '+' || c === '-') && /[0-9]/.test(this.s[this.i + 1] || ''))) {
      return this._parseNumericLiteral();
    }

    // Boolean
    if (this.s.startsWith('true', this.i)  && !/[A-Za-z0-9_]/.test(this.s[this.i + 4] || ''))  { this.i += 4; return { value: 'true',  datatype: XSD_NS + 'boolean' }; }
    if (this.s.startsWith('false', this.i) && !/[A-Za-z0-9_]/.test(this.s[this.i + 5] || ''))  { this.i += 5; return { value: 'false', datatype: XSD_NS + 'boolean' }; }

    // 'a' shorthand for rdf:type
    if (c === 'a' && !/[A-Za-z0-9_:.]/.test(this.s[this.i + 1] || '')) {
      this.i++;
      return RDF_TYPE;
    }

    // Prefixed name (includes bare ':local')
    if (/[A-Za-z_\u00C0-\uFFFF]/.test(c) || c === ':') return this._parsePrefixedName();

    return null;
  }

  _parsePrefixedName() {
    let name = '';
    // Collect prefix portion up to ':'
    while (this.i < this.s.length && /[A-Za-z0-9_\-.\u00B7\u00C0-\uFFFF]/.test(this.s[this.i]) && this.s[this.i] !== ':') {
      name += this.s[this.i++];
    }
    if (this.i >= this.s.length || this.s[this.i] !== ':') return name || null;
    name += this.s[this.i++]; // include ':'
    // Collect local name
    while (this.i < this.s.length && /[A-Za-z0-9_\-.\u00B7\u00C0-\uFFFF]/.test(this.s[this.i])) {
      name += this.s[this.i++];
    }
    // Resolve prefix
    const colon = name.indexOf(':');
    const prefix = name.slice(0, colon);
    const local  = name.slice(colon + 1);
    const ns = this.prefixes[prefix];
    return ns !== undefined ? ns + local : name;
  }

  _parseStringLiteral() {
    const q = this.s[this.i];
    this.i++;
    let str = '';
    // Triple-quoted?
    if (this.s[this.i] === q && this.s[this.i + 1] === q) {
      this.i += 2;
      while (this.i < this.s.length) {
        if (this.s[this.i] === q && this.s[this.i + 1] === q && this.s[this.i + 2] === q) { this.i += 3; break; }
        str += this.s[this.i] === '\\' ? this._parseEscape() : this.s[this.i++];
      }
    } else {
      while (this.i < this.s.length && this.s[this.i] !== q && this.s[this.i] !== '\n') {
        str += this.s[this.i] === '\\' ? this._parseEscape() : this.s[this.i++];
      }
      this._consumeChar(q);
    }
    // Language tag
    if (this.s[this.i] === '@') {
      this.i++;
      let lang = '';
      while (this.i < this.s.length && /[A-Za-z0-9\-]/.test(this.s[this.i])) lang += this.s[this.i++];
      return { value: str, language: lang };
    }
    // Datatype
    if (this.s[this.i] === '^' && this.s[this.i + 1] === '^') {
      this.i += 2;
      const dt = this._parseTerm();
      return { value: str, datatype: typeof dt === 'string' ? dt : String(dt) };
    }
    return { value: str };
  }

  _parseEscape() {
    this.i++; // skip '\'
    const c = this.s[this.i++];
    switch (c) {
      case 'n':  return '\n';
      case 't':  return '\t';
      case 'r':  return '\r';
      case '\\': return '\\';
      case '"':  return '"';
      case "'":  return "'";
      case 'u': { const h = this.s.slice(this.i, this.i + 4); this.i += 4; return String.fromCharCode(parseInt(h, 16)); }
      case 'U': { const h = this.s.slice(this.i, this.i + 8); this.i += 8; return String.fromCodePoint(parseInt(h, 16)); }
      default: return c;
    }
  }

  _parseNumericLiteral() {
    let n = '';
    if (this.s[this.i] === '+' || this.s[this.i] === '-') n += this.s[this.i++];
    while (this.i < this.s.length && /[0-9]/.test(this.s[this.i])) n += this.s[this.i++];
    if (this.s[this.i] === '.' && /[0-9]/.test(this.s[this.i + 1] || '')) {
      n += this.s[this.i++];
      while (this.i < this.s.length && /[0-9]/.test(this.s[this.i])) n += this.s[this.i++];
    }
    if (this.s[this.i] === 'e' || this.s[this.i] === 'E') {
      n += this.s[this.i++];
      if (this.s[this.i] === '+' || this.s[this.i] === '-') n += this.s[this.i++];
      while (this.i < this.s.length && /[0-9]/.test(this.s[this.i])) n += this.s[this.i++];
      return { value: n, datatype: XSD_NS + 'double' };
    }
    return { value: n, datatype: n.includes('.') ? XSD_NS + 'decimal' : XSD_NS + 'integer' };
  }

  // ── Predicate-object list ──

  _parsePredicateObjectList(subj) {
    while (true) {
      this._ws();
      if (this.i >= this.s.length) break;
      const c = this.s[this.i];
      if (c === '.' || c === ']') break;
      if (c === ';') { this.i++; this._ws(); continue; }

      const pred = this._parseTerm();
      if (pred === null) break;
      this._ws();
      this._parseObjectList(subj, pred);
      this._ws();
      if (this.s[this.i] === ';') { this.i++; continue; }
      break;
    }
  }

  _parseObjectList(subj, pred) {
    while (true) {
      this._ws();
      const obj = this._parseTerm();
      if (obj === null) break;
      this.triples.push([subj, pred, obj]);
      this._ws();
      if (this.s[this.i] === ',') { this.i++; continue; }
      break;
    }
  }
}

export function parseTurtle(text) {
  return new TurtleParser(text).parse();
}

// ─── Turtle serializer ────────────────────────────────────────────────────────

/** Format a single term for Turtle output. */
function formatTerm(term, prefixes) {
  if (term === null || term === undefined) return '""';

  // Literal
  if (typeof term === 'object') {
    const esc = String(term.value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');
    if (term.language) return `"${esc}"@${term.language}`;
    if (term.datatype && term.datatype !== XSD_NS + 'string') {
      const dt = compressIRI(term.datatype, prefixes);
      const dtStr = dt !== term.datatype ? dt : `<${term.datatype}>`;
      return `"${esc}"^^${dtStr}`;
    }
    return `"${esc}"`;
  }

  // IRI / blank node
  if (term.startsWith('_:')) return term;
  if (term === RDF_TYPE) return 'a';  // abbreviate rdf:type
  const compressed = compressIRI(term, prefixes);
  // If compression failed (no matching prefix), always wrap in angle brackets
  // to produce valid Turtle regardless of what the IRI looks like.
  if (compressed === term) return `<${term}>`;
  return compressed;
}

/**
 * Serialize a map of { subject → { predicate → [objects] } } to Turtle.
 * prefixes: { prefix: namespace } – used for @prefix declarations and name compression.
 */
function serializeToTurtle(subjectMap, prefixes) {
  let out = '';

  // Emit @base directive if context defines one (JSON-LD @base is a valid Turtle @base)
  if (prefixes['@base'] && typeof prefixes['@base'] === 'string') {
    out += `@base <${prefixes['@base']}> .\n`;
  }

  // @prefix declarations – skip JSON-LD meta-keys like @vocab and @base,
  // and skip term definitions (object values like {"@type": "@id"})
  for (const [prefix, ns] of Object.entries(prefixes)) {
    if (prefix.startsWith('@')) continue;
    if (typeof ns !== 'string') continue;   // skip term definitions
    out += `@prefix ${prefix}: <${ns}> .\n`;
  }
  out += '\n';

  for (const [subj, predMap] of subjectMap) {
    const pairs = [...predMap.entries()].filter(([, objs]) => objs.length > 0);
    if (pairs.length === 0) continue;

    const subjStr = formatTerm(subj, prefixes);
    out += subjStr;

    pairs.forEach(([pred, objs], idx) => {
      const predStr = formatTerm(pred, prefixes);
      const objStr  = objs.map(o => formatTerm(o, prefixes)).join(' , ');
      if (idx === 0) {
        out += ` ${predStr} ${objStr}`;
      } else {
        out += ` ;\n    ${predStr} ${objStr}`;
      }
    });
    out += ' .\n\n';
  }
  return out;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Determine which element data value should be emitted as an RDF object.
 * Strings that expand to a known IRI are emitted as IRI resources;
 * everything else becomes a plain string literal.
 */
export function dataValueToRdfObject(val, prefixes) {
  if (typeof val !== 'string') return { value: String(val) };
  if (!val) return { value: '' };
  if (val.startsWith('http://') || val.startsWith('https://') ||
      val.startsWith('urn:')    || val.startsWith('_:')) return val;
  const colon = val.indexOf(':');
  if (colon > 0) {
    const prefix = val.slice(0, colon);
    const all = { ...BUILTIN_PREFIXES, ...prefixes };
    if (all[prefix] !== undefined) return all[prefix] + val.slice(colon + 1);
  }
  return { value: val };
}

/**
 * Pick the best-matching edge type for a reified edge, given the edge data.
 * When multiple edge types share the same @type, we disambiguate by finding
 * the template whose data keys are most represented in the actual edge data.
 */
export function matchEdgeType(edgeData, edgeTypes, prefixes) {
  if (!edgeData['@type']) return null;
  const typeURI = expandIRI(edgeData['@type'], prefixes);
  const candidates = edgeTypes.filter(et =>
    et.data?.['@type'] && expandIRI(et.data['@type'], prefixes) === typeURI
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // Score by how many template data keys appear in the edge data
  let best = candidates[0], bestScore = -1;
  for (const et of candidates) {
    const score = Object.keys(et.data || {}).filter(k => k in edgeData).length;
    if (score > bestScore) { bestScore = score; best = et; }
  }
  return best;
}

/**
 * Export a Boxes graph to Turtle format.
 *
 * @param {object} graphData  – result of editor.exportGraph() (with .elements)
 * @param {object} options
 *   @param {object} options.context   – prefix→namespace map  (e.g. from editor.context)
 *   @param {Array}  options.edgeTypes – edge type definitions from the template
 * @returns {string} Turtle text
 */
export function exportToTurtle(graphData, { context = {}, edgeTypes = [] } = {}) {
  const prefixes  = { ...context };
  const nodes     = graphData.elements?.nodes || [];
  const edges     = graphData.elements?.edges || [];

  // Map: Cytoscape node id → full IRI (for building edge triples)
  const nodeIdToURI = new Map();
  for (const { data: d } of nodes) {
    const raw = d['@id'] || d.id || '';
    nodeIdToURI.set(d.id, expandIRI(raw, prefixes) || raw);
  }

  // Accumulator: subject IRI → predicate IRI → [objects]
  const subjMap = new Map();

  const addTriple = (s, p, o) => {
    if (!subjMap.has(s)) subjMap.set(s, new Map());
    const pm = subjMap.get(s);
    if (!pm.has(p)) pm.set(p, []);
    pm.get(p).push(o);
  };

  // ── Export nodes ──────────────────────────────────────────────────────────
  for (const { data: d } of nodes) {
    const raw    = d['@id'] || d.id || '';
    const subjURI = expandIRI(raw, prefixes) || raw;
    let hasRdfsLabel = false;

    for (const [key, val] of Object.entries(d)) {
      if (INTERNAL_FIELDS.has(key)) continue;
      if (key === '@id') continue;  // already used as subject
      if (val === '' || val === null || val === undefined) continue;
      if (key === '@type') {
        addTriple(subjURI, RDF_TYPE, dataValueToRdfObject(val, prefixes));
        continue;
      }
      const predURI = expandIRI(key, prefixes);
      if (predURI === RDFS_LABEL) hasRdfsLabel = true;
      addTriple(subjURI, predURI, dataValueToRdfObject(val, prefixes));
    }

    // Emit display label as rdfs:label when not already a data property
    if (!hasRdfsLabel && d.label) {
      addTriple(subjURI, RDFS_LABEL, { value: String(d.label) });
    }
  }

  // ── Export edges ──────────────────────────────────────────────────────────
  // Reverse triples collected here are appended to the source node's subject block
  const reverseTriples = [];   // [[sourceURI, predURI, edgeURI]]

  for (const { data: d } of edges) {
    const sourceURI = nodeIdToURI.get(d.source);
    const targetURI = nodeIdToURI.get(d.target);
    if (!sourceURI || !targetURI) continue;

    if (d['@type']) {
      // ── Reified edge ──
      const edgeType = matchEdgeType(d, edgeTypes, prefixes);
      const rawId    = d['@id'] || '';
      const edgeURI  = rawId.startsWith('_:')
        ? rawId
        : (rawId ? expandIRI(rawId, prefixes) : `_:e${d.id}`);

      // Properties to skip – they become graph connections, not data triples
      const skipPreds = new Set(INTERNAL_FIELDS);
      if (edgeType?.source_property)         skipPreds.add(edgeType.source_property);
      if (edgeType?.target_property)         skipPreds.add(edgeType.target_property);
      if (edgeType?.reverse_source_property) skipPreds.add(edgeType.reverse_source_property);

      let hasRdfsLabel = false;
      for (const [key, val] of Object.entries(d)) {
        if (skipPreds.has(key)) continue;
        if (key === '@id') continue;  // already used as edge subject
        if (val === '' || val === null || val === undefined) continue;
        if (key === '@type') {
          addTriple(edgeURI, RDF_TYPE, dataValueToRdfObject(val, prefixes));
          continue;
        }
        const predURI = expandIRI(key, prefixes);
        if (predURI === RDFS_LABEL) hasRdfsLabel = true;
        addTriple(edgeURI, predURI, dataValueToRdfObject(val, prefixes));
      }
      if (!hasRdfsLabel && d.label) {
        addTriple(edgeURI, RDFS_LABEL, { value: String(d.label) });
      }

      if (edgeType?.source_property) {
        addTriple(edgeURI, expandIRI(edgeType.source_property, prefixes), sourceURI);
      }
      if (edgeType?.target_property) {
        addTriple(edgeURI, expandIRI(edgeType.target_property, prefixes), targetURI);
      }
      if (edgeType?.reverse_source_property) {
        reverseTriples.push([sourceURI, expandIRI(edgeType.reverse_source_property, prefixes), edgeURI]);
      }

    } else if (d['@id']) {
      // ── Plain triple ──
      addTriple(sourceURI, expandIRI(d['@id'], prefixes), targetURI);
    }
  }

  // Attach reverse triples to their source subject blocks
  for (const [s, p, o] of reverseTriples) {
    addTriple(s, p, o);
  }

  return serializeToTurtle(subjMap, prefixes);
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Build element data for a node or edge resource from its RDF triples.
 * Returns a plain object with '@id', '@type', and property key/values.
 *
 * @param {string}       subj            – subject IRI or blank node
 * @param {Map}          predMap         – predicate IRI → [objects]
 * @param {object}       prefixes        – for IRI compression
 * @param {Set<string>}  excludePreds    – predicate IRIs to omit (they become graph connections)
 */
function buildElementData(subj, predMap, prefixes, excludePreds = new Set()) {
  const data = { '@id': compressIRI(subj, prefixes) };

  for (const [pred, objs] of predMap) {
    if (!objs.length) continue;

    // Always extract rdf:type as @type regardless of excludePreds
    if (pred === RDF_TYPE) {
      const obj = objs[0];
      if (typeof obj === 'string') data['@type'] = compressIRI(obj, prefixes);
      continue;
    }

    if (excludePreds.has(pred)) continue;

    const obj = objs[0]; // take first value (graph properties are single-valued)
    const key = compressIRI(pred, prefixes);
    data[key] = typeof obj === 'object' ? obj.value : compressIRI(obj, prefixes);
  }
  return data;
}

/**
 * Pick the best display label for a subject from its predicate map.
 *
 * Checks LABEL_PREDICATES in priority order, then falls back to:
 *   1. Compressed IRI (if a prefix shortens it)
 *   2. Local name extracted from the IRI (part after # or last /)
 *   3. The raw IRI string
 */
function pickLabel(predMap, subj, prefixes) {
  // Try label predicates first
  for (const pred of LABEL_PREDICATES) {
    const objs = predMap.get(pred);
    if (objs && objs.length > 0) {
      const obj = objs[0];
      return typeof obj === 'object' ? obj.value : String(obj);
    }
  }

  // Blank node: "a <type>" e.g. "a owl:Restriction"
  if (subj.startsWith('_:')) {
    const types = predMap.get(RDF_TYPE) || [];
    if (types.length > 0) return 'a ' + compressIRI(String(types[0]), prefixes);
    return subj;
  }

  // Named node: prefer local name (after # or last /)
  const hash = subj.lastIndexOf('#');
  if (hash !== -1 && hash < subj.length - 1) return subj.slice(hash + 1);
  const slash = subj.lastIndexOf('/');
  if (slash !== -1 && slash < subj.length - 1) return subj.slice(slash + 1);

  return compressIRI(subj, prefixes);
}
/**
 * Convert a flat array of [subject, predicate, object] triples into Boxes graph data.
 *
 * This is the core graph-reconstruction logic shared by all RDF importers.
 * All format-specific parsers (Turtle, JSON-LD, RDF/XML) should reduce their
 * input to this canonical triple array, then delegate here.
 *
 * Triple format:
 *   subject, predicate  – string  (full IRI or "_:blankLabel")
 *   object              – string  (IRI/blank)  or  { value, language?, datatype? }  (literal)
 *
 * @param {Array}  triples        – [[s, p, o], …]
 * @param {object} parsedPrefixes – prefix→namespace map extracted from the source document
 * @param {object} options        – { context, edgeTypes, nodeTypes }
 */
export function importFromTriples(triples, parsedPrefixes, { context = {}, edgeTypes = [], nodeTypes = [] } = {}) {
  // Merge: parsed file prefixes take precedence for expansion;
  // context prefixes preferred for compression (so round-trips use the same short names)
  const expandPrefixes  = { ...BUILTIN_PREFIXES, ...parsedPrefixes };
  const compressPrefixes = { ...BUILTIN_PREFIXES, ...parsedPrefixes, ...context };

  // ── Build forward triple store: subject → predicate → [objects] ──────────
  const store = new Map(); // Map<subjectIRI, Map<predicateIRI, object[]>>

  for (const [s, p, o] of triples) {
    if (!store.has(s)) store.set(s, new Map());
    const pm = store.get(s);
    if (!pm.has(p)) pm.set(p, []);
    pm.get(p).push(o);
  }

  // ── Build reverse index: predicate → object → [subjects] ─────────────────
  // Needed to resolve reverse_source_property links
  const reverseIdx = new Map(); // Map<predicateIRI, Map<objectIRI, subjectIRI[]>>
  for (const [s, pm] of store) {
    for (const [p, objs] of pm) {
      if (!reverseIdx.has(p)) reverseIdx.set(p, new Map());
      const om = reverseIdx.get(p);
      for (const o of objs) {
        if (typeof o !== 'string') continue;
        if (!om.has(o)) om.set(o, []);
        om.get(o).push(s);
      }
    }
  }

  const resultNodes  = [];
  const resultEdges  = [];
  const edgeResources = new Set();  // subjects claimed as edges
  // predicate IRIs consumed by edge structure (per source subject)
  const consumedOnSubject = new Map(); // Map<subjectIRI, Set<predicateIRI>>
  // Blank nodes that appear as edge endpoints — must be promoted to graph nodes
  const referencedBlankNodes = new Set();

  const markConsumed = (subj, pred) => {
    if (!consumedOnSubject.has(subj)) consumedOnSubject.set(subj, new Set());
    consumedOnSubject.get(subj).add(pred);
  };

  // ── Process reified edge types (those with @type in their data) ───────────
  const reifiedTypes = edgeTypes.filter(et => et.data?.['@type']);

  for (const edgeType of reifiedTypes) {
    const etTypeURI = expandIRI(edgeType.data['@type'], compressPrefixes);
    const tpURI     = edgeType.target_property         ? expandIRI(edgeType.target_property,         compressPrefixes) : null;
    const spURI     = edgeType.source_property         ? expandIRI(edgeType.source_property,         compressPrefixes) : null;
    const rspURI    = edgeType.reverse_source_property ? expandIRI(edgeType.reverse_source_property, compressPrefixes) : null;

    // Which subjects carry this type?
    for (const [subj, pm] of store) {
      if (edgeResources.has(subj)) continue;

      const types = pm.get(RDF_TYPE) || [];
      if (!types.some(t => typeof t === 'string' && t === etTypeURI)) continue;

      // Disambiguation: when multiple edge types share the same @type,
      // require the target_property triple to be present on this subject.
      if (reifiedTypes.filter(et => expandIRI(et.data['@type'], compressPrefixes) === etTypeURI).length > 1) {
        if (tpURI && !pm.has(tpURI)) continue;
      }

      // Determine source URI
      let sourceURI = null;
      if (spURI) {
        const objs = pm.get(spURI) || [];
        sourceURI = objs.find(o => typeof o === 'string') || null;
      } else if (rspURI) {
        const subjsPointingHere = reverseIdx.get(rspURI)?.get(subj) || [];
        sourceURI = subjsPointingHere[0] || null;
      }

      // Determine target URI
      let targetURI = null;
      if (tpURI) {
        const objs = pm.get(tpURI) || [];
        targetURI = objs.find(o => typeof o === 'string') || null;
      }

      if (!sourceURI || !targetURI) continue; // missing domain or range → leave as node

      // Blank node endpoints indicate anonymous class expressions (owl:Restriction,
      // owl:unionOf, etc.) that we can't meaningfully render as graph nodes.
      // Leave the property as a standalone node in that case.
      if (sourceURI.startsWith('_:') || targetURI.startsWith('_:')) continue;

      // ── Build the edge ────────────────────────────────────────────────────
      edgeResources.add(subj);

      const excludePreds = new Set([RDF_TYPE]);
      if (spURI)  excludePreds.add(spURI);
      if (tpURI)  excludePreds.add(tpURI);

      const edgeData = buildElementData(subj, pm, compressPrefixes, excludePreds);

      // Derive display label: prefer any label predicate on the edge resource, else edgeType.label
      let label = edgeType.label || '';
      for (const lp of LABEL_PREDICATES) {
        const objs = pm.get(lp);
        if (objs && objs.length > 0) {
          const o = objs[0];
          label = typeof o === 'object' ? o.value : String(o);
          break;
        }
      }

      const sourceId = compressIRI(sourceURI, compressPrefixes);
      const targetId = compressIRI(targetURI, compressPrefixes);

      resultEdges.push({
        data: {
          id:     `e_${edgeData['@id'] || subj}`,
          source: sourceId,
          target: targetId,
          label,
          ...edgeData,
        },
      });

      // Mark the reverse_source_property triple as consumed on the source node
      if (rspURI) markConsumed(sourceURI, rspURI);
    }
  }

  // ── Process plain-triple edge types (@id, no @type) ──────────────────────
  const plainTypes = edgeTypes.filter(et => et.data?.['@id'] && !et.data?.['@type']);

  for (const edgeType of plainTypes) {
    const predURI = expandIRI(edgeType.data['@id'], compressPrefixes);

    for (const [s, pm] of store) {
      const objs = pm.get(predURI) || [];
      for (const obj of objs) {
        if (typeof obj !== 'string') continue;
        // Only create an edge to a subject that exists in the file (is a known node)
        if (!store.has(obj)) continue;

        const sourceId = compressIRI(s,   compressPrefixes);
        const targetId = compressIRI(obj, compressPrefixes);

        resultEdges.push({
          data: {
            id:     `e_${edgeType.id}_${sourceId}_${targetId}`,
            source: sourceId,
            target: targetId,
            label:  edgeType.label || '',
            '@id':  compressIRI(predURI, compressPrefixes),
          },
        });

        // Track blank nodes used as edge endpoints so they become graph nodes
        if (s.startsWith('_:'))   referencedBlankNodes.add(s);
        if (obj.startsWith('_:')) referencedBlankNodes.add(obj);

        // Mark this predicate as consumed so it doesn't appear in node data
        markConsumed(s, predURI);
      }
    }
  }

  // ── Generic edge pass ─────────────────────────────────────────────────────
  // For any (subject, predicate, object) triple where the object is a known
  // subject in the store and the predicate hasn't already been consumed by an
  // edgeType pattern, create a generic edge.  This handles arbitrary RDF
  // graphs (e.g., foaf:knows, schema:creator) without needing edgeType configs.
  for (const [s, pm] of store) {
    if (typeof s !== 'string') continue;
    if (edgeResources.has(s)) continue; // skip reified edge resources

    const consumed = consumedOnSubject.get(s) || new Set();

    for (const [pred, objs] of pm) {
      if (pred === RDF_TYPE) continue;
      if (consumed.has(pred)) continue;

      for (const obj of objs) {
        if (typeof obj !== 'string') continue; // skip literals
        if (!store.has(obj)) continue;          // obj must be a known subject
        if (edgeResources.has(obj)) continue;   // skip edges-as-nodes as targets

        const sourceId = compressIRI(s,    compressPrefixes);
        const targetId = compressIRI(obj,  compressPrefixes);

        resultEdges.push({
          data: {
            id:     `e_generic_${sourceId}_${compressIRI(pred, compressPrefixes)}_${targetId}`,
            source: sourceId,
            target: targetId,
            label:  compressIRI(pred, compressPrefixes),
            '@id':  compressIRI(pred, compressPrefixes),
          },
        });

        if (s.startsWith('_:'))   referencedBlankNodes.add(s);
        if (obj.startsWith('_:')) referencedBlankNodes.add(obj);

        markConsumed(s, pred);
      }
    }
  }
  for (const [subj, pm] of store) {
    if (typeof subj !== 'string') continue; // defensive: skip non-string subjects (e.g. literal keys)
    if (edgeResources.has(subj)) continue;
    // Skip anonymous blank nodes that weren't referenced as edge endpoints
    if (subj.startsWith('_:') && !referencedBlankNodes.has(subj)) continue;

    const consumed    = consumedOnSubject.get(subj) || new Set();
    const excludePreds = new Set([RDF_TYPE, ...consumed]);
    const nodeData     = buildElementData(subj, pm, compressPrefixes, excludePreds);

    // Display label: prefer label predicates, fall back to local name / compressed IRI
    const label = pickLabel(pm, subj, compressPrefixes);

    const nodeId = compressIRI(subj, compressPrefixes);

    resultNodes.push({
      data: {
        id: nodeId,
        label,
        ...nodeData,
      },
    });
  }

  // ── Ensure all referenced blank nodes exist as graph nodes ──────────────
  // A blank node may appear as an edge endpoint but have no outgoing triples
  // (i.e., it's not a subject in the store).  Create a minimal node for it
  // so Cytoscape can render the edge.
  const createdNodeIds = new Set(resultNodes.map(n => n.data.id));
  for (const bn of referencedBlankNodes) {
    const nodeId = compressIRI(bn, compressPrefixes);
    if (createdNodeIds.has(nodeId)) continue;
    resultNodes.push({
      data: { id: nodeId, label: nodeId, '@id': nodeId },
    });
    createdNodeIds.add(nodeId);
  }

  // Merged context: template context wins for display, parsed prefixes fill gaps
  const mergedContext = { ...parsedPrefixes, ...context };
  // Remove builtins unless the user explicitly declared them
  for (const k of Object.keys(BUILTIN_PREFIXES)) {
    if (!context[k] && !parsedPrefixes[k]) delete mergedContext[k];
    else if (parsedPrefixes[k] === BUILTIN_PREFIXES[k] && !context[k]) delete mergedContext[k];
  }

  return {
    elements:  { nodes: resultNodes, edges: resultEdges },
    context:   mergedContext,
    version:   '1.0.0',
  };
}

/**
 * Import a Turtle document into Boxes graph data.
 * Parses Turtle to triples, then delegates to importFromTriples.
 */
export function importFromTurtle(text, options = {}) {
  const { prefixes: parsedPrefixes, triples } = parseTurtle(text);
  return importFromTriples(triples, parsedPrefixes, options);
}

// ─── IO plugin descriptors ────────────────────────────────────────────────────

/**
 * Exporter descriptor for the IO plugin registry.
 * Usage: runExport('rdf', editor)
 */
export const rdfExporter = {
  name:      'RDF / Turtle',
  extension: '.ttl',
  mimeType:  'text/turtle',

  export(editor, options = {}) {
    const graphData = editor.exportGraph();
    return exportToTurtle(graphData, {
      context:   editor.context || {},
      edgeTypes: editor.getEdgeTypes?.() || [],
      ...options,
    });
  },
};

/**
 * Importer descriptor for the IO plugin registry.
 * Call as: runImport('rdf', text, { context, edgeTypes, nodeTypes })
 */
export const rdfImporter = {
  name:      'RDF / Turtle',
  extensions: ['.ttl', '.turtle', '.n3'],
  mimeTypes:  ['text/turtle', 'text/n3', 'application/x-turtle'],
  defaultTemplateId: 'owl-ontology',

  import(text, options = {}) {
    return importFromTurtle(text, options);
  },
};
