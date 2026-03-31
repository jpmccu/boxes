import { describe, it, expect } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';

describe('recursion guard test', () => {
  it('recalculateRenderedStyle does not infinite-loop for width:label nodes', async () => {
    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    const editor = new BoxesEditor(c, { layout: { name: 'preset' } });
    
    // Apply a stylesheet with width:label 
    const graphData = {
      version: '1.0.0',
      elements: {
        nodes: [{ data: { id: 'n1', label: 'Test Node' }, position: { x: 100, y: 100 } }],
        edges: []
      },
      userStylesheet: [{ selector: 'node', style: { 'width': 'label', 'height': 'label' } }],
      palette: { nodeTypes: [], edgeTypes: [] },
    };

    let err = null;
    try {
      editor.importGraph(graphData);
      
      const node = editor.cy.nodes().first();
      console.log('After importGraph:');
      console.log('  rstyle.labelWidth:', node[0]._private.rstyle.labelWidth);
      console.log('  rstyle.clean:', node[0]._private.rstyle.clean);
      
      // Manually call recalculateRenderedStyle to check for infinite loop
      const renderer = editor.cy.renderer();
      renderer.recalculateRenderedStyle(editor.cy.nodes());
      console.log('  After explicit recalc: labelWidth:', node[0]._private.rstyle.labelWidth);
      
      const width = node.width();
      console.log('  node.width():', width);
      
    } catch(e) {
      err = e;
      console.log('Error:', e.message);
    }
    
    expect(err).toBeNull();
    
    editor.destroy();
    document.body.removeChild(c);
  });
});
