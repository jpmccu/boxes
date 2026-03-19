import { describe, it, expect } from 'vitest';
import { importFromArrows, exportToArrows } from '../src/io/arrows.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ARROWS_SIMPLE = {
  nodes: [
    {
      id: 'n0',
      position: { x: 100, y: 200 },
      caption: 'Alice',
      labels: ['Person'],
      properties: { age: '30' },
      style: { 'node-color': '#FF0000', 'node-size': 50 },
    },
    {
      id: 'n1',
      position: { x: 300, y: 200 },
      caption: 'Bob',
      labels: ['Person'],
      properties: {},
      style: {},
    },
  ],
  relationships: [
    {
      id: 'r0',
      fromId: 'n0',
      toId: 'n1',
      type: 'KNOWS',
      properties: { since: '2020' },
      style: { 'arrow-color': '#0000FF' },
    },
  ],
  style: {},
};

const ARROWS_WRAPPED = {
  graph: ARROWS_SIMPLE,
  gangs: [],
};

// ─── Import tests ─────────────────────────────────────────────────────────────

describe('importFromArrows', () => {
  it('should import flat format', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    expect(result.elements.nodes).toHaveLength(2);
    expect(result.elements.edges).toHaveLength(1);
  });

  it('should import wrapped { graph: ... } format', () => {
    const result = importFromArrows(ARROWS_WRAPPED);
    expect(result.elements.nodes).toHaveLength(2);
    expect(result.elements.edges).toHaveLength(1);
  });

  it('should map node caption to label', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    expect(result.elements.nodes[0].data.label).toBe('Alice');
  });

  it('should preserve node id and position', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    const node = result.elements.nodes[0];
    expect(node.data.id).toBe('n0');
    expect(node.position).toEqual({ x: 100, y: 200 });
  });

  it('should store labels array', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    expect(result.elements.nodes[0].data.labels).toEqual(['Person']);
  });

  it('should spread user properties into data', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    expect(result.elements.nodes[0].data.age).toBe('30');
  });

  it('should translate node-color to background-color', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    expect(result.elements.nodes[0].data._style['background-color']).toBe('#FF0000');
  });

  it('should translate node-size to width and height', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    expect(result.elements.nodes[0].data._style['width']).toBe(50);
    expect(result.elements.nodes[0].data._style['height']).toBe(50);
  });

  it('should map relationship fromId/toId to source/target', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    const edge = result.elements.edges[0];
    expect(edge.data.source).toBe('n0');
    expect(edge.data.target).toBe('n1');
  });

  it('should map relationship type to label', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    expect(result.elements.edges[0].data.label).toBe('KNOWS');
  });

  it('should spread relationship properties into edge data', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    expect(result.elements.edges[0].data.since).toBe('2020');
  });

  it('should fan-out arrow-color to line-color and target-arrow-color', () => {
    const result = importFromArrows(ARROWS_SIMPLE);
    const style = result.elements.edges[0].data._style;
    expect(style['line-color']).toBe('#0000FF');
    expect(style['target-arrow-color']).toBe('#0000FF');
  });

  it('should store unknown Arrows style props in _arrowsStyle', () => {
    const data = {
      nodes: [{ id: 'n0', position: { x: 0, y: 0 }, caption: '', labels: [], properties: {},
                style: { 'unknown-prop': 'foo' } }],
      relationships: [],
      style: {},
    };
    const result = importFromArrows(data);
    expect(result.elements.nodes[0].data._arrowsStyle['unknown-prop']).toBe('foo');
  });

  it('should drop relationships with missing endpoints', () => {
    const data = {
      nodes: [{ id: 'n0', position: { x: 0, y: 0 }, caption: '', labels: [], properties: {}, style: {} }],
      relationships: [{ id: 'r0', fromId: 'n0', toId: 'MISSING', type: 'X', properties: {}, style: {} }],
      style: {},
    };
    const result = importFromArrows(data);
    expect(result.elements.edges).toHaveLength(0);
  });

  it('should throw on invalid input', () => {
    expect(() => importFromArrows(null)).toThrow();
    expect(() => importFromArrows({})).toThrow();
  });
});

// ─── Export tests ─────────────────────────────────────────────────────────────

describe('exportToArrows', () => {
  it('should export nodes and relationships', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });
    expect(exported.nodes).toHaveLength(2);
    expect(exported.relationships).toHaveLength(1);
  });

  it('should map label back to caption', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });
    expect(exported.nodes[0].caption).toBe('Alice');
  });

  it('should map source/target back to fromId/toId', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });
    const rel = exported.relationships[0];
    expect(rel.fromId).toBe('n0');
    expect(rel.toId).toBe('n1');
  });

  it('should map relationship label back to type', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });
    expect(exported.relationships[0].type).toBe('KNOWS');
  });

  it('should translate background-color back to node-color', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });
    expect(exported.nodes[0].style['node-color']).toBe('#FF0000');
  });

  it('should translate width/height back to node-size', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });
    expect(exported.nodes[0].style['node-size']).toBe(50);
  });

  it('should put user properties back in properties object', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });
    expect(exported.nodes[0].properties.age).toBe('30');
    expect(exported.relationships[0].properties.since).toBe('2020');
  });

  it('should not include internal fields in properties', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });
    const nodeProps = exported.nodes[0].properties;
    expect(nodeProps).not.toHaveProperty('id');
    expect(nodeProps).not.toHaveProperty('label');
    expect(nodeProps).not.toHaveProperty('_style');
  });
});

// ─── Round-trip test ──────────────────────────────────────────────────────────

describe('round-trip', () => {
  it('should survive import → export with same structure', () => {
    const imported = importFromArrows(ARROWS_SIMPLE);
    const exported = exportToArrows({ elements: imported.elements });

    expect(exported.nodes[0].id).toBe('n0');
    expect(exported.nodes[0].caption).toBe('Alice');
    expect(exported.nodes[0].labels).toEqual(['Person']);
    expect(exported.nodes[0].properties.age).toBe('30');

    expect(exported.relationships[0].fromId).toBe('n0');
    expect(exported.relationships[0].toId).toBe('n1');
    expect(exported.relationships[0].type).toBe('KNOWS');
    expect(exported.relationships[0].properties.since).toBe('2020');
  });

  it('should restore unknown Arrows style props on export', () => {
    const data = {
      nodes: [{ id: 'n0', position: { x: 0, y: 0 }, caption: 'X', labels: [], properties: {},
                style: { 'icon-image': 'person.png' } }],
      relationships: [],
      style: {},
    };
    const imported = importFromArrows(data);
    const exported = exportToArrows({ elements: imported.elements });
    expect(exported.nodes[0].style['icon-image']).toBe('person.png');
  });
});
