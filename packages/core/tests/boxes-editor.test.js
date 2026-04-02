import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';

// Provide a minimal navigator.clipboard stub so tests can verify system-clipboard
// integration without a real browser.
const clipboardStub = {
  _value: '',
  writeText: vi.fn(async (text) => { clipboardStub._value = text; }),
  readText: vi.fn(async () => clipboardStub._value),
};
Object.defineProperty(navigator, 'clipboard', { value: clipboardStub, configurable: true });

describe('BoxesEditor', () => {
  let container;
  let editor;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    // Reset the clipboard stub before every test to prevent cross-test pollution.
    clipboardStub._value = '';
    clipboardStub.writeText.mockClear();
    clipboardStub.readText.mockClear();
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

  describe('find / search', () => {
    beforeEach(() => {
      editor = new BoxesEditor(container);
      editor.addNode({ id: 'n1', label: 'Apple' });
      editor.addNode({ id: 'n2', label: 'Banana', color: 'yellow' });
      editor.addNode({ id: 'n3', label: 'Apricot' });
    });

    it('should find nodes by label', () => {
      editor._executeFind('apple');
      expect(editor._findMatches).toHaveLength(1);
      expect(editor._findMatches[0]).toBe('n1');
    });

    it('should find multiple matches', () => {
      editor._executeFind('ap');
      expect(editor._findMatches).toHaveLength(2);
      expect(editor._findMatches).toContain('n1');
      expect(editor._findMatches).toContain('n3');
    });

    it('should find nodes by property value', () => {
      editor._executeFind('yellow');
      expect(editor._findMatches).toHaveLength(1);
      expect(editor._findMatches[0]).toBe('n2');
    });

    it('should find nodes by property key', () => {
      editor._executeFind('color');
      expect(editor._findMatches).toHaveLength(1);
      expect(editor._findMatches[0]).toBe('n2');
    });

    it('should be case-insensitive', () => {
      editor._executeFind('APPLE');
      expect(editor._findMatches).toHaveLength(1);
      expect(editor._findMatches[0]).toBe('n1');
    });

    it('should return no matches for unrecognised query', () => {
      editor._executeFind('zzznomatch');
      expect(editor._findMatches).toHaveLength(0);
    });

    it('should clear matches when query is empty', () => {
      editor._executeFind('apple');
      editor._executeFind('');
      expect(editor._findMatches).toHaveLength(0);
    });

    it('should set current index to 0 after initial find', () => {
      editor._executeFind('ap');
      expect(editor._findCurrentIdx).toBe(0);
    });

    it('should advance to next match with _findNext', () => {
      editor._executeFind('ap');
      editor._findNext();
      expect(editor._findCurrentIdx).toBe(1);
    });

    it('should wrap around to first match after last', () => {
      editor._executeFind('ap');
      editor._findNext();
      editor._findNext();
      expect(editor._findCurrentIdx).toBe(0);
    });

    it('should go to previous match with _findPrev', () => {
      editor._executeFind('ap');
      editor._findPrev();
      expect(editor._findCurrentIdx).toBe(1);
    });

    it('should apply bxe-match-current class to current match', () => {
      editor._executeFind('apple');
      const node = editor.cy.getElementById('n1');
      expect(node.hasClass('bxe-match-current')).toBe(true);
    });

    it('should apply bxe-match class to non-current matches', () => {
      editor._executeFind('ap');
      const n3 = editor.cy.getElementById('n3');
      expect(n3.hasClass('bxe-match')).toBe(true);
    });

    it('should clear highlights when find is closed', () => {
      editor._executeFind('apple');
      editor._closeFind();
      const node = editor.cy.getElementById('n1');
      expect(node.hasClass('bxe-match')).toBe(false);
      expect(node.hasClass('bxe-match-current')).toBe(false);
    });

    it('should open and close the find bar', () => {
      expect(editor._findBar.classList.contains('bxe-hidden')).toBe(true);
      editor._openFind();
      expect(editor._findBar.classList.contains('bxe-hidden')).toBe(false);
      editor._closeFind();
      expect(editor._findBar.classList.contains('bxe-hidden')).toBe(true);
    });

    it('should toggle the find bar', () => {
      editor._toggleFind();
      expect(editor._findBar.classList.contains('bxe-hidden')).toBe(false);
      editor._toggleFind();
      expect(editor._findBar.classList.contains('bxe-hidden')).toBe(true);
    });

    it('should not include internal _style fields in search', () => {
      editor.addNode({ id: 'n4', label: 'Test', _style: { 'background-color': 'searchme' } });
      editor._executeFind('searchme');
      expect(editor._findMatches).toHaveLength(0);
    });
  });

  describe('toolbar buttons', () => {
    beforeEach(() => {
      editor = new BoxesEditor(container);
    });

    it('should have a cut button', () => {
      expect(editor._cutBtn).toBeDefined();
      expect(editor._cutBtn.tagName).toBe('BUTTON');
    });

    it('should have a copy button', () => {
      expect(editor._copyBtn).toBeDefined();
      expect(editor._copyBtn.tagName).toBe('BUTTON');
    });

    it('should have a paste button', () => {
      expect(editor._pasteBtn).toBeDefined();
      expect(editor._pasteBtn.tagName).toBe('BUTTON');
    });

    it('cut and copy buttons start disabled', () => {
      expect(editor._cutBtn.disabled).toBe(true);
      expect(editor._copyBtn.disabled).toBe(true);
    });

    it('paste button starts disabled', () => {
      expect(editor._pasteBtn.disabled).toBe(true);
    });

    it('cut and copy buttons enable when a node is selected', () => {
      editor.addNode({ id: 'n1', label: 'A' });
      editor.selectElements(['n1']);
      expect(editor._cutBtn.disabled).toBe(false);
      expect(editor._copyBtn.disabled).toBe(false);
    });

    it('cut and copy buttons disable again when selection is cleared', () => {
      editor.addNode({ id: 'n1', label: 'A' });
      editor.selectElements(['n1']);
      editor.cy.$(':selected').unselect();
      // give cytoscape a tick to fire the unselect event
      expect(editor._cutBtn.disabled).toBe(true);
      expect(editor._copyBtn.disabled).toBe(true);
    });

    it('copy button invokes copy() and writes JSON to system clipboard', async () => {
      editor.addNode({ id: 'n1', label: 'A' });
      editor.selectElements(['n1']);
      editor._copyBtn.click();
      expect(editor._clipboard).not.toBeNull();
      expect(editor._clipboard.nodes.some(n => n.data.id === 'n1')).toBe(true);
      // wait for the async writeText call
      await Promise.resolve();
      expect(clipboardStub.writeText).toHaveBeenCalledWith(JSON.stringify(editor._clipboard));
    });

    it('paste button enables after copy', () => {
      editor.addNode({ id: 'n1', label: 'A' });
      editor.selectElements(['n1']);
      editor.copy();
      expect(editor._pasteBtn.disabled).toBe(false);
    });

    it('cut button invokes cut() and removes selected node', () => {
      editor.addNode({ id: 'n1', label: 'A' });
      editor.selectElements(['n1']);
      editor._cutBtn.click();
      expect(editor._clipboard).not.toBeNull();
      expect(editor.cy.getElementById('n1').length).toBe(0);
    });

    it('paste button invokes paste() and adds clipboard contents', async () => {
      editor.addNode({ id: 'n1', label: 'A' });
      editor.selectElements(['n1']);
      editor.copy();
      const before = editor.getElements().nodes.length;
      await editor.paste();
      expect(editor.getElements().nodes.length).toBeGreaterThan(before);
    });

    it('paste() reads from system clipboard and uses it when valid graph JSON', async () => {
      // Seed the system clipboard with a foreign graph (simulating a copy from another window)
      const foreignClip = { nodes: [{ data: { id: 'foreign-1', label: 'Foreign' } }], edges: [] };
      clipboardStub._value = JSON.stringify(foreignClip);

      // local clipboard is null — no copy() was called in this editor
      expect(editor._clipboard).toBeNull();
      await editor.paste();

      // The foreign node should now be in the graph
      const ids = editor.getElements().nodes.map(n => n.data.id);
      // The pasted node gets a new ID, but the graph should have one node
      expect(ids.length).toBeGreaterThan(0);
      // And the internal clipboard cache should be updated
      expect(editor._clipboard).toEqual(foreignClip);
      expect(editor._pasteBtn.disabled).toBe(false);
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
