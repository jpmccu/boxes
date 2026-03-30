import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';

describe('BoxesEditor', () => {
  let container;
  let editor;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('initialization', () => {
    it('should create an instance with a container', () => {
      editor = new BoxesEditor(container);
      expect(editor).toBeDefined();
      expect(editor.cy).toBeDefined();
    });

    it('should throw error without container', () => {
      expect(() => new BoxesEditor(null)).toThrow('Container element is required');
    });

    it('should initialize with elements', () => {
      editor = new BoxesEditor(container, {
        elements: {
          nodes: [{ data: { id: 'n1', label: 'Node 1' } }],
          edges: []
        }
      });
      
      const elements = editor.getElements();
      expect(elements.nodes).toHaveLength(1);
      expect(elements.nodes[0].data.id).toBe('n1');
    });
  });

  describe('node operations', () => {
    beforeEach(() => {
      editor = new BoxesEditor(container);
    });

    it('should add a node', () => {
      const node = editor.addNode({ id: 'n1', label: 'Test Node' });
      expect(node.data.id).toBe('n1');
      expect(node.data.label).toBe('Test Node');
    });

    it('should add a node with custom style', () => {
      const node = editor.addNode(
        { id: 'n1', label: 'Styled Node' },
        null,
        { 'background-color': 'red' }
      );
      expect(node.data._style).toEqual({ 'background-color': 'red' });
    });

    it('should update node data', () => {
      editor.addNode({ id: 'n1', label: 'Original' });
      const updated = editor.updateElement('n1', { label: 'Updated' });
      expect(updated.data.label).toBe('Updated');
    });

    it('should update node style', () => {
      editor.addNode({ id: 'n1', label: 'Node' });
      const style = editor.updateElementStyle('n1', { 'background-color': 'blue' });
      expect(style['background-color']).toBe('blue');
    });

    it('should remove a node', () => {
      editor.addNode({ id: 'n1', label: 'Node' });
      const removed = editor.removeElement('n1');
      expect(removed).toBe(true);
      expect(editor.getElements().nodes).toHaveLength(0);
    });
  });

  describe('edge operations', () => {
    beforeEach(() => {
      editor = new BoxesEditor(container);
      editor.addNode({ id: 'n1', label: 'Node 1' });
      editor.addNode({ id: 'n2', label: 'Node 2' });
    });

    it('should add an edge', () => {
      const edge = editor.addEdge('n1', 'n2', { label: 'connects' });
      expect(edge.data.source).toBe('n1');
      expect(edge.data.target).toBe('n2');
      expect(edge.data.label).toBe('connects');
    });

    it('should add an edge with custom style', () => {
      const edge = editor.addEdge('n1', 'n2', { label: 'styled' }, { 'line-color': 'red' });
      expect(edge.data._style).toEqual({ 'line-color': 'red' });
    });

    it('should remove an edge', () => {
      const edge = editor.addEdge('n1', 'n2');
      const removed = editor.removeElement(edge.data.id);
      expect(removed).toBe(true);
      expect(editor.getElements().edges).toHaveLength(0);
    });
  });

  describe('layout operations', () => {
    beforeEach(() => {
      editor = new BoxesEditor(container);
      editor.addNode({ id: 'n1', label: 'Node 1' });
      editor.addNode({ id: 'n2', label: 'Node 2' });
      editor.addNode({ id: 'n3', label: 'Node 3' });
    });

    it('should get available layouts', () => {
      const layouts = editor.getAvailableLayouts();
      expect(layouts.some(l => l.name === 'grid')).toBe(true);
      expect(layouts.some(l => l.name === 'circle')).toBe(true);
      expect(layouts.some(l => l.name === 'cose')).toBe(true);
    });

    it('should run a layout', () => {
      let layoutRan = false;
      editor.on('layoutRun', () => {
        layoutRan = true;
      });

      editor.runLayout({ name: 'null' });
      expect(layoutRan).toBe(true);
    });
  });

  describe('import/export', () => {
    beforeEach(() => {
      editor = new BoxesEditor(container);
    });

    it('should export graph data including palette', () => {
      editor.addNode({ id: 'n1', label: 'Node 1' });
      editor.addEdge('n1', 'n1', { label: 'self' });

      const exported = editor.exportGraph();
      expect(exported.elements.nodes).toHaveLength(1);
      expect(exported.elements.edges).toHaveLength(1);
      expect(exported.version).toBe('1.0.0');
      expect(exported.palette).toBeDefined();
      expect(Array.isArray(exported.palette.nodeTypes)).toBe(true);
      expect(Array.isArray(exported.palette.edgeTypes)).toBe(true);
    });

    it('should restore palette from importGraph', () => {
      const graphData = {
        elements: { nodes: [], edges: [] },
        palette: {
          nodeTypes: [{ id: 'myNode', label: 'My Node', data: {}, color: '#ff0000', shape: 'ellipse' }],
          edgeTypes: [{ id: 'myEdge', label: 'My Edge', data: {}, color: '#00ff00', lineStyle: 'solid' }],
        }
      };
      editor.importGraph(graphData);
      const nodeTypes = editor.getNodeTypes();
      const edgeTypes = editor.getEdgeTypes();
      expect(nodeTypes).toHaveLength(1);
      expect(nodeTypes[0].id).toBe('myNode');
      expect(edgeTypes).toHaveLength(1);
      expect(edgeTypes[0].id).toBe('myEdge');
    });

    it('should accept template option in constructor', () => {
      const template = {
        title: 'Test Template',
        description: 'For testing',
        palette: {
          nodeTypes: [{ id: 'tNode', label: 'T Node', data: {}, color: '#aabbcc', shape: 'rectangle' }],
          edgeTypes: [{ id: 'tEdge', label: 'T Edge', data: {}, color: '#ccbbaa', lineStyle: 'dashed' }],
        },
        context: { ex: 'http://example.org/' },
        userStylesheet: [],
        elements: { nodes: [], edges: [] },
      };
      const tmplEditor = new BoxesEditor(container, { template });
      expect(tmplEditor.title).toBe('Test Template');
      expect(tmplEditor.getNodeTypes()[0].id).toBe('tNode');
      expect(tmplEditor.getEdgeTypes()[0].id).toBe('tEdge');
      tmplEditor.destroy();
    });

    it('should import graph data', () => {
      const graphData = {
        elements: {
          nodes: [
            { data: { id: 'n1', label: 'Imported Node' } }
          ],
          edges: []
        }
      };

      editor.importGraph(graphData);
      const elements = editor.getElements();
      expect(elements.nodes).toHaveLength(1);
      expect(elements.nodes[0].data.label).toBe('Imported Node');
    });

    it('should preserve edges on export and re-import (regression: edges missing on reload)', () => {
      editor.addNode({ id: 'n1', label: 'Node 1' });
      editor.addNode({ id: 'n2', label: 'Node 2' });
      editor.addEdge('n1', 'n2', { label: 'connects' });

      const exported = editor.exportGraph();
      expect(exported.elements.edges).toHaveLength(1);

      editor.importGraph(exported);

      const elements = editor.getElements();
      expect(elements.nodes).toHaveLength(2);
      expect(elements.edges).toHaveLength(1);
      expect(elements.edges[0].data.source).toBe('n1');
      expect(elements.edges[0].data.target).toBe('n2');
      expect(elements.edges[0].data.label).toBe('connects');
    });

    it('should preserve edges when importing into a fresh editor (simulates file reload)', () => {
      // Simulate saving a graph with edges
      editor.addNode({ id: 'n1', label: 'Node 1' });
      editor.addNode({ id: 'n2', label: 'Node 2' });
      editor.addEdge('n1', 'n2', { label: 'connects' });
      const exported = editor.exportGraph();

      // Simulate opening the saved file in a fresh editor (like startWithTemplate + importGraph)
      editor.destroy();
      container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);
      editor = new BoxesEditor(container);

      editor.importGraph(exported);

      const elements = editor.getElements();
      expect(elements.nodes).toHaveLength(2);
      expect(elements.edges).toHaveLength(1);
      expect(elements.edges[0].data.source).toBe('n1');
      expect(elements.edges[0].data.target).toBe('n2');
      expect(elements.edges[0].data.label).toBe('connects');
    });

    it('edges are rendered on the first frame after importGraph (regression: edges invisible on file load)', () => {
      // Reproduces the bug: loading a .boxes file left edges invisible until the
      // user selected an edge or added a node.
      //
      // Cytoscape's render loop:
      //
      //   requestAnimationFrame callback
      //     → beforeRenderCallbacks (runs updateEleCalcs → computes edge geometry)
      //     → r.render() → r.drawEdge()  (uses rs.allpts to draw the edge path)
      //
      // r.drawEdge() checks rs.allpts directly — if null it returns immediately,
      // producing zero drawing operations and leaving the edge invisible.  The
      // computed geometry lives in rscratch (rs.allpts), not rstyle.
      //
      // How the test works
      // ------------------
      // We block the automatic rAF so updateEleCalcs never runs as a side-effect
      // and rs.allpts is never populated by the render loop.
      //
      // We then call r.drawEdge(spyCtx, edge) directly on a canvas context spy.
      // If the edge has no geometry (rs.allpts == null) the renderer returns early
      // — the spy records zero path drawing calls, which means the edge would be
      // invisible on screen.  The test asserts that at least one lineTo or
      // quadraticCurveTo call is made, so it FAILS when the bug is present.
      //
      // With the fix, importGraph calls cy.elements().boundingBox({useCache:false})
      // which synchronously computes rs.allpts before any rAF fires, so drawEdge
      // produces drawing operations and the test passes.

      editor.addNode({ id: 'n1', label: 'Node 1' }, { x: 100, y: 100 });
      editor.addNode({ id: 'n2', label: 'Node 2' }, { x: 300, y: 200 });
      editor.addEdge('n1', 'n2', { label: 'connects' });
      const exported = editor.exportGraph();
      editor.destroy();
      editor = null;

      // Block all rAF callbacks so updateEleCalcs never runs as a side-effect.
      const pendingRafs = [];
      const origRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb) => { pendingRafs.push(cb); return pendingRafs.length; };

      try {
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);

        editor = new BoxesEditor(container, { elements: { nodes: [], edges: [] } });
        editor.importGraph(exported);

        const edge = editor.cy.edges().first();

        // Spy context: tracks edge path drawing calls.  Cytoscape's drawEdge
        // uses lineTo for straight edges and quadraticCurveTo for bezier edges.
        // Zero path calls means the edge produces no pixels — it is invisible.
        let edgePathCalls = 0;
        const spyCtx = {
          canvas: { width: 800, height: 600 },
          strokeStyle: '#000', fillStyle: '#000', globalAlpha: 1,
          lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
          shadowBlur: 0, shadowColor: 'transparent', shadowOffsetX: 0, shadowOffsetY: 0,
          font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
          globalCompositeOperation: 'source-over',
          save: () => {}, restore: () => {},
          scale: () => {}, rotate: () => {}, translate: () => {},
          transform: () => {}, setTransform: () => {}, resetTransform: () => {},
          clearRect: () => {}, fillRect: () => {}, strokeRect: () => {},
          fillText: () => {}, strokeText: () => {},
          measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
          beginPath: () => {}, closePath: () => {},
          moveTo: () => {}, lineTo: () => { edgePathCalls++; },
          bezierCurveTo: () => { edgePathCalls++; },
          quadraticCurveTo: () => { edgePathCalls++; },
          arc: () => {}, arcTo: () => {}, ellipse: () => {}, rect: () => {},
          fill: () => {}, stroke: () => {}, clip: () => {},
          isPointInPath: () => false, isPointInStroke: () => false,
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
          createPattern: () => null,
          getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
          putImageData: () => {},
          createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
          drawImage: () => {},
          setLineDash: () => {}, getLineDash: () => [],
        };

        // Ask the renderer to draw the edge onto the spy context.
        // drawEdge() checks rs.allpts internally: if null it returns immediately
        // (the edge is invisible); if populated it traces the edge path.
        const r = editor.cy.renderer();
        r.drawEdge(spyCtx, edge);

        // If the edge is renderable, drawEdge must have made at least one path
        // drawing call (lineTo for straight edges, quadraticCurveTo for bezier).
        // Zero calls means the edge is invisible.
        expect(edgePathCalls).toBeGreaterThan(0);
      } finally {
        window.requestAnimationFrame = origRaf;
      }
    });

    it('should preserve styles on import/export', () => {
      editor.addNode(
        { id: 'n1', label: 'Styled' },
        null,
        { 'background-color': 'red' }
      );

      const exported = editor.exportGraph();
      editor.destroy();

      container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);

      editor = new BoxesEditor(container);
      editor.importGraph(exported);

      const elements = editor.getElements();
      expect(elements.nodes[0].data._style).toEqual({ 'background-color': 'red' });
    });
  });

  describe('event system', () => {
    beforeEach(() => {
      editor = new BoxesEditor(container);
    });

    it('should emit nodeAdded event', () => {
      let eventData = null;
      editor.on('nodeAdded', (data) => {
        eventData = data;
      });

      editor.addNode({ id: 'n1', label: 'Test' });
      expect(eventData).toBeDefined();
      expect(eventData.node.data.id).toBe('n1');
    });

    it('should emit edgeAdded event', () => {
      editor.addNode({ id: 'n1' });
      editor.addNode({ id: 'n2' });

      let eventData = null;
      editor.on('edgeAdded', (data) => {
        eventData = data;
      });

      editor.addEdge('n1', 'n2');
      expect(eventData).toBeDefined();
      expect(eventData.edge.data.source).toBe('n1');
    });

    it('should remove event handlers', () => {
      let count = 0;
      const handler = () => { count++; };

      editor.on('nodeAdded', handler);
      editor.addNode({ id: 'n1' });
      expect(count).toBe(1);

      editor.off('nodeAdded', handler);
      editor.addNode({ id: 'n2' });
      expect(count).toBe(1);
    });
  });

  describe('selection', () => {
    beforeEach(() => {
      editor = new BoxesEditor(container);
      editor.addNode({ id: 'n1', label: 'Node 1' });
      editor.addNode({ id: 'n2', label: 'Node 2' });
    });

    it('should select elements', () => {
      editor.selectElements(['n1']);
      const selected = editor.getSelected();
      expect(selected).toHaveLength(1);
      expect(selected[0].data.id).toBe('n1');
    });

    it('should get multiple selected elements', () => {
      editor.selectElements(['n1', 'n2']);
      const selected = editor.getSelected();
      expect(selected).toHaveLength(2);
    });
  });

  describe('cleanup', () => {
    it('should destroy the editor properly', () => {
      editor = new BoxesEditor(container);
      editor.addNode({ id: 'n1' });
      
      editor.destroy();
      expect(editor.cy).toBe(null);
    });
  });
});
