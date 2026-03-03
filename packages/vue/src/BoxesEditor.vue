<template>
  <div class="boxes-editor-wrapper">
    <div v-if="nodeTypes.length" class="boxes-palette">
      <div class="boxes-palette-header">Node Types</div>
      <div
        v-for="type in nodeTypes"
        :key="type.id"
        class="boxes-palette-item"
        :title="`Add ${type.label}`"
        @click="addNodeOfType(type.id)"
      >
        <div class="boxes-palette-swatch" :style="swatchStyle(type)"></div>
        <span class="boxes-palette-label">{{ type.label }}</span>
      </div>
    </div>
    <div ref="containerRef" class="boxes-canvas"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, defineExpose } from 'vue';
import { BoxesEditor as BoxesCore } from '@boxes/core';

const props = defineProps({
  elements: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  },
  style: {
    type: Array,
    default: () => []
  },
  layout: {
    type: Object,
    default: () => ({ name: 'preset' })
  },
  nodeTypes: {
    type: Array,
    default: () => []
  },
  edgeTypes: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  'change',
  'selectionChange',
  'nodeAdded',
  'edgeAdded',
  'elementRemoved',
  'elementUpdated',
  'styleUpdated',
  'layoutRun',
  'elementsLoaded',
  'graphImported',
  'edgeTypeChanged',
  'edgeHandleComplete'
]);

const containerRef = ref(null);
let editor = null;

const nodeTypes = computed(() => props.nodeTypes);

function swatchStyle(type) {
  const radius = type.shape === 'ellipse' ? '50%'
               : type.shape === 'roundrectangle' ? '5px' : '2px';
  return {
    background: type.color || '#ccc',
    borderColor: type.borderColor || '#666',
    borderRadius: radius
  };
}

function addNodeOfType(typeId) {
  editor?.addNodeOfType(typeId);
}

onMounted(() => {
  if (containerRef.value) {
    editor = new BoxesCore(containerRef.value, {
      elements: props.elements,
      style: props.style,
      layout: props.layout,
      nodeTypes: props.nodeTypes,
      edgeTypes: props.edgeTypes
    });
    setupEventForwarding();
  }
});

onUnmounted(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});

function setupEventForwarding() {
  const events = [
    'change', 'selectionChange', 'nodeAdded', 'edgeAdded',
    'elementRemoved', 'elementUpdated', 'styleUpdated',
    'layoutRun', 'elementsLoaded', 'graphImported',
    'edgeTypeChanged', 'edgeHandleComplete'
  ];
  events.forEach(eventName => {
    editor.on(eventName, (data) => emit(eventName, data));
  });
}

// Watch for prop changes
watch(() => props.elements, (newElements) => {
  if (editor && newElements) editor.loadElements(newElements);
}, { deep: true });

watch(() => props.layout, (newLayout) => {
  if (editor && newLayout) editor.runLayout(newLayout);
}, { deep: true });

// Expose methods for imperative access
defineExpose({
  addNode: (...args) => editor?.addNode(...args),
  addEdge: (...args) => editor?.addEdge(...args),
  addNodeOfType: (...args) => editor?.addNodeOfType(...args),
  removeElement: (...args) => editor?.removeElement(...args),
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
  removeStyleRule: (...args) => editor?.removeStyleRule(...args)
});
</script>

<style scoped>
.boxes-editor-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 400px;
  overflow: hidden;
}

.boxes-palette {
  width: 140px;
  flex-shrink: 0;
  background: #fafafa;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.boxes-palette-header {
  padding: 8px 10px 4px;
  font-size: 10px;
  font-weight: 700;
  color: #95a5a6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.boxes-palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.15s;
  user-select: none;
}

.boxes-palette-item:hover {
  background: #eef6fd;
}

.boxes-palette-swatch {
  width: 24px;
  height: 18px;
  border: 2px solid #666;
  flex-shrink: 0;
}

.boxes-palette-label {
  font-size: 12px;
  color: #2c3e50;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.boxes-canvas {
  flex: 1;
  min-width: 0;
  height: 100%;
}
</style>
