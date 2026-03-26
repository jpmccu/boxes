import { describe, it } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';
import blankTemplate from '../src/templates/blank.json';

describe('edge visibility after importGraph', () => {
  it('checks every observable Cytoscape property for edges', async () => {
    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    // Exact web app pattern
    const editor = new BoxesEditor(c, { template: blankTemplate, layout: { name: 'preset' } });
    const graphData = {
      version: '1.0.0',
      elements: {
        nodes: [
          { data: { id: 'n1', label: 'A' }, position: { x: 100, y: 100 } },
          { data: { id: 'n2', label: 'B' }, position: { x: 300, y: 200 } },
        ],
        edges: [{ data: { id: 'e1', source: 'n1', target: 'n2', label: 'rel' } }]
      },
      palette: { nodeTypes: [], edgeTypes: [] }, userStylesheet: [],
    };
    editor.importGraph(graphData);

    // Wait for first render
    await new Promise(r => setTimeout(r, 80));

    const edge = editor.cy.$('#e1');
    const r = editor.cy.renderer();

    console.log('--- EDGE STATE AFTER IMPORTGRAPH + RENDER ---');
    console.log('edge.length:', edge.length);
    console.log('edge.visible():', edge.visible());
    console.log('edge.css("opacity"):', edge.css('opacity'));
    console.log('edge.css("display"):', edge.css('display'));
    console.log('edge.css("visibility"):', edge.css('visibility'));
    console.log('edge.css("line-color"):', edge.css('line-color'));
    console.log('edge.renderedBoundingBox():', JSON.stringify(edge.renderedBoundingBox()));
    console.log('edge.boundingBox():', JSON.stringify(edge.boundingBox()));
    console.log('edge rstyle.clean:', edge[0]._private.rstyle.clean);
    console.log('edge rstyle.srcX:', edge[0]._private.rstyle.srcX);
    
    // Check visible elements selector
    const visibleEdges = editor.cy.edges(':visible');
    console.log('edges(:visible) count:', visibleEdges.length);
    
    // Check z-ordering
    const zInfo = editor.cy.edges().map(e => ({
      id: e.id(), z: e.css('z-index'), opacity: e.css('opacity')
    }));
    console.log('edge z/opacity:', JSON.stringify(zInfo));

    // NOW simulate what selection does: select the edge
    edge.select();
    await new Promise(r => setTimeout(r, 80));

    console.log('--- AFTER SELECTION ---');
    console.log('edge rstyle.clean:', edge[0]._private.rstyle.clean);
    console.log('edge rstyle.srcX:', edge[0]._private.rstyle.srcX);
    console.log('edge.renderedBoundingBox():', JSON.stringify(edge.renderedBoundingBox()));

    editor.destroy();
    document.body.removeChild(c);
  });
});
