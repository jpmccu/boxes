import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoxesEditor } from '../src/boxes-editor.js';

const SH = 'http://www.w3.org/ns/shacl#';

describe('annotation-property settings and SHACL shape visibility', () => {
  let container, editor;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    editor = new BoxesEditor(container);
  });

  afterEach(() => {
    editor.destroy();
    container.remove();
  });

  it('omits annotationProperties from export when unchanged', () => {
    expect(editor.exportGraph().annotationProperties).toBeUndefined();
  });

  it('persists configuration in the document and restores it on import', () => {
    editor.setAnnotationProperties({ add: ['http://example.org/rel'], remove: [SH + 'targetClass'] });
    const data = editor.exportGraph();
    expect(data.annotationProperties).toEqual({ add: ['http://example.org/rel'], remove: [SH + 'targetClass'] });

    const container2 = document.createElement('div');
    document.body.appendChild(container2);
    const other = new BoxesEditor(container2);
    other.importGraph(data);
    expect(other.getAnnotationProperties()).toEqual(data.annotationProperties);
    other.destroy();
    container2.remove();
  });

  it('emits annotationPropertiesChanged', () => {
    let payload;
    editor.on('annotationPropertiesChanged', p => { payload = p; });
    editor.setAnnotationProperties({ remove: ['rdfs:seeAlso'] });
    expect(payload.annotationProperties.remove).toEqual(['rdfs:seeAlso']);
  });

  it('toggling a default checkbox in the settings UI updates the config', () => {
    const cb = container.querySelector(`input[data-ann-iri="${SH}targetClass"]`);
    expect(cb).not.toBeNull();
    expect(cb.checked).toBe(true);
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    expect(editor.getAnnotationProperties().remove).toContain(SH + 'targetClass');
    const cb2 = container.querySelector(`input[data-ann-iri="${SH}targetClass"]`);
    expect(cb2.checked).toBe(false);
  });

  it('adds a custom annotation property from the settings UI', () => {
    const input = container.querySelector('[data-ann-new]');
    input.value = 'http://example.org/note';
    container.querySelector('[data-ann-add]').click();
    expect(editor.getAnnotationProperties().add).toEqual(['http://example.org/note']);
  });

  it('hides shape nodes and their edges without changing the exported graph', () => {
    editor.importGraph({
      elements: {
        nodes: [
          { data: { id: 'ex:Person', '@type': 'owl:Class' } },
          { data: { id: 'ex:PersonShape', '@type': 'sh:NodeShape' } },
        ],
        edges: [{ data: { id: 'e1', source: 'ex:PersonShape', target: 'ex:Person', '@id': 'sh:class' } }],
      },
    });
    const shape = editor.cy.getElementById('ex:PersonShape');
    expect(shape.style('display')).toBe('element');
    expect(editor.getShapesVisible()).toBe(true);

    editor.setShapesVisible(false);
    expect(editor.getShapesVisible()).toBe(false);
    expect(editor.cy.getElementById('ex:PersonShape').style('display')).toBe('none');
    expect(editor.cy.getElementById('e1').visible()).toBe(false);
    expect(editor.cy.getElementById('ex:Person').style('display')).toBe('element');

    const out = editor.exportGraph();
    expect(JSON.stringify(out)).not.toContain('display');
    expect(out.elements.nodes).toHaveLength(2);

    editor.setShapesVisible(true);
    expect(editor.cy.getElementById('ex:PersonShape').style('display')).toBe('element');
  });
});
