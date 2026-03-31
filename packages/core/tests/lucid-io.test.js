import { describe, it, expect } from 'vitest';
import { exportToLucid } from '../src/io/lucid.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SIMPLE_GRAPH = {
  elements: {
    nodes: [
      {
        data: {
          id: 'n0',
          label: 'Alice',
          age: '30',
          _style: { 'background-color': '#FF0000', width: 120, height: 60 },
        },
        position: { x: 160, y: 130 },
      },
      {
        data: {
          id: 'n1',
          label: 'Bob',
          _style: {},
        },
        position: { x: 400, y: 130 },
      },
    ],
    edges: [
      {
        data: {
          id: 'e0',
          source: 'n0',
          target: 'n1',
          label: 'KNOWS',
          since: '2020',
          _style: { 'line-color': '#0000FF', width: 2 },
        },
      },
    ],
  },
};

// ─── Top-level document structure ─────────────────────────────────────────────

describe('exportToLucid – document structure', () => {
  it('should produce version 1', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.version).toBe(1);
  });

  it('should default to lucidchart product', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.product).toBe('lucidchart');
  });

  it('should respect the product option', () => {
    const doc = exportToLucid(SIMPLE_GRAPH, { product: 'lucidspark' });
    expect(doc.product).toBe('lucidspark');
  });

  it('should use the provided title', () => {
    const doc = exportToLucid(SIMPLE_GRAPH, { title: 'My Test' });
    expect(doc.title).toBe('My Test');
  });

  it('should default to "Boxes Export" title', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.title).toBe('Boxes Export');
  });

  it('should produce exactly one page', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages).toHaveLength(1);
  });

  it('should set page id and title', () => {
    const doc = exportToLucid(SIMPLE_GRAPH, { pageTitle: 'Test Page' });
    expect(doc.pages[0].id).toBe('page1');
    expect(doc.pages[0].title).toBe('Test Page');
  });
});

// ─── Shapes ───────────────────────────────────────────────────────────────────

describe('exportToLucid – shapes', () => {
  it('should export one shape per node', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].shapes).toHaveLength(2);
  });

  it('should preserve node id as string', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].shapes[0].id).toBe('n0');
  });

  it('should map label to text', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].shapes[0].text).toBe('Alice');
  });

  it('should default shape type to rectangle', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].shapes[0].type).toBe('rectangle');
  });

  it('should map ellipse Cytoscape shape to circle', () => {
    const graph = {
      elements: {
        nodes: [{ data: { id: 'n0', label: 'X', _style: { shape: 'ellipse' } }, position: { x: 0, y: 0 } }],
        edges: [],
      },
    };
    const doc = exportToLucid(graph);
    expect(doc.pages[0].shapes[0].type).toBe('circle');
  });

  it('should map diamond Cytoscape shape to diamond', () => {
    const graph = {
      elements: {
        nodes: [{ data: { id: 'n0', label: 'X', _style: { shape: 'diamond' } }, position: { x: 0, y: 0 } }],
        edges: [],
      },
    };
    const doc = exportToLucid(graph);
    expect(doc.pages[0].shapes[0].type).toBe('diamond');
  });

  it('should compute boundingBox from position and size (center → top-left)', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    const bb = doc.pages[0].shapes[0].boundingBox;
    // position is { x: 160, y: 130 }, size 120×60 → top-left (100, 100)
    expect(bb.x).toBe(100);
    expect(bb.y).toBe(100);
    expect(bb.w).toBe(120);
    expect(bb.h).toBe(60);
  });

  it('should use default dimensions when no size in _style', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    const bb = doc.pages[0].shapes[1].boundingBox; // Bob has no size
    expect(bb.w).toBe(120);
    expect(bb.h).toBe(60);
  });

  it('should use zero position when node has no position', () => {
    const graph = {
      elements: {
        nodes: [{ data: { id: 'n0', label: 'X', _style: {} } }],
        edges: [],
      },
    };
    const doc = exportToLucid(graph);
    const bb = doc.pages[0].shapes[0].boundingBox;
    expect(bb.x).toBe(-60); // 0 - 120/2
    expect(bb.y).toBe(-30); // 0 - 60/2
  });

  it('should map background-color to fill.color', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].shapes[0].style.fill).toEqual({ type: 'color', color: '#FF0000' });
  });

  it('should map border-color to stroke.color', () => {
    const graph = {
      elements: {
        nodes: [{ data: { id: 'n0', label: '', _style: { 'border-color': '#333333', 'border-width': 3 } }, position: { x: 0, y: 0 } }],
        edges: [],
      },
    };
    const doc = exportToLucid(graph);
    const stroke = doc.pages[0].shapes[0].style.stroke;
    expect(stroke.color).toBe('#333333');
    expect(stroke.width).toBe(3);
  });

  it('should omit style when no relevant _style props are set', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].shapes[1]).not.toHaveProperty('style');
  });

  it('should put user properties into customData', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    const customData = doc.pages[0].shapes[0].customData;
    expect(customData).toContainEqual({ key: 'age', value: '30' });
  });

  it('should not include internal fields in customData', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    const customData = doc.pages[0].shapes[0].customData ?? [];
    const keys = customData.map(d => d.key);
    expect(keys).not.toContain('id');
    expect(keys).not.toContain('label');
    expect(keys).not.toContain('_style');
  });

  it('should omit customData when there are no user properties', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].shapes[1]).not.toHaveProperty('customData');
  });
});

