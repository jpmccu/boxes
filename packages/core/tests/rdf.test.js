import { describe, it, expect } from 'vitest';
import {
  expandIRI,
  compressIRI,
  parseTurtle,
  exportToTurtle,
  importFromTurtle,
} from '../src/io/rdf.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const OWL_CONTEXT = {
  owl:  'http://www.w3.org/2002/07/owl#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  rdf:  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  sh:   'http://www.w3.org/ns/shacl#',
  ex:   'http://example.org/',
};

const OWL_EDGE_TYPES = [
  {
    id: 'rdfs:subClassOf',
    label: 'subClassOf',
    data: { '@id': 'rdfs:subClassOf' },
  },
  {
    id: 'rdf:type',
    label: 'type',
    data: { '@id': 'rdf:type' },
  },
  {
    id: 'owl:ObjectProperty',
    label: 'ObjectProperty',
    data: { '@type': 'owl:ObjectProperty' },
    source_property: 'rdfs:domain',
    target_property: 'rdfs:range',
  },
  {
    id: 'owl:DatatypeProperty',
    label: 'DatatypeProperty',
    data: { '@type': 'owl:DatatypeProperty' },
    source_property: 'rdfs:domain',
    target_property: 'rdfs:range',
  },
  {
    id: 'PropertyShape',
    label: 'PropertyShape',
    data: { '@type': 'sh:PropertyShape', 'sh:path': '' },
    target_property: 'sh:node',
    reverse_source_property: 'sh:property',
  },
  {
    id: 'QualifiedPropertyShape',
    label: 'QualifiedPropertyShape',
    data: { '@type': 'sh:PropertyShape', 'sh:path': '', 'sh:qualifiedMinCount': 0 },
    target_property: 'sh:qualifiedValueShape',
    reverse_source_property: 'sh:property',
  },
];

const OWL_OPTIONS = { context: OWL_CONTEXT, edgeTypes: OWL_EDGE_TYPES };

function makeGraph(nodes, edges) {
  return { elements: { nodes, edges } };
}

function roundTrip(nodes, edges) {
  const ttl = exportToTurtle(makeGraph(nodes, edges), OWL_OPTIONS);
  return importFromTurtle(ttl, OWL_OPTIONS);
}

// ─── expandIRI / compressIRI ──────────────────────────────────────────────────

describe('expandIRI', () => {
  it('expands a known prefix', () => {
    expect(expandIRI('owl:Class', OWL_CONTEXT)).toBe('http://www.w3.org/2002/07/owl#Class');
  });
  it('passes through full IRIs unchanged', () => {
    expect(expandIRI('http://example.org/Foo', {})).toBe('http://example.org/Foo');
  });
  it('passes through blank nodes unchanged', () => {
    expect(expandIRI('_:b1', OWL_CONTEXT)).toBe('_:b1');
  });
  it('uses built-in rdf: prefix even without explicit context', () => {
    expect(expandIRI('rdf:type', {})).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  });
  it('returns term unchanged when prefix is unknown', () => {
    expect(expandIRI('unknown:Foo', {})).toBe('unknown:Foo');
  });
});

describe('compressIRI', () => {
  it('compresses to a known prefix', () => {
    expect(compressIRI('http://www.w3.org/2002/07/owl#Class', OWL_CONTEXT)).toBe('owl:Class');
  });
  it('returns full IRI when no prefix matches', () => {
    expect(compressIRI('http://no-match.org/bar', OWL_CONTEXT)).toBe('http://no-match.org/bar');
  });
  it('passes blank nodes through unchanged', () => {
    expect(compressIRI('_:b1', OWL_CONTEXT)).toBe('_:b1');
  });
  it('picks the longest matching prefix namespace', () => {
    const ctx = { a: 'http://x.org/', b: 'http://x.org/sub/' };
    expect(compressIRI('http://x.org/sub/Thing', ctx)).toBe('b:Thing');
  });
});

// ─── parseTurtle ─────────────────────────────────────────────────────────────

