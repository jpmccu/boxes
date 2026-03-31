import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BoxesEditor } from '../src/boxes-editor.js';
import cytoscape from 'cytoscape';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('edge takesUpSpace investigation', () => {
  it('finds why takesUpSpace=false despite width=2', async () => {
    const demoPath = resolve(__dirname, '../../docs/public/demos/owl-4-hierarchy.boxes');
    const graphData = JSON.parse(readFileSync(demoPath, 'utf8'));

    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    const editor = new BoxesEditor(c, { layout: { name: 'preset' } });
    await new Promise(r => setTimeout(r, 120));

    // Patch takesUpSpace to trace
    const origTUS = cytoscape.prototype?.takesUpSpace;
    
    // Patch the element's takesUpSpace method 
    const renderer = editor.cy.renderer();
    const origFECP = renderer.findEdgeControlPoints.bind(renderer);
    renderer.findEdgeControlPoints = function(edges) {
      if (edges && edges.length > 0) {
        const e = edges[0];
        const sc = e[0]._private.styleCache;
        console.log('\nEdge styleCache before takesUpSpace call:', sc ? 'HAS VALUES' : 'null/empty');
        if (sc) {
          console.log('  styleCache keys/values:', Object.entries(sc).filter(([k,v]) => v !== undefined));
        }
        // What is ele.width for this edge?
        console.log('  ele.width():', e.width());
        console.log('  pstyle(width).strValue:', e.pstyle('width').strValue);
        console.log('  pstyle(width).pfValue:', e.pstyle('width').pfValue);
        console.log('  pstyle(display).value:', e.pstyle('display').value);
        
        // Now check source and target
        const src = e.source();
        const tgt = e.target();
        console.log('  source width:', src.width(), 'pstyle:', src.pstyle('width').strValue);
        console.log('  target width:', tgt.width(), 'pstyle:', tgt.pstyle('width').strValue);
      }
      origFECP(edges);
    };

    editor.importGraph(graphData);
    
    // Check after
    const edges = editor.cy.edges();
    console.log('\nFinal state:');
    edges.forEach(e => {
      const rs = e[0]._private.rscratch;
      console.log(`${e.id()}: allpts=${Array.isArray(rs.allpts) ? 'array('+rs.allpts.length+')' : rs.allpts}, takesUpSpace=${e.takesUpSpace()}`);
    });

    editor.destroy();
    document.body.removeChild(c);
  });
});
