import { describe, it, expect, beforeAll } from 'vitest';
import { importFromDotLD, exportToDotLD } from '../src/io/dot-ld.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MINIMAL = `# Minimal Example

::config
thing: circle, #333333, 80
Item: type=thing
::

This document mentions [[Item]].
`;

const HVAC = `# HVAC System Documentation

The primary cooling system uses a pump and cooling tower.

::config
// Equipment types
equipment: round-rectangle, #2196F3, 120
component: ellipse, #4CAF50, 80
control: diamond, #FF9800, 90

// Entity assignments
ChillerSystem: type=equipment
CoolingTower: type=equipment
Pump: type=component
Controller: type=control
Valve: type=component
::

The [[ChillerSystem]] is the primary cooling equipment.
It uses a [[Pump]] to circulate chilled water.

::rel ChillerSystem -> Pump [uses] ::
::rel ChillerSystem -> CoolingTower [requires] ::

A [[Controller]] monitors and adjusts the [[Valve]] position.

::rel Controller -> Valve [controls] ::
::rel Controller -> ChillerSystem [monitors] ::
`;

const BIDIRECTIONAL = `# Bidirectional Example

::config
service: ellipse, #2196F3, 100
ServiceA: type=service
ServiceB: type=service
::

::rel ServiceA <-> ServiceB [communicates_with] ::
`;

const BACKWARD = `# Backward Arrow Example

::config
service: ellipse, #2196F3, 100
Server: type=service
Database: type=service
::

::rel Server <- Database [provides_data_to] ::
`;

const MULTI_CONFIG = `# Multi-config Example

::config
equipment: round-rectangle, #2196F3, 120
ChillerSystem: type=equipment
::

Some text here.

::config
component: ellipse, #4CAF50, 80
Pump: type=component
::

::rel ChillerSystem -> Pump [uses] ::
`;

const WITH_PROPERTIES = `# Properties Example

