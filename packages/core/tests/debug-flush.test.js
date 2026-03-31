import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BoxesEditor } from '../src/boxes-editor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('verify flushRenderedStyleQueue is called', () => {
  it('checks flush was called and edges computed', async () => {
    const demoPath = resolve(__dirname, '../../docs/public/demos/owl-4-hierarchy.boxes');
    const graphData = JSON.parse(readFileSync(demoPath, 'utf8'));

    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    const editor = new BoxesEditor(c, { layout: { name: 'preset' } });
    await new Promise(r => setTimeout(r, 120));

    // Spy on flushRenderedStyleQueue
    const origFlush = editor.cy.renderer().flushRenderedStyleQueue;
    let flushCalled = 0;
    editor.cy.renderer().flushRenderedStyleQueue = function() {
      flushCalled++;
      console.log('flushRenderedStyleQueue called!');
      // Check edge state BEFORE flush
      const edges = editor.cy.edges();
      console.log('Edges before flush:', edges.length);
      edges.forEach(e => {
        const rs = e[0]._private.rscratch;
        console.log(`  ${e.id()}: allpts=${rs.allpts !== null ? 'set' : 'null'}, takesUpSpace=${e.takesUpSpace()}, display=${e.pstyle('display').value}, width=${e.pstyle('width').pfValue}`);
      });
      
      origFlush.call(this);
      
      // Check after flush
      console.log('After flush:');
      edges.forEach(e => {
        const rs = e[0]._private.rscratch;
        console.log(`  ${e.id()}: allpts=${rs.allpts !== null ? 'set('+rs.allpts.length+')' : 'null'}, rstyle.srcX=${e[0]._private.rstyle.srcX?.toFixed?.(1)}`);
      });
    };

    editor.importGraph(graphData);
    
    console.log('flushCalled:', flushCalled);
    console.log('Edges after importGraph:', editor.cy.edges().length);
    editor.cy.edges().forEach(e => {
      console.log(`${e.id()}: allpts=${e[0]._private.rscratch.allpts !== null ? 'SET' : 'NULL'}`);
    });
    
    expect(flushCalled).toBe(1);

    editor.destroy();
    document.body.removeChild(c);
  });
});
