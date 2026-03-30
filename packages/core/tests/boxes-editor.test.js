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

    it('importGraph synchronously applies styles and computes edge geometry (regression: edges invisible on file load)', () => {
      // Regression test: loading a .boxes file left edges invisible until the
      // user selected an edge or added a node.
      //
      // Root cause
      // ----------
      // After importGraph() the render loop fires its first rAF callback:
      //
      //   beforeRenderCallbacks  →  updateEleCalcs(true)
      //     1. elesToUpdate.cleanStyle()            ← applies current stylesheet
      //     2. recalculateRenderedStyle(elesToUpdate) ← computes edge geometry
      //   r.render() → drawLayeredElements() → drawCachedElement()
      //
      // drawCachedElement() uses ele.boundingBox() to decide whether to draw.
      // The bounding box for an edge is derived from rstyle.srcX/midX/tgtX
      // (the computed endpoint positions set by recalculateRenderedStyle).  If
      // those positions are undefined, bodyBounds.w is NaN, the texture-cache
      // path returns null, and the fallback drawEdge() is reached.  drawEdge()
      // then bails out immediately because rs.allpts is null, producing zero
      // canvas operations — the edge is invisible.
      //
      // The fix: importGraph calls cy.renderer().flushRenderedStyleQueue() which
      // runs updateEleCalcs(true) synchronously — applying the stylesheet AND
      // computing geometry — before any rAF fires.  Both rs.allpts (checked by
      // drawEdge) and rstyle.srcX/tgtX (used for the bounding box) are populated
      // immediately, so the edge is visible on the very first rendered frame.
      //
      // How the test works
      // ------------------
      // We block rAF so updateEleCalcs never runs as a side-effect.  Then we
      // inspect the internal renderer state directly:
      //
      //   rs.allpts      — the computed path-point array used by drawEdge()
      //   rstyle.srcX/Y  — the source-endpoint coords used by boundingBox()
      //   rstyle.tgtX/Y  — the target-endpoint coords used by boundingBox()
      //
      // Without the fix all of these are null/undefined because
      // recalculateRenderedStyle has never been called.  With the fix they are
      // finite numbers, so drawCachedElement's bounding-box check succeeds and
      // drawEdge's rs.allpts check succeeds — the edge is drawn.

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
        const rs = edge[0]._private.rscratch;      // geometry scratch space
        const rstyle = edge[0]._private.rstyle;    // rendered-style positions

        // --- geometry (rs.allpts) ---
        // drawEdge() bails immediately when rs.allpts is null, leaving the edge
        // invisible.  recalculateRenderedStyle() sets rs.allpts via projectLines().
        expect(rs.allpts).not.toBeNull();

        // --- bounding-box positions (rstyle.srcX/Y, rstyle.tgtX/Y) ---
        // drawCachedElement() derives the edge bounding box from these values
        // (set by recalculateRenderedStyle → updates rstyle from rscratch).
        // If they are undefined, bodyBounds.w is NaN → getElement() returns null
        // → drawEdge falls back → rs.allpts check fails → edge invisible.
        // Finite numbers here confirm styles were applied and geometry was computed.
        expect(isFinite(rstyle.srcX)).toBe(true);
        expect(isFinite(rstyle.srcY)).toBe(true);
        expect(isFinite(rstyle.tgtX)).toBe(true);
        expect(isFinite(rstyle.tgtY)).toBe(true);

        // --- style application ---
        // visible() evaluates pstyle() values (opacity, visibility, display,
        // width).  A false result here means the stylesheet was not applied.
        expect(edge.visible()).toBe(true);
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
