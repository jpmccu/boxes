import { describe, it, expect } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';

describe('debug edge geometry', () => {
  it('checks rs.allpts and drawEdge state after importGraph', () => {
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    let editor = new BoxesEditor(container);
    editor.addNode({ id: 'n1', label: 'Node 1' }, { x: 100, y: 100 });
    editor.addNode({ id: 'n2', label: 'Node 2' }, { x: 300, y: 200 });
    editor.addEdge('n1', 'n2', { label: 'connects' });
    const exported = editor.exportGraph();
    editor.destroy();

    // Block rAF
    const pendingRafs = [];
    const origRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { pendingRafs.push(cb); return pendingRafs.length; };

    try {
      const container2 = document.createElement('div');
      container2.style.width = '800px';
      container2.style.height = '600px';
      document.body.appendChild(container2);

      editor = new BoxesEditor(container2, { elements: { nodes: [], edges: [] } });
      editor.importGraph(exported);

      const edge = editor.cy.edges().first();
      const rs = edge._private.rscratch;
      console.log('rs.allpts:', rs.allpts);
      console.log('rs.edgeType:', rs.edgeType);
      console.log('rs.badLine:', rs.badLine);
      console.log('edge.visible():', edge.visible());

      // Check usePaths
      const r = editor.cy.renderer();
      console.log('usePaths():', r.usePaths && r.usePaths());
      console.log('Path2D available:', typeof Path2D);

      // Spy context: tracks ALL drawing calls
      const calls = { moveTo: 0, lineTo: 0, quadraticCurveTo: 0, bezierCurveTo: 0, arc: 0 };
      const spyCtx = {
        canvas: { width: 800, height: 600 },
        strokeStyle: '#000', fillStyle: '#000', globalAlpha: 1,
        lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
        shadowBlur: 0, shadowColor: 'transparent', shadowOffsetX: 0, shadowOffsetY: 0,
        font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
        globalCompositeOperation: 'source-over',
        save: () => {}, restore: () => {},
        scale: () => {}, rotate: () => {}, translate: () => {},
        transform: () => {}, setTransform: () => {}, resetTransform: () => {},
        clearRect: () => {}, fillRect: () => {}, strokeRect: () => {},
        fillText: () => {}, strokeText: () => {},
        measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
        beginPath: () => {}, closePath: () => {},
        moveTo: () => { calls.moveTo++; }, lineTo: () => { calls.lineTo++; },
        bezierCurveTo: () => { calls.bezierCurveTo++; },
        quadraticCurveTo: () => { calls.quadraticCurveTo++; },
        arc: () => { calls.arc++; }, arcTo: () => {}, ellipse: () => {}, rect: () => {},
        fill: () => {}, stroke: () => {}, clip: () => {},
        isPointInPath: () => false, isPointInStroke: () => false,
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createPattern: () => null,
        getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
        putImageData: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
        drawImage: () => {},
        setLineDash: () => {}, getLineDash: () => [],
      };

      r.drawEdge(spyCtx, edge);
      console.log('Drawing calls:', calls);
      
      editor.destroy();
    } finally {
      window.requestAnimationFrame = origRaf;
    }
  });
});