// ─── Lines ────────────────────────────────────────────────────────────────────

describe('exportToLucid – lines', () => {
  it('should export one line per edge', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].lines).toHaveLength(1);
  });

  it('should preserve edge id as string', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].lines[0].id).toBe('e0');
  });

  it('should set endpoint1 shapeId to source', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].lines[0].endpoint1.shapeId).toBe('n0');
  });

  it('should set endpoint2 shapeId to target', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].lines[0].endpoint2.shapeId).toBe('n1');
  });

  it('should set endpoint1 style to none and endpoint2 style to arrow', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    const line = doc.pages[0].lines[0];
    expect(line.endpoint1.style).toBe('none');
    expect(line.endpoint2.style).toBe('arrow');
  });

  it('should set both endpoints to shapeEndpoint type', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    const line = doc.pages[0].lines[0];
    expect(line.endpoint1.type).toBe('shapeEndpoint');
    expect(line.endpoint2.type).toBe('shapeEndpoint');
  });

  it('should map label to text array at middle position', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    const line = doc.pages[0].lines[0];
    expect(line.text).toEqual([{ text: 'KNOWS', position: 0.5, side: 'middle' }]);
  });

  it('should omit text when edge has no label', () => {
    const graph = {
      elements: {
        nodes: [
          { data: { id: 'n0', label: '', _style: {} }, position: { x: 0, y: 0 } },
          { data: { id: 'n1', label: '', _style: {} }, position: { x: 0, y: 0 } },
        ],
        edges: [{ data: { id: 'e0', source: 'n0', target: 'n1', label: '', _style: {} } }],
      },
    };
    const doc = exportToLucid(graph);
    expect(doc.pages[0].lines[0]).not.toHaveProperty('text');
  });

  it('should map line-color to stroke.color', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].lines[0].stroke.color).toBe('#0000FF');
  });

  it('should map width to stroke.width', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].lines[0].stroke.width).toBe(2);
  });

  it('should use target-arrow-color as fallback stroke color', () => {
    const graph = {
      elements: {
        nodes: [
          { data: { id: 'n0', label: '', _style: {} }, position: { x: 0, y: 0 } },
          { data: { id: 'n1', label: '', _style: {} }, position: { x: 0, y: 0 } },
        ],
        edges: [{ data: { id: 'e0', source: 'n0', target: 'n1', label: '', _style: { 'target-arrow-color': '#AABBCC' } } }],
      },
    };
    const doc = exportToLucid(graph);
    expect(doc.pages[0].lines[0].stroke.color).toBe('#AABBCC');
  });

  it('should omit stroke when no color or width in _style', () => {
    const graph = {
      elements: {
        nodes: [
          { data: { id: 'n0', label: '', _style: {} }, position: { x: 0, y: 0 } },
          { data: { id: 'n1', label: '', _style: {} }, position: { x: 0, y: 0 } },
        ],
        edges: [{ data: { id: 'e0', source: 'n0', target: 'n1', label: '', _style: {} } }],
      },
    };
    const doc = exportToLucid(graph);
    expect(doc.pages[0].lines[0]).not.toHaveProperty('stroke');
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('exportToLucid – edge cases', () => {
  it('should handle empty graph', () => {
    const doc = exportToLucid({ elements: { nodes: [], edges: [] } });
    expect(doc.pages[0].shapes).toHaveLength(0);
    expect(doc.pages[0].lines).toHaveLength(0);
  });

  it('should handle null/undefined elements gracefully', () => {
    const doc = exportToLucid({});
    expect(doc.pages[0].shapes).toHaveLength(0);
    expect(doc.pages[0].lines).toHaveLength(0);
  });

  it('should handle nodes with no _style', () => {
    const graph = {
      elements: {
        nodes: [{ data: { id: 'n0', label: 'X' }, position: { x: 50, y: 50 } }],
        edges: [],
      },
    };
    expect(() => exportToLucid(graph)).not.toThrow();
    const doc = exportToLucid(graph);
    expect(doc.pages[0].shapes[0].text).toBe('X');
  });

  it('should use lineType elbow for all lines', () => {
    const doc = exportToLucid(SIMPLE_GRAPH);
    expect(doc.pages[0].lines[0].lineType).toBe('elbow');
  });
});
