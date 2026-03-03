import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import BoxesEditor from '../src/BoxesEditor.vue';

describe('BoxesEditor Vue Component', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = null;
  });

  it('should mount the component', () => {
    wrapper = mount(BoxesEditor);
    expect(wrapper.exists()).toBe(true);
  });

  it('should initialize with elements prop', async () => {
    const elements = {
      nodes: [{ data: { id: 'n1', label: 'Node 1' } }],
      edges: []
    };

    wrapper = mount(BoxesEditor, {
      props: { elements }
    });

    await wrapper.vm.$nextTick();
    
    const retrievedElements = wrapper.vm.getElements();
    expect(retrievedElements.nodes).toHaveLength(1);
  });

  it('should expose addNode method', async () => {
    wrapper = mount(BoxesEditor);
    await wrapper.vm.$nextTick();

    const node = wrapper.vm.addNode({ id: 'n1', label: 'Test' });
    expect(node.data.id).toBe('n1');
  });

  it('should expose addEdge method', async () => {
    wrapper = mount(BoxesEditor);
    await wrapper.vm.$nextTick();

    wrapper.vm.addNode({ id: 'n1' });
    wrapper.vm.addNode({ id: 'n2' });
    
    const edge = wrapper.vm.addEdge('n1', 'n2', { label: 'connects' });
    expect(edge.data.source).toBe('n1');
    expect(edge.data.target).toBe('n2');
  });

  it('should emit nodeAdded event', async () => {
    wrapper = mount(BoxesEditor);
    await wrapper.vm.$nextTick();

    wrapper.vm.addNode({ id: 'n1', label: 'Test' });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('nodeAdded')).toBeTruthy();
    expect(wrapper.emitted('nodeAdded')[0][0].node.data.id).toBe('n1');
  });

  it('should update elements when prop changes', async () => {
    const initialElements = {
      nodes: [{ data: { id: 'n1', label: 'Node 1' } }],
      edges: []
    };

    wrapper = mount(BoxesEditor, {
      props: { elements: initialElements }
    });
    await wrapper.vm.$nextTick();

    const newElements = {
      nodes: [
        { data: { id: 'n1', label: 'Node 1' } },
        { data: { id: 'n2', label: 'Node 2' } }
      ],
      edges: []
    };

    await wrapper.setProps({ elements: newElements });
    await wrapper.vm.$nextTick();

    const retrievedElements = wrapper.vm.getElements();
    expect(retrievedElements.nodes).toHaveLength(2);
  });

  it('should export and import graph', async () => {
    wrapper = mount(BoxesEditor);
    await wrapper.vm.$nextTick();

    wrapper.vm.addNode({ id: 'n1', label: 'Test' });
    
    const exported = wrapper.vm.exportGraph();
    expect(exported.elements.nodes).toHaveLength(1);

    wrapper.vm.importGraph(exported);
    const elements = wrapper.vm.getElements();
    expect(elements.nodes).toHaveLength(1);
  });

  it('should cleanup on unmount', async () => {
    wrapper = mount(BoxesEditor);
    await wrapper.vm.$nextTick();

    wrapper.vm.addNode({ id: 'n1' });
    
    wrapper.unmount();
    // Component should clean up without errors
  });
});
