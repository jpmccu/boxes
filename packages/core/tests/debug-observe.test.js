import { describe, it } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';
import blankTemplate from '../src/templates/blank.json';

describe('observe rendering after importGraph (web app sequence)', () => {
  it('tracks canvas path operations through exact web app loading sequence', async () => {
    // Track ALL path-drawing operations on ALL canvas contexts.
    const pathOps = [];
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type) {
      const ctx = origGetContext.call(this, type);
      if (type === '2d' && ctx && !ctx.__obs) {
        ctx.__obs = true;
        ['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','stroke','beginPath'].forEach(m => {
          const orig = ctx[m];
          ctx[m] = function(...a) { pathOps.push({ m, a }); return orig?.apply(this, a); };
        });
      }
      return ctx;
    };

    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    // Step 1: exact web app pattern — create blank editor (this renders an empty graph)
    const editor = new BoxesEditor(c, { template: blankTemplate, layout: { name: 'preset' } });
    await new Promise(r => setTimeout(r, 80)); // let initial blank render complete

    console.log('ops after initial blank render:', pathOps.length);
    pathOps.length = 0;

    // Step 2: load file (same as File > Open in the web app)
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

    // Step 3: wait for the render cycle that follows importGraph
    await new Promise(r => setTimeout(r, 80));

    HTMLCanvasElement.prototype.getContext = origGetContext;

    const moves = pathOps.filter(p => p.m === 'moveTo' && isFinite(p.a[0]) && isFinite(p.a[1]));
    const strokes = pathOps.filter(p => p.m === 'stroke');
    console.log('ops after importGraph render:', pathOps.length);
    console.log('moveTo (finite):', moves.length, moves.slice(0,5).map(p => `(${p.a[0].toFixed(1)},${p.a[1].toFixed(1)})`));
    console.log('stroke:', strokes.length);

    editor.destroy();
    document.body.removeChild(c);
  });
});