::config
equipment: round-rectangle, #2196F3, 120
Machine: type=equipment, manufacturer="Acme Corp", model=X200
::
`;

// ─── importFromDotLD tests ────────────────────────────────────────────────────

describe('importFromDotLD', () => {

  describe('minimal example', () => {
    it('returns elements with one node', () => {
      const result = importFromDotLD(MINIMAL);
      expect(result.elements.nodes).toHaveLength(1);
      expect(result.elements.edges).toHaveLength(0);
    });

    it('extracts the title', () => {
      const result = importFromDotLD(MINIMAL);
      expect(result.title).toBe('Minimal Example');
    });

    it('creates a node with the entity name as id and label', () => {
      const result = importFromDotLD(MINIMAL);
      const node = result.elements.nodes[0];
      expect(node.data.id).toBe('Item');
      expect(node.data.label).toBe('Item');
    });

    it('stores the dot-ld type on the node', () => {
      const result = importFromDotLD(MINIMAL);
      expect(result.elements.nodes[0].data._dotldType).toBe('thing');
    });

    it('assigns a CSS class reflecting the type', () => {
      const result = importFromDotLD(MINIMAL);
      expect(result.elements.nodes[0].classes).toContain('dotld-type-thing');
    });

    it('includes a palette nodeType for the type definition', () => {
      const result = importFromDotLD(MINIMAL);
      const nt = result.palette.nodeTypes.find(t => t.id === 'thing');
      expect(nt).toBeTruthy();
      expect(nt.color).toBe('#333333');
      expect(nt.shape).toBe('ellipse'); // circle → ellipse
    });

    it('generates a stylesheet rule for the type', () => {
      const result = importFromDotLD(MINIMAL);
      const rule = result.userStylesheet.find(r => r.selector === '.dotld-type-thing');
      expect(rule).toBeTruthy();
      expect(rule.style['background-color']).toBe('#333333');
      expect(rule.style['shape']).toBe('ellipse');
    });
  });

  describe('HVAC example', () => {
    let result;
    beforeAll(() => { result = importFromDotLD(HVAC); });

    it('imports all five entities', () => {
      expect(result.elements.nodes).toHaveLength(5);
    });

    it('imports four edges', () => {
      expect(result.elements.edges).toHaveLength(4);
    });

    it('maps round-rectangle to roundrectangle', () => {
      const nt = result.palette.nodeTypes.find(t => t.id === 'equipment');
      expect(nt.shape).toBe('roundrectangle');
    });

    it('maps diamond shape correctly', () => {
      const nt = result.palette.nodeTypes.find(t => t.id === 'control');
      expect(nt.shape).toBe('diamond');
    });

    it('creates edges with correct source, target and label', () => {
      const edge = result.elements.edges.find(
        e => e.data.source === 'ChillerSystem' && e.data.target === 'Pump'
      );
      expect(edge).toBeTruthy();
      expect(edge.data.label).toBe('uses');
    });

    it('generates edge types from relationship labels', () => {
      const labels = result.palette.edgeTypes.map(et => et.id);
      expect(labels).toContain('uses');
      expect(labels).toContain('controls');
      expect(labels).toContain('monitors');
    });
  });

  describe('bidirectional arrow <->', () => {
    it('emits two directed edges for <->', () => {
      const result = importFromDotLD(BIDIRECTIONAL);
      expect(result.elements.edges).toHaveLength(2);
    });

    it('marks both edges with a shared _dotldBidi token', () => {
      const result = importFromDotLD(BIDIRECTIONAL);
      const [e1, e2] = result.elements.edges;
      expect(e1.data._dotldBidi).toBeTruthy();
      expect(e1.data._dotldBidi).toBe(e2.data._dotldBidi);
    });

    it('creates both forward and reverse directed edges', () => {
      const result = importFromDotLD(BIDIRECTIONAL);
      const srcA = result.elements.edges.find(e => e.data.source === 'ServiceA' && e.data.target === 'ServiceB');
      const srcB = result.elements.edges.find(e => e.data.source === 'ServiceB' && e.data.target === 'ServiceA');
      expect(srcA).toBeTruthy();
      expect(srcB).toBeTruthy();
    });
  });

  describe('backward arrow <-', () => {
    it('reverses the edge direction', () => {
      const result = importFromDotLD(BACKWARD);
      // ::rel Server <- Database :: means Database provides_data_to Server
      // → edge from Database to Server
      const edge = result.elements.edges[0];
      expect(edge.data.source).toBe('Database');
      expect(edge.data.target).toBe('Server');
      expect(edge.data.label).toBe('provides_data_to');
    });
  });

  describe('multiple ::config blocks', () => {
    it('merges type definitions from both blocks', () => {
      const result = importFromDotLD(MULTI_CONFIG);
      const typeIds = result.palette.nodeTypes.map(t => t.id);
      expect(typeIds).toContain('equipment');
      expect(typeIds).toContain('component');
    });

    it('merges entity assignments from both blocks', () => {
      const result = importFromDotLD(MULTI_CONFIG);
      const nodeIds = result.elements.nodes.map(n => n.data.id);
      expect(nodeIds).toContain('ChillerSystem');
      expect(nodeIds).toContain('Pump');
    });
  });

  describe('entity properties', () => {
    it('stores extra properties on the node data', () => {
      const result = importFromDotLD(WITH_PROPERTIES);
      const node = result.elements.nodes.find(n => n.data.id === 'Machine');
      expect(node).toBeTruthy();
      expect(node.data.manufacturer).toBe('Acme Corp');
      expect(node.data.model).toBe('X200');
    });
  });

  describe('undefined entities', () => {
    it('creates nodes for entities only referenced in [[]] but not in config', () => {
      const text = `# Test\n::config\nthing: ellipse, #333333, 80\n::\nThe [[Unknown]] exists.\n`;
      const result = importFromDotLD(text);
      const node = result.elements.nodes.find(n => n.data.id === 'Unknown');
      expect(node).toBeTruthy();
      expect(node.data._dotldType).toBe('_undefined');
    });

    it('creates nodes for entities only referenced in ::rel but not in config', () => {
      const text = `# Test\n::config\nthing: ellipse, #333333, 80\nKnown: type=thing\n::\n::rel Known -> Ghost [uses] ::\n`;
      const result = importFromDotLD(text);
      const node = result.elements.nodes.find(n => n.data.id === 'Ghost');
      expect(node).toBeTruthy();
    });
  });

  describe('return shape', () => {
    it('always returns elements, palette, userStylesheet, and version', () => {
      const result = importFromDotLD(MINIMAL);
      expect(result).toHaveProperty('elements');
      expect(result).toHaveProperty('palette');
      expect(result).toHaveProperty('userStylesheet');
      expect(result).toHaveProperty('version');
    });

    it('palette has nodeTypes and edgeTypes arrays', () => {
      const result = importFromDotLD(HVAC);
      expect(Array.isArray(result.palette.nodeTypes)).toBe(true);
      expect(Array.isArray(result.palette.edgeTypes)).toBe(true);
    });
  });
});

// ─── exportToDotLD tests ──────────────────────────────────────────────────────

