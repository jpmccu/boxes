/**
 * Debug test: reproduce "some nodes don't render at first" in the tutorial.
 *
 * The tutorial flow is:
 *   1. new BoxesEditor(el)           – editor created, first renders fire (blank graph)
 *   2. await fetch(...)              – during async wait, multiple rAFs fire → firstGet=false
 *   3. editor.importGraph(data)      – elements added, flushRenderedStyleQueue called
 *   4. rAF → rAF → cy.fit()         – viewport adjusted
 *
 * The question is: after step 3's first render fires, are all nodes visible?
 */

import { describe, it, expect } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';

describe('node visibility after importGraph (tutorial flow)', () => {
  it('all nodes should be visible on first render after importGraph when editor had prior renders', async () => {
    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    // Step 1: create editor (simulates new BoxesEditor in initDemo)
    const editor = new BoxesEditor(c, { layout: { name: 'preset' } });

    // Step 2: simulate the async delay during fetch – let the blank editor render several frames
    await new Promise(r => setTimeout(r, 120));

    // After this wait, multiple rAFs have fired.  lyrTxrCache.firstGet is now false.

    // Step 3: importGraph (simulates editor.importGraph(data) after fetch resolves)
    const graphData = {
      version: '1.0.0',
      elements: {
        nodes: [
          { data: { id: 'n1', label: 'Animal' },   position: { x: 100, y: 100 } },
          { data: { id: 'n2', label: 'Dog' },       position: { x: 300, y: 200 } },
          { data: { id: 'n3', label: 'Cat' },       position: { x: 300, y: 0   } },
        ],
        edges: [
          { data: { id: 'e1', source: 'n1', target: 'n2', label: 'parent' } },
          { data: { id: 'e2', source: 'n1', target: 'n3', label: 'parent' } },
        ]
      },
      userStylesheet: [],
      palette: { nodeTypes: [], edgeTypes: [] },
    };
    editor.importGraph(graphData);

    // Step 4: let the first render after importGraph fire
    await new Promise(r => setTimeout(r, 80));

    // Inspect each node
    const nodes = editor.cy.nodes();
    console.log('Number of nodes:', nodes.length);
    nodes.forEach(node => {
      const rstyle = node[0]._private.rstyle;
      const bb = node.boundingBox();
      console.log(`Node ${node.id()}:`, {
        visible: node.visible(),
        bbW: bb.w, bbH: bb.h,
        rstyleClean: rstyle.clean,
        styleDirty: node[0]._private.styleDirty,
        nodeX: rstyle.nodeX, nodeY: rstyle.nodeY,
        nodeW: rstyle.nodeW, nodeH: rstyle.nodeH,
      });
    });

    // Assertions
    nodes.forEach(node => {
      expect(node.visible(), `Node ${node.id()} should be visible`).toBe(true);
      const bb = node.boundingBox();
      expect(bb.w, `Node ${node.id()} bb.w should be > 0`).toBeGreaterThan(0);
      expect(bb.h, `Node ${node.id()} bb.h should be > 0`).toBeGreaterThan(0);
    });

    // Inspect edges too
    const edges = editor.cy.edges();
    console.log('Number of edges:', edges.length);
    edges.forEach(edge => {
      const rs = edge[0]._private.rscratch;
      const rstyle = edge[0]._private.rstyle;
      console.log(`Edge ${edge.id()}:`, {
        visible: edge.visible(),
        allptsNull: rs.allpts === null,
        rstyleSrcX: rstyle.srcX,
        rstyleTgtX: rstyle.tgtX,
      });
    });

    editor.destroy();
    document.body.removeChild(c);
  });
});
