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

    it('should export graph data', () => {
      editor.addNode({ id: 'n1', label: 'Node 1' });
      editor.addEdge('n1', 'n1', { label: 'self' });

      const exported = editor.exportGraph();
      expect(exported.elements.nodes).toHaveLength(1);
      expect(exported.elements.edges).toHaveLength(1);
      expect(exported.version).toBe('1.0.0');
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

    it('edges should have rs.allpts set after importGraph (rendering regression)', async () => {
      // Verify that after a file-load (importGraph on a fresh editor), Cytoscape's
      // render pipeline correctly computes rs.allpts for edges so they are visible.
      // rs.allpts == null means the edge draw call is silently skipped.
      editor.addNode({ id: 'n1', label: 'Node 1' });
      editor.addNode({ id: 'n2', label: 'Node 2' });
      editor.addEdge('n1', 'n2', { label: 'connects' });
      const exported = editor.exportGraph();

      editor.destroy();
      container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);
      editor = new BoxesEditor(container);
      editor.importGraph(exported);

      // Wait for at least one animation frame so the Cytoscape render loop
      // runs updateEleCalcs → recalculateRenderedStyle → findEdgeControlPoints
      await new Promise(resolve => setTimeout(resolve, 50));

      const edge = editor.cy.edges().first();
      const rs = edge._private.rscratch;
      expect(rs.allpts).not.toBeNull();
      expect(rs.allpts).toBeDefined();
      expect(rs.allpts.length).toBeGreaterThan(0);
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