describe('parseTurtle', () => {
  it('parses @prefix declarations', () => {
    const { prefixes } = parseTurtle('@prefix owl: <http://www.w3.org/2002/07/owl#> .');
    expect(prefixes.owl).toBe('http://www.w3.org/2002/07/owl#');
  });

  it('parses SPARQL-style PREFIX', () => {
    const { prefixes } = parseTurtle('PREFIX ex: <http://example.org/>');
    expect(prefixes.ex).toBe('http://example.org/');
  });

  it('parses a simple triple', () => {
    const ttl = `@prefix ex: <http://example.org/> .
                 ex:A ex:knows ex:B .`;
    const { triples } = parseTurtle(ttl);
    expect(triples).toContainEqual([
      'http://example.org/A',
      'http://example.org/knows',
      'http://example.org/B',
    ]);
  });

  it('parses "a" as rdf:type shorthand', () => {
    const ttl = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
                 owl:Person a owl:Class .`;
    const { triples } = parseTurtle(ttl);
    const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    expect(triples).toContainEqual([
      'http://www.w3.org/2002/07/owl#Person',
      RDF_TYPE,
      'http://www.w3.org/2002/07/owl#Class',
    ]);
  });

  it('parses semicolon-separated predicate groups', () => {
    const ttl = `@prefix ex: <http://example.org/> .
                 @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
                 ex:A a ex:Class ; rdfs:label "Alpha" .`;
    const { triples } = parseTurtle(ttl);
    expect(triples.length).toBe(2);
    expect(triples[1][2]).toEqual({ value: 'Alpha' });
  });

  it('parses comma-separated objects', () => {
    const ttl = `@prefix ex: <http://example.org/> .
                 ex:A ex:knows ex:B , ex:C .`;
    const { triples } = parseTurtle(ttl);
    expect(triples.length).toBe(2);
  });

  it('parses language-tagged literals', () => {
    const ttl = `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
                 <http://x/A> rdfs:label "Hello"@en .`;
    const { triples } = parseTurtle(ttl);
    expect(triples[0][2]).toEqual({ value: 'Hello', language: 'en' });
  });

  it('parses datatyped literals', () => {
    const ttl = `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
                 <http://x/A> <http://x/age> "42"^^xsd:integer .`;
    const { triples } = parseTurtle(ttl);
    expect(triples[0][2]).toEqual({ value: '42', datatype: 'http://www.w3.org/2001/XMLSchema#integer' });
  });

  it('parses blank node labels', () => {
    const ttl = `@prefix ex: <http://example.org/> .
                 _:b1 ex:knows ex:B .`;
    const { triples } = parseTurtle(ttl);
    expect(triples[0][0]).toBe('_:b1');
  });

  it('ignores line comments', () => {
    const ttl = `# comment
      @prefix ex: <http://example.org/> .
      ex:A ex:knows ex:B . # inline comment`;
    const { triples } = parseTurtle(ttl);
    expect(triples.length).toBe(1);
  });

  it('parses numeric literals', () => {
    const ttl = `<http://x/A> <http://x/count> 42 .`;
    const { triples } = parseTurtle(ttl);
    expect(triples[0][2]).toMatchObject({ value: '42' });
  });
});

// ─── Export: nodes ────────────────────────────────────────────────────────────

describe('exportToTurtle – nodes', () => {
  it('emits @prefix declarations for all context entries', () => {
    const gd = makeGraph([
      { data: { id: 'owl:Person', '@id': 'owl:Person', '@type': 'owl:Class', label: 'Person' } },
    ], []);
    const ttl = exportToTurtle(gd, { context: OWL_CONTEXT });
    expect(ttl).toContain('@prefix owl:');
    expect(ttl).toContain('@prefix rdfs:');
    expect(ttl).toContain('@prefix ex:');
  });

  it('emits rdf:type triple from @type field', () => {
    const gd = makeGraph([
      { data: { id: 'owl:Person', '@id': 'owl:Person', '@type': 'owl:Class', label: 'Person' } },
    ], []);
    const ttl = exportToTurtle(gd, { context: OWL_CONTEXT });
    expect(ttl).toContain('a owl:Class');
  });

  it('emits rdfs:label from display label when none in data', () => {
    const gd = makeGraph([
      { data: { id: 'ex:A', '@id': 'ex:A', '@type': 'owl:Class', label: 'Alpha' } },
    ], []);
    const ttl = exportToTurtle(gd, { context: OWL_CONTEXT });
    expect(ttl).toMatch(/rdfs:label\s+"Alpha"/);
  });

  it('does not duplicate rdfs:label when already in data', () => {
    const gd = makeGraph([
      { data: { id: 'ex:A', '@id': 'ex:A', 'rdfs:label': 'Alpha', label: 'Alpha' } },
    ], []);
    const ttl = exportToTurtle(gd, { context: OWL_CONTEXT });
    expect([...ttl.matchAll(/rdfs:label/g)].length).toBe(1);
  });

  it('emits custom data properties as triples', () => {
    const gd = makeGraph([
      { data: { id: 'ex:A', '@id': 'ex:A', 'skos:definition': 'A thing', label: 'A' } },
    ], []);
    const ttl = exportToTurtle(gd, { context: OWL_CONTEXT });
    expect(ttl).toContain('skos:definition');
    expect(ttl).toContain('"A thing"');
  });

  it('skips empty string properties', () => {
    const gd = makeGraph([
      { data: { id: 'ex:A', '@id': 'ex:A', 'skos:definition': '', label: 'A' } },
    ], []);
    const ttl = exportToTurtle(gd, { context: OWL_CONTEXT });
    expect(ttl).not.toContain('skos:definition');
  });

  it('does not emit internal Cytoscape fields (id, parent, _style)', () => {
    const gd = makeGraph([
      { data: { id: 'ex:A', '@id': 'ex:A', parent: 'ex:P', _style: {}, label: 'A' } },
    ], []);
    const ttl = exportToTurtle(gd, { context: OWL_CONTEXT });
    expect(ttl).not.toMatch(/\bparent\b/);
    expect(ttl).not.toMatch(/_style/);
  });
});

