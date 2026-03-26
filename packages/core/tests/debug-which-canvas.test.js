import { describe, it } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';
import blankTemplate from '../src/templates/blank.json';

let canvasCounter = 0;
describe('which canvas gets the edge drawing?', () => {
  it('tracks canvas identity and layer texture cache state', async () => {
    const opsLog = [];
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type) {
      const ctx = origGetContext.call(this, type);
      if (type === '2d' && ctx && !ctx.__id) {
        const id = ++canvasCounter;
        ctx.__id = id;
        this.__id = id;
        const origMoveTo = ctx.moveTo;
        const origStroke = ctx.stroke;
        const origDrawImage = ctx.drawImage;
        ctx.moveTo = function(...a) { opsLog.push({ canvas: id, op: 'moveTo', x: a[0], y: a[1] }); return origMoveTo?.apply(this, a); };
        ctx.stroke = function(...a) { opsLog.push({ canvas: id, op: 'stroke' }); return origStroke?.apply(this, a); };
        ctx.drawImage = function(...a) { opsLog.push({ canvas: id, op: 'drawImage', srcCanvas: a[0].__id ?? '?', dx: a[1] }); return origDrawImage?.apply(this, a); };
      }
      return ctx;
    };

    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

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

    opsLog.length = 0;
    editor.importGraph(graphData);
    await new Promise(r => setTimeout(r, 80));

    // What canvases exist in the DOM/Cytoscape?
    const allCanvases = document.querySelectorAll('canvas');
    console.log('Total canvases in DOM:', allCanvases.length);
    allCanvases.forEach((cv, i) => console.log(`  canvas ${cv.__id ?? '?'}: ${cv.width}x${cv.height} ${cv.style.cssText}`));

    // Log operations
    console.log('\nCanvas operations after importGraph+render:');
    opsLog.forEach(op => {
      if (op.op === 'moveTo') console.log(`  canvas ${op.canvas}: moveTo(${op.x?.toFixed?.(1)}, ${op.y?.toFixed?.(1)})`);
      if (op.op === 'stroke') console.log(`  canvas ${op.canvas}: stroke()`);
      if (op.op === 'drawImage') console.log(`  canvas ${op.canvas}: drawImage(srcCanvas=${op.srcCanvas}, dx=${op.dx})`);
    });

    // Access LTC state directly
    const r = editor.cy.renderer();
    console.log('\nRenderer type:', r.constructor?.name);
    const lyrTxr = r.lyrTxrCache;
    console.log('lyrTxrCache:', lyrTxr ? 'exists' : 'null/undefined');
    if (lyrTxr) {
      console.log('lyrTxrCache keys:', Object.keys(lyrTxr).join(', '));
    }

    HTMLCanvasElement.prototype.getContext = origGetContext;
    editor.destroy();
    document.body.removeChild(c);
  });
});