describe('exportToDotLD', () => {

  const SIMPLE_GRAPH = {
    title: 'Test Graph',
    description: 'A test knowledge graph.',
    palette: {
      nodeTypes: [
        { id: 'equipment', label: 'equipment', color: '#2196F3', borderColor: '#1760a3', shape: 'roundrectangle', _dotldSize: 120 },
        { id: 'component', label: 'component', color: '#4CAF50', borderColor: '#2e7d32', shape: 'ellipse',         _dotldSize: 80  },
      ],
      edgeTypes: [
        { id: 'uses', label: 'uses', color: '#555', lineStyle: 'solid' },
      ],
    },
    elements: {
      nodes: [
        { data: { id: 'ChillerSystem', label: 'ChillerSystem', _dotldType: 'equipment' } },
        { data: { id: 'Pump',          label: 'Pump',          _dotldType: 'component' } },
      ],
      edges: [
        { data: { id: 'e0', source: 'ChillerSystem', target: 'Pump', label: 'uses' } },
      ],
    },
    userStylesheet: [],
  };

  it('produces a string', () => {
    const output = exportToDotLD(SIMPLE_GRAPH);
    expect(typeof output).toBe('string');
  });

  it('includes the graph title as a level-1 heading', () => {
    const output = exportToDotLD(SIMPLE_GRAPH);
    expect(output).toContain('# Test Graph');
  });

  it('includes the description', () => {
    const output = exportToDotLD(SIMPLE_GRAPH);
    expect(output).toContain('A test knowledge graph.');
  });

  it('contains a ::config block', () => {
    const output = exportToDotLD(SIMPLE_GRAPH);
    expect(output).toContain('::config');
    expect(output).toMatch(/\n::/m);
  });

  it('emits type definitions for palette node types', () => {
    const output = exportToDotLD(SIMPLE_GRAPH);
    expect(output).toContain('equipment: round-rectangle, #2196F3, 120');
    expect(output).toContain('component: ellipse, #4CAF50, 80');
  });

  it('emits entity assignments for nodes', () => {
    const output = exportToDotLD(SIMPLE_GRAPH);
    expect(output).toContain('ChillerSystem: type=equipment');
    expect(output).toContain('Pump: type=component');
  });

  it('includes [[EntityName]] references in prose', () => {
    const output = exportToDotLD(SIMPLE_GRAPH);
    expect(output).toContain('[[ChillerSystem]]');
    expect(output).toContain('[[Pump]]');
  });

  it('emits a ::rel block for edges', () => {
    const output = exportToDotLD(SIMPLE_GRAPH);
    expect(output).toContain('::rel ChillerSystem -> Pump [uses] ::');
  });

  it('emits <-> notation for bidirectional edges', () => {
    const graph = {
      ...SIMPLE_GRAPH,
      elements: {
        nodes: [
          { data: { id: 'A', label: 'A', _dotldType: 'equipment' } },
          { data: { id: 'B', label: 'B', _dotldType: 'equipment' } },
        ],
        edges: [
          { data: { id: 'bidi_0_f', source: 'A', target: 'B', label: 'linked', _dotldBidi: 'bidi_0' } },
          { data: { id: 'bidi_0_r', source: 'B', target: 'A', label: 'linked', _dotldBidi: 'bidi_0' } },
        ],
      },
    };
    const output = exportToDotLD(graph);
    expect(output).toContain('<->');
    // The bidi pair should appear only once
    const count = (output.match(/::rel A <-> B \[linked\] ::/g) || []).length;
    expect(count).toBe(1);
  });

  it('uses a fallback title when none is provided', () => {
    const graph = { ...SIMPLE_GRAPH, title: '' };
    const output = exportToDotLD(graph);
    expect(output).toContain('# Knowledge Graph');
  });
});

// ─── Round-trip tests ─────────────────────────────────────────────────────────

describe('DOT-LD round-trip', () => {
  it('can re-import the markdown produced by exportToDotLD', () => {
    const original = importFromDotLD(HVAC);
    const markdown  = exportToDotLD(original);
    const roundtrip = importFromDotLD(markdown);

    const origIds = original.elements.nodes.map(n => n.data.id).sort();
    const rtIds   = roundtrip.elements.nodes.map(n => n.data.id).sort();
    expect(rtIds).toEqual(origIds);

    expect(roundtrip.elements.edges).toHaveLength(original.elements.edges.length);
  });

  it('preserves type definitions through the round-trip', () => {
    const original  = importFromDotLD(HVAC);
    const markdown  = exportToDotLD(original);
    const roundtrip = importFromDotLD(markdown);

    const origTypes = original.palette.nodeTypes
      .filter(t => t.id !== '_undefined')
      .map(t => t.id).sort();
    const rtTypes   = roundtrip.palette.nodeTypes
      .filter(t => t.id !== '_undefined')
      .map(t => t.id).sort();
    expect(rtTypes).toEqual(origTypes);
  });
});