// ─── Export: plain triple edges ───────────────────────────────────────────────

describe('exportToTurtle – plain triple edges', () => {
  const nodes = [
    { data: { id: 'ex:A', '@id': 'ex:A', '@type': 'owl:Class', label: 'A' } },
    { data: { id: 'ex:B', '@id': 'ex:B', '@type': 'owl:Class', label: 'B' } },
  ];

  it('emits rdfs:subClassOf as a plain triple on the source subject', () => {
    const gd = makeGraph(nodes, [
      { data: { id: 'e1', source: 'ex:A', target: 'ex:B', '@id': 'rdfs:subClassOf', label: 'subClassOf' } },
    ]);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    expect(ttl).toContain('rdfs:subClassOf ex:B');
  });

  it('emits rdf:type edge as "a" shorthand', () => {
    const gd = makeGraph(nodes, [
      { data: { id: 'e1', source: 'ex:A', target: 'ex:B', '@id': 'rdf:type', label: 'type' } },
    ]);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    // ex:A has rdf:type from its own @type (owl:Class) and from the edge (ex:B)
    // Both are serialized as object list under 'a': "a owl:Class , ex:B" or similar
    expect(ttl).toMatch(/a [^;.\n]*ex:B/);
  });
});

// ─── Export: reified edges (source_property + target_property) ───────────────

describe('exportToTurtle – reified edges with source/target property', () => {
  const nodes = [
    { data: { id: 'ex:ClassA', '@id': 'ex:ClassA', '@type': 'owl:Class', label: 'ClassA' } },
    { data: { id: 'ex:ClassB', '@id': 'ex:ClassB', '@type': 'owl:Class', label: 'ClassB' } },
  ];

  it('emits rdf:type, rdfs:domain and rdfs:range for owl:ObjectProperty', () => {
    const gd = makeGraph(nodes, [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:knows', '@type': 'owl:ObjectProperty', label: 'knows',
      },
    }]);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    expect(ttl).toContain('a owl:ObjectProperty');
    expect(ttl).toContain('rdfs:domain ex:ClassA');
    expect(ttl).toContain('rdfs:range ex:ClassB');
  });

  it('does not put domain/range in node data section', () => {
    const gd = makeGraph(nodes, [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:knows', '@type': 'owl:ObjectProperty', label: 'knows',
      },
    }]);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    // domain should only appear in the edge resource block
    const domainMatches = [...ttl.matchAll(/rdfs:domain/g)];
    expect(domainMatches.length).toBe(1);
  });

  it('uses blank node as subject when edge has no @id', () => {
    const gd = makeGraph(nodes, [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@type': 'owl:ObjectProperty', label: 'prop',
      },
    }]);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    expect(ttl).toMatch(/_:e\w+\s+a owl:ObjectProperty/);
  });

  it('preserves additional edge data properties on the resource', () => {
    const gd = makeGraph(nodes, [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:p', '@type': 'owl:ObjectProperty',
        'rdfs:comment': 'A custom property', label: 'p',
      },
    }]);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    expect(ttl).toContain('rdfs:comment');
    expect(ttl).toContain('"A custom property"');
  });
});

// ─── Export: reified edges with reverse_source_property ──────────────────────

