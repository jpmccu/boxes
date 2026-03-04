<template>
  <div ref="containerRef" class="boxes-vue-wrapper"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { BoxesEditor as BoxesCore } from '@boxes/core';

const props = defineProps({
  elements: { type: Object, default: () => ({ nodes: [], edges: [] }) },
  style: { type: Array, default: () => [] },
  layout: { type: Object, default: () => ({ name: 'preset' }) },
  nodeTypes: { type: Array, default: () => [] },
  edgeTypes: { type: Array, default: () => [] }
});

const emit = defineEmits([
  'change', 'select', 'unselect', 'selectionChange',
  'nodeAdded', 'edgeAdded', 'elementRemoved', 'elementUpdated',
  'styleUpdated', 'layoutRun', 'elementsLoaded', 'graphImported',
  'edgeTypeChanged', 'edgeHandleComplete', 'historyChange'
]);

const containerRef = ref(null);
let editor = null;

onMounted(() => {
  if (containerRef.value) {
    editor = new BoxesCore(containerRef.value, {
      elements: props.elements,
      style: props.style,
      layout: props.layout,
      nodeTypes: props.nodeTypes,
      edgeTypes: props.edgeTypes
    });
    const events = [
      'change', 'select', 'unselect', 'selectionChange',
      'nodeAdded', 'edgeAdded', 'elementRemoved', 'elementUpdated',
      'styleUpdated', 'layoutRun', 'elementsLoaded', 'graphImported',
      'edgeTypeChanged', 'edgeHandleComplete', 'historyChange'
    ];
    events.forEach(eventName => {
      editor.on(eventName, (data) => emit(eventName, data));
    });
  }
});

onUnmounted(() => {
  if (editor) { editor.destroy(); editor = null; }
});

watch(() => props.elements, (newElements) => {
  if (editor && newElements) editor.loadElements(newElements);
}, { deep: true });

watch(() => props.layout, (newLayout) => {
  if (editor && newLayout) editor.runLayout(newLayout);
}, { deep: true });

defineExpose({
  addNode: (...args) => editor?.addNode(...args),
  addEdge: (...args) => editor?.addEdge(...args),
  addNodeOfType: (...args) => editor?.addNodeOfType(...args),
  removeElement: (...args) => editor?.removeElement(...args),
  removeSelected: () => editor?.removeSelected(),
  updateElement: (...args) => editor?.updateElement(...args),
  updateElementStyle: (...args) => editor?.updateElementStyle(...args),
  runLayout: (...args) => editor?.runLayout(...args),
  getAvailableLayouts: () => editor?.getAvailableLayouts(),
  getElements: () => editor?.getElements(),
  loadElements: (...args) => editor?.loadElements(...args),
  exportGraph: () => editor?.exportGraph(),
  importGraph: (...args) => editor?.importGraph(...args),
  getSelected: () => editor?.getSelected(),
  selectElements: (...args) => editor?.selectElements(...args),
  getCytoscape: () => editor?.getCytoscape(),
  getNodeTypes: () => editor?.getNodeTypes(),
  getEdgeTypes: () => editor?.getEdgeTypes(),
  getEdgeType: () => editor?.getEdgeType(),
  setEdgeType: (...args) => editor?.setEdgeType(...args),
  getStylesheet: () => editor?.getStylesheet(),
  setStylesheet: (...args) => editor?.setStylesheet(...args),
  addStyleRule: (...args) => editor?.addStyleRule(...args),
  updateStyleRule: (...args) => editor?.updateStyleRule(...args),
  removeStyleRule: (...args) => editor?.removeStyleRule(...args),
  undo: () => editor?.undo(),
  redo: () => editor?.redo(),
  canUndo: () => editor?.canUndo(),
  canRedo: () => editor?.canRedo()
});
</script>

<style scoped>
.boxes-vue-wrapper {
  width: 100%;
  height: 100%;
}
</style>