// ─── Palette type mapping tests (complex type mappings) ───────────────────────

const OWL_NODE_TYPES = [
  {
    id: 'owl:Class',
    label: 'Class',
    data: { '@type': 'owl:Class', '@id': '', 'skos:definition': '' },
    color: '#E6F3FF',
    borderColor: '#2471A3',
    shape: 'roundrectangle',
  },
  {
    id: 'default',
    label: 'Instance',
    data: { '@type': '', '@id': '' },
    color: '#FFFFFF',
    borderColor: '#666666',
    shape: 'ellipse',
  },
];

const OWL_EDGE_TYPES = [
  {
    id: 'rdfs:subClassOf',
    label: 'subClassOf',
    data: { '@id': 'rdfs:subClassOf' },
    color: '#555555',
    lineStyle: 'solid',
  },
  {
    id: 'owl:ObjectProperty',
    label: 'ObjectProperty',
    data: { '@type': 'owl:ObjectProperty', '@id': '', 'skos:definition': '' },
    color: '#2471A3',
    lineStyle: 'dashed',
    source_property: 'rdfs:domain',
    target_property: 'rdfs:range',
  },
];

// DOT-LD document that uses labels matching the OWL palette
const OWL_DOTLD = `# OWL Example

::config
owl:Class: round-rectangle, #E6F3FF, 100
Animal: type=owl:Class
Dog: type=owl:Class
::

::rel Animal -> Dog [subClassOf] ::
`;

// DOT-LD document that uses human-readable labels from the OWL palette
const OWL_DOTLD_LABEL = `# OWL Example by label

::config
Class: round-rectangle, #E6F3FF, 100
Animal: type=Class
Dog: type=Class
::

::rel Animal -> Dog [subClassOf] ::
`;

describe('importFromDotLD with palette nodeTypes option', () => {
  it('enriches nodes with @type from matching palette nodeType by id', () => {
    const result = importFromDotLD(OWL_DOTLD, { nodeTypes: OWL_NODE_TYPES });
    const animal = result.elements.nodes.find(n => n.data.id === 'Animal');
    expect(animal).toBeTruthy();
    expect(animal.data['@type']).toBe('owl:Class');
  });

  it('enriches nodes with @type from matching palette nodeType by label', () => {
    const result = importFromDotLD(OWL_DOTLD_LABEL, { nodeTypes: OWL_NODE_TYPES });
    const animal = result.elements.nodes.find(n => n.data.id === 'Animal');
    expect(animal).toBeTruthy();
    expect(animal.data['@type']).toBe('owl:Class');
  });

  it('does not overwrite properties already set in the entity assignment', () => {
    const text = `# Test\n::config\nClass: ellipse, #333333, 80\nFoo: type=Class, @type="custom:Type"\n::\n`;
    const result = importFromDotLD(text, { nodeTypes: OWL_NODE_TYPES });
    const foo = result.elements.nodes.find(n => n.data.id === 'Foo');
    // Entity assignment value takes precedence over palette default
    expect(foo.data['@type']).toBe('custom:Type');
  });

  it('skips empty palette template values', () => {
    const result = importFromDotLD(OWL_DOTLD, { nodeTypes: OWL_NODE_TYPES });
    const animal = result.elements.nodes.find(n => n.data.id === 'Animal');
    // '@id' is empty in the template, should not be added
    expect('@id' in animal.data).toBe(false);
    // 'skos:definition' is empty in the template, should not be added
    expect('skos:definition' in animal.data).toBe(false);
  });

  it('works correctly when no nodeTypes option is provided', () => {
    const result = importFromDotLD(OWL_DOTLD);
    const animal = result.elements.nodes.find(n => n.data.id === 'Animal');
    expect(animal).toBeTruthy();
    expect(animal.data['@type']).toBeUndefined();
  });
});