describe('exportToTurtle – reified edges with reverse_source_property', () => {
  const nodes = [
    { data: { id: 'ex:ClassA', '@id': 'ex:ClassA', '@type': 'owl:Class', label: 'ClassA' } },
    { data: { id: 'ex:ClassB', '@id': 'ex:ClassB', '@type': 'owl:Class', label: 'ClassB' } },
  ];

  it('emits sh:property on the source node (reverse triple)', () => {
    const gd = makeGraph(nodes, [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:ps1', '@type': 'sh:PropertyShape',
        'sh:path': 'ex:someProp', label: 'shape',
      },
    }]);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    // reverse triple: ClassA sh:property ex:ps1
    expect(ttl).toContain('sh:property ex:ps1');
    // target triple: ex:ps1 sh:node ClassB
    expect(ttl).toContain('sh:node ex:ClassB');
    // type triple
    expect(ttl).toContain('a sh:PropertyShape');
  });

  it('emits sh:qualifiedValueShape for QualifiedPropertyShape', () => {
    const gd = makeGraph(nodes, [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:qps1', '@type': 'sh:PropertyShape',
        'sh:path': 'ex:someProp', 'sh:qualifiedMinCount': 1, label: 'qshape',
      },
    }]);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    expect(ttl).toContain('sh:qualifiedValueShape ex:ClassB');
    expect(ttl).toContain('sh:property ex:qps1');
  });
});

// ─── Import: nodes ────────────────────────────────────────────────────────────

describe('importFromTurtle – nodes', () => {
  it('creates a node for each non-edge subject', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:A a owl:Class ; rdfs:label "Alpha" .
      ex:B a owl:Class ; rdfs:label "Beta" .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.nodes.length).toBe(2);
  });

  it('sets node @id from compressed IRI', () => {
    const ttl = `@prefix ex: <http://example.org/> .
                 @prefix owl: <http://www.w3.org/2002/07/owl#> .
                 ex:Foo a owl:Class .`;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    const node = elements.nodes[0];
    expect(node.data['@id']).toBe('ex:Foo');
    expect(node.data.id).toBe('ex:Foo');
  });

  it('sets display label from rdfs:label', () => {
    const ttl = `@prefix ex: <http://example.org/> .
                 @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
                 ex:Foo rdfs:label "My Label" .`;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.nodes[0].data.label).toBe('My Label');
  });

  it('falls back to compressed IRI as label when no rdfs:label', () => {
    const ttl = `@prefix ex: <http://example.org/> .
                 @prefix owl: <http://www.w3.org/2002/07/owl#> .
                 ex:Foo a owl:Class .`;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.nodes[0].data.label).toBe('ex:Foo');
  });

  it('sets @type from rdf:type triple', () => {
    const ttl = `@prefix ex: <http://example.org/> .
                 @prefix owl: <http://www.w3.org/2002/07/owl#> .
                 ex:Foo a owl:Class .`;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.nodes[0].data['@type']).toBe('owl:Class');
  });

  it('stores custom data properties', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      ex:Foo skos:definition "A definition" .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.nodes[0].data['skos:definition']).toBe('A definition');
  });
});

// ─── Import: plain triple edges ───────────────────────────────────────────────

describe('importFromTurtle – plain triple edges', () => {
  it('creates an edge for rdfs:subClassOf triple', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:A a owl:Class .
      ex:B a owl:Class .
      ex:A rdfs:subClassOf ex:B .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.edges.length).toBe(1);
    const edge = elements.edges[0];
    expect(edge.data.source).toBe('ex:A');
    expect(edge.data.target).toBe('ex:B');
    expect(edge.data['@id']).toBe('rdfs:subClassOf');
  });

  it('does not include consumed predicate in node data', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:A rdfs:subClassOf ex:B .
      ex:B rdfs:label "B" .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    const nodeA = elements.nodes.find(n => n.data.id === 'ex:A');
    expect(nodeA?.data['rdfs:subClassOf']).toBeUndefined();
  });
});

// ─── Import: reified edges ────────────────────────────────────────────────────

