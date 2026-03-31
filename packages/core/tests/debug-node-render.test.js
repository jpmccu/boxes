/**
 * Debug test: reproduce "some nodes don't render at first" in the tutorial.
 * Tests the full OWL demo flow with width:label nodes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BoxesEditor } from '../src/boxes-editor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('node rendering after importGraph with OWL demo (tutorial flow)', () => {
  it('nodes have rstyle.labelHeight > 0 after importGraph (height:label)', async () => {
    const demoPath = resolve(__dirname, '../../docs/public/demos/owl-4-hierarchy.boxes');
    const graphData = JSON.parse(readFileSync(demoPath, 'utf8'));

    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    const editor = new BoxesEditor(c, { layout: { name: 'preset' } });
    // Simulate async delay (multiple rAFs fire before importGraph)
    await new Promise(r => setTimeout(r, 120));

    editor.importGraph(graphData);

    // Immediately check node state (before any rAF)
    const nodes = editor.cy.nodes();
    console.log('\n=== Node state after importGraph (before rAF) ===');
    nodes.forEach(n => {
      const rs = n[0]._private.rstyle;
      const sc = n[0]._private.styleCache;
      const bb = n.boundingBox();
      console.log(`  ${n.id()}: labelW=${rs.labelWidth}, labelH=${rs.labelHeight}, bb.w=${bb.w?.toFixed(1)}, bb.h=${bb.h?.toFixed(1)}, visible=${n.visible()}`);
    });

    // After an rAF
    await new Promise(r => setTimeout(r, 80));
    
    console.log('\n=== Node state after rAF ===');
    nodes.forEach(n => {
      const rs = n[0]._private.rstyle;
      const bb = n.boundingBox();
      console.log(`  ${n.id()}: labelW=${rs.labelWidth}, labelH=${rs.labelHeight}, bb.w=${bb.w?.toFixed(1)}, visible=${n.visible()}`);
    });

    // Edges
    const edges = editor.cy.edges();
    console.log('\n=== Edge state after rAF ===');
    edges.forEach(e => {
      const rs = e[0]._private.rscratch;
      console.log(`  ${e.id()}: allpts=${Array.isArray(rs.allpts) ? 'SET('+rs.allpts.length+')' : rs.allpts}, visible=${e.visible()}`);
    });

    // In jsdom, nodes with width:label are invisible (labelWidth=0 from text measurement)
    // But labelHeight should be > 0 (based on font-size, not measureText)
    nodes.forEach(n => {
      const rs = n[0]._private.rstyle;
      expect(rs.labelHeight, `Node ${n.id()} should have labelHeight > 0 (font-size based)`).toBeGreaterThan(0);
    });

    editor.destroy();
    document.body.removeChild(c);
  });

  it('nodes with fixed width are visible after importGraph', async () => {
    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);

    const editor = new BoxesEditor(c, { layout: { name: 'preset' } });
    await new Promise(r => setTimeout(r, 120));

    // Use fixed-pixel-width nodes (not label)
    const graphData = {
      version: '1.0.0',
      elements: {
        nodes: [
          { data: { id: 'n1', label: 'Animal' }, position: { x: 200, y: 150 } },
          { data: { id: 'n2', label: 'Dog' },    position: { x: 400, y: 300 } },
        ],
        edges: [
          { data: { id: 'e1', source: 'n1', target: 'n2', label: 'parent' } },
        ]
      },
      userStylesheet: [
        // Explicitly fixed width/height (no label sizing)
        { selector: 'node', style: { 'width': '80px', 'height': '40px', 'background-color': '#4A90E2' } }
      ],
      palette: { nodeTypes: [], edgeTypes: [] },
    };
    editor.importGraph(graphData);

    await new Promise(r => setTimeout(r, 80));

    const nodes = editor.cy.nodes();
    const edges = editor.cy.edges();
    
    // All nodes should be visible
    nodes.forEach(n => {
      expect(n.visible(), `Node ${n.id()} should be visible`).toBe(true);
      const bb = n.boundingBox();
      expect(bb.w, `Node ${n.id()} should have bb.w > 0`).toBeGreaterThan(0);
    });

    // All edges should have computed geometry
    edges.forEach(e => {
      const rs = e[0]._private.rscratch;
      expect(Array.isArray(rs.allpts), `Edge ${e.id()} should have allpts array`).toBe(true);
      expect(rs.allpts.length, `Edge ${e.id()} allpts should be non-empty`).toBeGreaterThan(0);
    });

    editor.destroy();
    document.body.removeChild(c);
  });
});
