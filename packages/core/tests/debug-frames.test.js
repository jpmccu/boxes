import { describe, it } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';
import blankTemplate from '../src/templates/blank.json';

describe('frame-by-frame rendering after importGraph', () => {
  it('shows what each individual render frame draws', async () => {
    // Track ALL path-drawing operations on ALL canvas contexts.
    const frameOps = [];
    let currentFrame = -1;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type) {
      const ctx = origGetContext.call(this, type);
      if (type === '2d' && ctx && !ctx.__frameObs) {
        ctx.__frameObs = true;
        ['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','stroke'].forEach(m => {
          const orig = ctx[m];
          ctx[m] = function(...a) {
            frameOps.push({ frame: currentFrame, m, a });
            return orig?.apply(this, a);
          };
        });
      }
      return ctx;
    };

    // Control rAF manually - fire one at a time
    const rafQueue = [];
    const origRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };

    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    // Exact web app pattern
    const editor = new BoxesEditor(c, { template: blankTemplate, layout: { name: 'preset' } });
    console.log('rAFs queued after editor creation:', rafQueue.length);

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
    console.log('rAFs queued after importGraph:', rafQueue.length);

    // Fire each rAF one at a time and record what each frame draws
    for (let i = 0; i < 5; i++) {
      if (rafQueue.length === 0) {
        console.log(`Frame ${i}: nothing queued`);
        break;
      }
      const callbacks = [...rafQueue];
      rafQueue.length = 0;
      currentFrame = i;
      callbacks.forEach(cb => cb(performance.now()));
      const frameDrawings = frameOps.filter(o => o.frame === i);
      const moves = frameDrawings.filter(o => o.m === 'moveTo' && isFinite(o.a[0]));
      const strokes = frameDrawings.filter(o => o.m === 'stroke');
      console.log(`Frame ${i}: ${frameDrawings.length} ops, moveTo=${moves.length} (${moves.slice(0,3).map(o=>`(${o.a[0].toFixed(1)},${o.a[1].toFixed(1)})`)}), stroke=${strokes.length}, new rAFs=${rafQueue.length}`);
    }

    window.requestAnimationFrame = origRaf;
    HTMLCanvasElement.prototype.getContext = origGetContext;
    editor.destroy();
    document.body.removeChild(c);
  });
});