describe('importFromTurtle – reified edges (source + target property)', () => {
  it('reconstructs owl:ObjectProperty edge with correct source/target', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:ClassA a owl:Class ; rdfs:label "ClassA" .
      ex:ClassB a owl:Class ; rdfs:label "ClassB" .
      ex:knows a owl:ObjectProperty ;
        rdfs:domain ex:ClassA ;
        rdfs:range ex:ClassB ;
        rdfs:label "knows" .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.nodes.length).toBe(2);
    expect(elements.edges.length).toBe(1);
    const edge = elements.edges[0];
    expect(edge.data.source).toBe('ex:ClassA');
    expect(edge.data.target).toBe('ex:ClassB');
    expect(edge.data['@type']).toBe('owl:ObjectProperty');
    expect(edge.data['@id']).toBe('ex:knows');
  });

  it('does not create a node for the edge resource', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:ClassA a owl:Class .
      ex:ClassB a owl:Class .
      ex:knows a owl:ObjectProperty ;
        rdfs:domain ex:ClassA ; rdfs:range ex:ClassB .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    const nodeIds = elements.nodes.map(n => n.data.id);
    expect(nodeIds).not.toContain('ex:knows');
    expect(elements.nodes.length).toBe(2);
  });

  it('preserves additional properties on the edge resource', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:ClassA a owl:Class .
      ex:ClassB a owl:Class .
      ex:knows a owl:ObjectProperty ;
        rdfs:domain ex:ClassA ; rdfs:range ex:ClassB ;
        rdfs:comment "A relationship" .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.edges[0].data['rdfs:comment']).toBe('A relationship');
  });
});

// ─── Import: reified edges with reverse_source_property ──────────────────────

describe('importFromTurtle – reified edges with reverse_source_property', () => {
  it('reconstructs PropertyShape edge (reverse_source_property + target_property)', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:ClassA a owl:Class ; rdfs:label "ClassA" .
      ex:ClassB a owl:Class ; rdfs:label "ClassB" .
      ex:ps1 a sh:PropertyShape ;
        sh:path ex:someProp ;
        sh:node ex:ClassB .
      ex:ClassA sh:property ex:ps1 .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.nodes.length).toBe(2);
    expect(elements.edges.length).toBe(1);
    const edge = elements.edges[0];
    expect(edge.data.source).toBe('ex:ClassA');
    expect(edge.data.target).toBe('ex:ClassB');
    expect(edge.data['@type']).toBe('sh:PropertyShape');
  });

  it('does not emit sh:property in ClassA node data after import', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      ex:ClassA a owl:Class .
      ex:ClassB a owl:Class .
      ex:ps1 a sh:PropertyShape ; sh:node ex:ClassB .
      ex:ClassA sh:property ex:ps1 .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    const nodeA = elements.nodes.find(n => n.data.id === 'ex:ClassA');
    expect(nodeA?.data['sh:property']).toBeUndefined();
  });

  it('reconstructs QualifiedPropertyShape with sh:qualifiedValueShape', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:ClassA a owl:Class .
      ex:ClassB a owl:Class .
      ex:qps1 a sh:PropertyShape ;
        sh:path ex:someProp ;
        sh:qualifiedMinCount 1 ;
        sh:qualifiedValueShape ex:ClassB .
      ex:ClassA sh:property ex:qps1 .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.edges.length).toBe(1);
    const edge = elements.edges[0];
    expect(edge.data.source).toBe('ex:ClassA');
    expect(edge.data.target).toBe('ex:ClassB');
    // should pick QualifiedPropertyShape not PropertyShape
    expect(edge.data['sh:qualifiedValueShape']).toBeUndefined(); // consumed as target
    expect(edge.data.target).toBe('ex:ClassB');
  });
});

// ─── Disambiguation: same @type, different edge types ────────────────────────