describe('importFromDotLD with palette edgeTypes option', () => {
  it('enriches plain-triple edges with @id from matching edgeType by label', () => {
    const result = importFromDotLD(OWL_DOTLD, { edgeTypes: OWL_EDGE_TYPES });
    const edge = result.elements.edges.find(
      e => e.data.source === 'Animal' && e.data.target === 'Dog'
    );
    expect(edge).toBeTruthy();
    expect(edge.data['@id']).toBe('rdfs:subClassOf');
  });

  it('enriches reified edges with @type from matching edgeType by label', () => {
    const text = `# Test\n::config\nClass: ellipse, #333333, 80\nA: type=Class\nB: type=Class\n::\n::rel A -> B [ObjectProperty] ::\n`;
    const result = importFromDotLD(text, { edgeTypes: OWL_EDGE_TYPES });
    const edge = result.elements.edges.find(e => e.data.source === 'A' && e.data.target === 'B');
    expect(edge).toBeTruthy();
    expect(edge.data['@type']).toBe('owl:ObjectProperty');
  });

  it('matches edgeType by local name of data[@id]', () => {
    // "subClassOf" is the local name of "rdfs:subClassOf" in data['@id']
    const text = `# Test\n::config\nClass: ellipse, #333333, 80\nA: type=Class\nB: type=Class\n::\n::rel A -> B [subClassOf] ::\n`;
    const result = importFromDotLD(text, { edgeTypes: OWL_EDGE_TYPES });
    const edge = result.elements.edges[0];
    expect(edge.data['@id']).toBe('rdfs:subClassOf');
  });

  it('does not fail when edgeType has no matching label', () => {
    const result = importFromDotLD(HVAC, { edgeTypes: OWL_EDGE_TYPES });
    // The HVAC uses labels like "uses", "requires", "controls" which don't match OWL types
    expect(result.elements.edges).toHaveLength(4);
    // Edges should not have @id or @type since nothing matched
    result.elements.edges.forEach(e => {
      expect(e.data['@id']).toBeUndefined();
      expect(e.data['@type']).toBeUndefined();
    });
  });

  it('enriches bidirectional edges with palette data', () => {
    const text = `# Test\n::config\nClass: ellipse, #333333, 80\nA: type=Class\nB: type=Class\n::\n::rel A <-> B [subClassOf] ::\n`;
    const result = importFromDotLD(text, { edgeTypes: OWL_EDGE_TYPES });
    expect(result.elements.edges).toHaveLength(2);
    result.elements.edges.forEach(e => {
      expect(e.data['@id']).toBe('rdfs:subClassOf');
    });
  });
});

describe('DOT-LD extended property key parsing', () => {
  it('parses @-prefixed property keys from entity assignments', () => {
    const text = `# Test\n::config\nClass: ellipse, #333333, 80\nFoo: type=Class, @type="owl:Class"\n::\n`;
    const result = importFromDotLD(text);
    const foo = result.elements.nodes.find(n => n.data.id === 'Foo');
    expect(foo.data['@type']).toBe('owl:Class');
  });

  it('parses colon-containing property keys (prefixed IRIs) from entity assignments', () => {
    const text = `# Test\n::config\nClass: ellipse, #333333, 80\nFoo: type=Class, skos:definition="A test concept"\n::\n`;
    const result = importFromDotLD(text);
    const foo = result.elements.nodes.find(n => n.data.id === 'Foo');
    expect(foo.data['skos:definition']).toBe('A test concept');
  });

  it('round-trips @-prefixed properties through export and re-import', () => {
    const graph = {
      title: 'OWL Graph',
      description: '',
      palette: {
        nodeTypes: [
          { id: 'owl:Class', label: 'Class', color: '#E6F3FF', borderColor: '#2471A3', shape: 'roundrectangle', _dotldSize: 100 },
        ],
        edgeTypes: [],
      },
      elements: {
        nodes: [
          { data: { id: 'Animal', label: 'Animal', _dotldType: 'owl:Class', '@type': 'owl:Class' } },
        ],
        edges: [],
      },
      userStylesheet: [],
    };
    const markdown = exportToDotLD(graph);
    expect(markdown).toContain('@type="owl:Class"');

    const reimported = importFromDotLD(markdown);
    const node = reimported.elements.nodes.find(n => n.data.id === 'Animal');
    expect(node.data['@type']).toBe('owl:Class');
  });

  it('round-trips colon-containing property keys through export and re-import', () => {
    const graph = {
      title: 'SKOS Graph',
      description: '',
      palette: {
        nodeTypes: [
          { id: 'Concept', label: 'Concept', color: '#E6F3FF', borderColor: '#2471A3', shape: 'roundrectangle', _dotldSize: 100 },
        ],
        edgeTypes: [],
      },
      elements: {
        nodes: [
          { data: { id: 'Cat', label: 'Cat', _dotldType: 'Concept', 'skos:definition': 'A domestic feline' } },
        ],
        edges: [],
      },
      userStylesheet: [],
    };
    const markdown = exportToDotLD(graph);
    expect(markdown).toContain('skos:definition=');

    const reimported = importFromDotLD(markdown);
    const node = reimported.elements.nodes.find(n => n.data.id === 'Cat');
    expect(node.data['skos:definition']).toBe('A domestic feline');
  });
});
