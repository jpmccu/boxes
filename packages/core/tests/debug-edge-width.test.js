import { describe, it } from 'vitest';
import cytoscape from 'cytoscape';

describe('edge default width', () => {
  it('checks default width and takesUpSpace', () => {
    const c = document.createElement('div');
    c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    const cy = cytoscape({
      container: c,
      elements: [
        { data: { id: 'n1' }, position: { x: 100, y: 100 } },
        { data: { id: 'n2' }, position: { x: 300, y: 200 } },
        { data: { id: 'e1', source: 'n1', target: 'n2' } }
      ]
    });
    const e = cy.$('#e1');
    console.log('Edge default width:', e.pstyle('width').pfValue, e.pstyle('width').strValue);
    console.log('Edge visible():', e.visible());
    console.log('Edge takesUpSpace():', e.takesUpSpace());
    console.log('Edge rstyle.clean:', e[0]._private.rstyle.clean);
    console.log('Edge rs.allpts:', e[0]._private.rscratch.allpts);
    cy.destroy();
    document.body.removeChild(c);
  });
});