describe('disambiguation – same @type, different edge types', () => {
  it('assigns PropertyShape when sh:node is present', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      ex:A a owl:Class .
      ex:B a owl:Class .
      ex:ps a sh:PropertyShape ; sh:node ex:B .
      ex:A sh:property ex:ps .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    // Should create an edge, not a node for ex:ps
    expect(elements.nodes.map(n => n.data.id)).not.toContain('ex:ps');
    expect(elements.edges.length).toBe(1);
  });

  it('assigns QualifiedPropertyShape when sh:qualifiedValueShape is present', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      ex:A a owl:Class .
      ex:B a owl:Class .
      ex:qps a sh:PropertyShape ; sh:qualifiedValueShape ex:B .
      ex:A sh:property ex:qps .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.edges.length).toBe(1);
    expect(elements.nodes.map(n => n.data.id)).not.toContain('ex:qps');
  });

  it('leaves sh:PropertyShape as a node when no matching target property', () => {
    // A standalone shape not connected by known edge pattern
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      ex:standalone a sh:PropertyShape ; sh:path ex:foo .
    `;
    const { elements } = importFromTurtle(ttl, OWL_OPTIONS);
    expect(elements.nodes.map(n => n.data.id)).toContain('ex:standalone');
    expect(elements.edges.length).toBe(0);
  });
});

// ─── Round-trip tests ─────────────────────────────────────────────────────────

describe('round-trip – simple node', () => {
  it('preserves node @id, @type, and label', () => {
    const nodes = [
      { data: { id: 'ex:Person', '@id': 'ex:Person', '@type': 'owl:Class',
                'skos:definition': 'A human being', label: 'Person' } },
    ];
    const { elements } = roundTrip(nodes, []);
    const node = elements.nodes.find(n => n.data.id === 'ex:Person');
    expect(node).toBeDefined();
    expect(node.data['@type']).toBe('owl:Class');
    expect(node.data.label).toBe('Person');
    expect(node.data['skos:definition']).toBe('A human being');
  });
});

describe('round-trip – plain triple edge', () => {
  it('preserves rdfs:subClassOf edge structure', () => {
    const nodes = [
      { data: { id: 'ex:A', '@id': 'ex:A', '@type': 'owl:Class', label: 'A' } },
      { data: { id: 'ex:B', '@id': 'ex:B', '@type': 'owl:Class', label: 'B' } },
    ];
    const edges = [
      { data: { id: 'e1', source: 'ex:A', target: 'ex:B', '@id': 'rdfs:subClassOf', label: 'subClassOf' } },
    ];
    const { elements } = roundTrip(nodes, edges);
    expect(elements.nodes.length).toBe(2);
    expect(elements.edges.length).toBe(1);
    expect(elements.edges[0].data.source).toBe('ex:A');
    expect(elements.edges[0].data.target).toBe('ex:B');
    expect(elements.edges[0].data['@id']).toBe('rdfs:subClassOf');
  });
});

describe('round-trip – reified edge (owl:ObjectProperty)', () => {
  it('preserves the property URI, source, and target', () => {
    const nodes = [
      { data: { id: 'ex:ClassA', '@id': 'ex:ClassA', '@type': 'owl:Class', label: 'ClassA' } },
      { data: { id: 'ex:ClassB', '@id': 'ex:ClassB', '@type': 'owl:Class', label: 'ClassB' } },
    ];
    const edges = [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:hasChild', '@type': 'owl:ObjectProperty', label: 'hasChild',
      },
    }];
    const { elements } = roundTrip(nodes, edges);
    expect(elements.nodes.length).toBe(2);
    expect(elements.edges.length).toBe(1);
    const edge = elements.edges[0];
    expect(edge.data['@id']).toBe('ex:hasChild');
    expect(edge.data['@type']).toBe('owl:ObjectProperty');
    expect(edge.data.source).toBe('ex:ClassA');
    expect(edge.data.target).toBe('ex:ClassB');
  });

  it('preserves additional edge data properties', () => {
    const nodes = [
      { data: { id: 'ex:A', '@id': 'ex:A', '@type': 'owl:Class', label: 'A' } },
      { data: { id: 'ex:B', '@id': 'ex:B', '@type': 'owl:Class', label: 'B' } },
    ];
    const edges = [{
      data: {
        id: 'e1', source: 'ex:A', target: 'ex:B',
        '@id': 'ex:p', '@type': 'owl:ObjectProperty',
        'rdfs:comment': 'My property', label: 'p',
      },
    }];
    const { elements } = roundTrip(nodes, edges);
    expect(elements.edges[0].data['rdfs:comment']).toBe('My property');
  });
});

describe('round-trip – reified edge with reverse_source_property (PropertyShape)', () => {
  it('preserves source, target, @type, and sh:path', () => {
    const nodes = [
      { data: { id: 'ex:ClassA', '@id': 'ex:ClassA', '@type': 'owl:Class', label: 'ClassA' } },
      { data: { id: 'ex:ClassB', '@id': 'ex:ClassB', '@type': 'owl:Class', label: 'ClassB' } },
    ];
    const edges = [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:ps1', '@type': 'sh:PropertyShape',
        'sh:path': 'ex:someProp', label: 'ps1',
      },
    }];
    const { elements } = roundTrip(nodes, edges);
    expect(elements.nodes.length).toBe(2);
    expect(elements.edges.length).toBe(1);
    const edge = elements.edges[0];
    expect(edge.data.source).toBe('ex:ClassA');
    expect(edge.data.target).toBe('ex:ClassB');
    expect(edge.data['@type']).toBe('sh:PropertyShape');
    expect(edge.data['sh:path']).toBe('ex:someProp');
  });

  it('does not pollute source node data with sh:property', () => {
    const nodes = [
      { data: { id: 'ex:ClassA', '@id': 'ex:ClassA', '@type': 'owl:Class', label: 'ClassA' } },
      { data: { id: 'ex:ClassB', '@id': 'ex:ClassB', '@type': 'owl:Class', label: 'ClassB' } },
    ];
    const edges = [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:ps1', '@type': 'sh:PropertyShape',
        'sh:path': 'ex:someProp', label: 'ps1',
      },
    }];
    const { elements } = roundTrip(nodes, edges);
    const nodeA = elements.nodes.find(n => n.data.id === 'ex:ClassA');
    expect(nodeA?.data['sh:property']).toBeUndefined();
  });
});

describe('round-trip – QualifiedPropertyShape', () => {
  it('preserves QualifiedPropertyShape round-trip', () => {
    const nodes = [
      { data: { id: 'ex:ClassA', '@id': 'ex:ClassA', '@type': 'owl:Class', label: 'ClassA' } },
      { data: { id: 'ex:ClassB', '@id': 'ex:ClassB', '@type': 'owl:Class', label: 'ClassB' } },
    ];
    const edges = [{
      data: {
        id: 'e1', source: 'ex:ClassA', target: 'ex:ClassB',
        '@id': 'ex:qps1', '@type': 'sh:PropertyShape',
        'sh:path': 'ex:someProp', 'sh:qualifiedMinCount': 1, label: 'qps1',
      },
    }];
    const { elements } = roundTrip(nodes, edges);
    expect(elements.edges.length).toBe(1);
    const edge = elements.edges[0];
    expect(edge.data.source).toBe('ex:ClassA');
    expect(edge.data.target).toBe('ex:ClassB');
    expect(edge.data['@type']).toBe('sh:PropertyShape');
  });
});

describe('round-trip – full OWL graph', () => {
  it('preserves a mixed graph with multiple edge types', () => {
    const nodes = [
      { data: { id: 'ex:Animal',  '@id': 'ex:Animal',  '@type': 'owl:Class', label: 'Animal' } },
      { data: { id: 'ex:Dog',     '@id': 'ex:Dog',     '@type': 'owl:Class', label: 'Dog' } },
      { data: { id: 'ex:Owner',   '@id': 'ex:Owner',   '@type': 'owl:Class', label: 'Owner',
                'skos:definition': 'A person who owns a dog' } },
    ];
    const edges = [
      {
        data: { id: 'e1', source: 'ex:Dog', target: 'ex:Animal',
                '@id': 'rdfs:subClassOf', label: 'subClassOf' },
      },
      {
        data: {
          id: 'e2', source: 'ex:Owner', target: 'ex:Dog',
          '@id': 'ex:owns', '@type': 'owl:ObjectProperty', label: 'owns',
        },
      },
    ];
    const { elements } = roundTrip(nodes, edges);
    expect(elements.nodes.length).toBe(3);
    expect(elements.edges.length).toBe(2);

    const subClassEdge = elements.edges.find(e => e.data['@id'] === 'rdfs:subClassOf');
    expect(subClassEdge).toBeDefined();
    expect(subClassEdge.data.source).toBe('ex:Dog');
    expect(subClassEdge.data.target).toBe('ex:Animal');

    const ownsEdge = elements.edges.find(e => e.data['@type'] === 'owl:ObjectProperty');
    expect(ownsEdge).toBeDefined();
    expect(ownsEdge.data['@id']).toBe('ex:owns');
    expect(ownsEdge.data.source).toBe('ex:Owner');
    expect(ownsEdge.data.target).toBe('ex:Dog');

    const ownerNode = elements.nodes.find(n => n.data.id === 'ex:Owner');
    expect(ownerNode?.data['skos:definition']).toBe('A person who owns a dog');
  });
});

describe('round-trip – prefix compression consistency', () => {
  it('uses context prefixes to compress node IDs consistently', () => {
    const nodes = [
      { data: { id: 'owl:Class', '@id': 'owl:Class', label: 'Class' } },
    ];
    const { elements } = roundTrip(nodes, []);
    expect(elements.nodes[0].data.id).toBe('owl:Class');
  });

  it('preserves context in returned graphData', () => {
    const nodes = [
      { data: { id: 'ex:A', '@id': 'ex:A', label: 'A' } },
    ];
    const gd = makeGraph(nodes, []);
    const ttl = exportToTurtle(gd, OWL_OPTIONS);
    const result = importFromTurtle(ttl, OWL_OPTIONS);
    expect(result.context).toBeDefined();
    expect(result.context.ex).toBe('http://example.org/');
  });
});

// ─── @vocab / @base handling ─────────────────────────────────────────────────

describe('@vocab context entry', () => {
  const VOCAB_CONTEXT = { '@vocab': 'http://example.org/' };
  const VOCAB_OPTIONS = { context: VOCAB_CONTEXT, edgeTypes: [] };

  it('expandIRI expands bare terms via @vocab', () => {
    expect(expandIRI('Person', VOCAB_CONTEXT)).toBe('http://example.org/Person');
  });

  it('expandIRI leaves prefixed names alone when @vocab is present', () => {
    const ctx = { '@vocab': 'http://example.org/', ex: 'http://other.org/' };
    expect(expandIRI('ex:Foo', ctx)).toBe('http://other.org/Foo');
  });

  it('expandIRI returns bare term unchanged when no @vocab', () => {
    expect(expandIRI('Person', {})).toBe('Person');
  });

  it('compressIRI does NOT produce @vocab:XXX prefixed names', () => {
    const result = compressIRI('http://example.org/Person', VOCAB_CONTEXT);
    // Must NOT return '@vocab:Person' – that would be invalid Turtle
    expect(result).not.toBe('@vocab:Person');
    // Should return the full IRI (no valid Turtle prefix to shorten to)
    expect(result).toBe('http://example.org/Person');
  });

  it('exported Turtle does not contain "@prefix @vocab:"', () => {
    const nodes = [{ data: { id: 'http://example.org/Person', label: 'Person' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), VOCAB_OPTIONS);
    expect(ttl).not.toContain('@prefix @vocab:');
    expect(ttl).not.toContain('@vocab:');
  });

  it('node with full IRI id is wrapped in <> in exported Turtle', () => {
    const nodes = [{ data: { id: 'http://example.org/Person', label: 'Person' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), VOCAB_OPTIONS);
    expect(ttl).toContain('<http://example.org/Person>');
  });

  it('round-trips a node whose id uses a full IRI (no prefix match)', () => {
    const nodes = [{ data: { id: 'http://example.org/Person', label: 'Person' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), VOCAB_OPTIONS);
    // Must be parseable without errors
    const result = importFromTurtle(ttl, VOCAB_OPTIONS);
    expect(result.elements.nodes.length).toBeGreaterThan(0);
  });
});

describe('@base context entry', () => {
  const BASE_CONTEXT = { '@base': 'http://example.org/', ex: 'http://example.org/' };
  const BASE_OPTIONS = { context: BASE_CONTEXT, edgeTypes: [] };

  it('exported Turtle contains @base directive', () => {
    const nodes = [{ data: { id: 'ex:Foo', '@id': 'ex:Foo', label: 'Foo' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), BASE_OPTIONS);
    expect(ttl).toContain('@base <http://example.org/> .');
  });

  it('exported Turtle does not contain "@prefix @base:"', () => {
    const nodes = [{ data: { id: 'ex:Foo', '@id': 'ex:Foo', label: 'Foo' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), BASE_OPTIONS);
    expect(ttl).not.toContain('@prefix @base:');
  });

  it('regular prefixes still appear alongside @base', () => {
    const nodes = [{ data: { id: 'ex:Foo', '@id': 'ex:Foo', label: 'Foo' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), BASE_OPTIONS);
    expect(ttl).toContain('@prefix ex: <http://example.org/> .');
  });
});

describe('nodes with bare or numeric IDs', () => {
  it('exports node with bare id (no colon) wrapped in angle brackets', () => {
    const nodes = [{ data: { id: 'myNode', label: 'My Node' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), { context: {}, edgeTypes: [] });
    expect(ttl).toContain('<myNode>');
  });

  it('exports node with numeric-looking id wrapped in angle brackets', () => {
    const nodes = [{ data: { id: '42', label: 'Forty Two' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), { context: {}, edgeTypes: [] });
    expect(ttl).toContain('<42>');
    // Must not appear as an unquoted numeric literal in subject position
    expect(ttl).not.toMatch(/^42 /m);
  });

  it('round-trips a node with a numeric-looking id without crashing', () => {
    const nodes = [{ data: { id: '42', label: 'Forty Two' } }];
    const ttl = exportToTurtle(makeGraph(nodes, []), { context: {}, edgeTypes: [] });
    // Should not throw
    expect(() => importFromTurtle(ttl, { context: {}, edgeTypes: [] })).not.toThrow();
  });
});
