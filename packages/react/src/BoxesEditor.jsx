import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { BoxesEditor as BoxesCore } from '@boxes/core';

const paletteStyle = {
  wrapper: { display: 'flex', width: '100%', height: '100%', minHeight: '400px', overflow: 'hidden' },
  palette: { width: '140px', flexShrink: 0, background: '#fafafa', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  header: { padding: '8px 10px 4px', fontSize: '10px', fontWeight: 700, color: '#95a5a6', textTransform: 'uppercase', letterSpacing: '0.5px' },
  item: { display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', userSelect: 'none' },
  swatch: { width: '24px', height: '18px', border: '2px solid #666', flexShrink: 0 },
  label: { fontSize: '12px', color: '#2c3e50', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  canvas: { flex: 1, minWidth: 0, height: '100%' }
};

const BoxesEditor = forwardRef(({
  elements = { nodes: [], edges: [] },
  style = [],
  layout = { name: 'preset' },
  nodeTypes = [],
  edgeTypes = [],
  onChange,
  onSelectionChange,
  onNodeAdded,
  onEdgeAdded,
  onElementRemoved,
  onElementUpdated,
  onStyleUpdated,
  onLayoutRun,
  onElementsLoaded,
  onGraphImported,
  onEdgeTypeChanged,
  onEdgeHandleComplete
}, ref) => {
  const containerRef = useRef(null);
  const editorRef    = useRef(null);
  const handlersRef  = useRef({});

  // Keep handlers ref current
  useEffect(() => {
    handlersRef.current = {
      onChange, onSelectionChange, onNodeAdded, onEdgeAdded,
      onElementRemoved, onElementUpdated, onStyleUpdated,
      onLayoutRun, onElementsLoaded, onGraphImported,
      onEdgeTypeChanged, onEdgeHandleComplete
    };
  });

  // Initialize editor once
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      editorRef.current = new BoxesCore(containerRef.current, {
        elements, style, layout, nodeTypes, edgeTypes
      });

      const eventMap = {
        change: 'onChange', selectionChange: 'onSelectionChange',
        nodeAdded: 'onNodeAdded', edgeAdded: 'onEdgeAdded',
        elementRemoved: 'onElementRemoved', elementUpdated: 'onElementUpdated',
        styleUpdated: 'onStyleUpdated', layoutRun: 'onLayoutRun',
        elementsLoaded: 'onElementsLoaded', graphImported: 'onGraphImported',
        edgeTypeChanged: 'onEdgeTypeChanged', edgeHandleComplete: 'onEdgeHandleComplete'
      };

      Object.entries(eventMap).forEach(([coreEvent, propHandler]) => {
        editorRef.current.on(coreEvent, (data) => {
          if (handlersRef.current[propHandler]) handlersRef.current[propHandler](data);
        });
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []); // intentionally empty — editor initializes once

  useEffect(() => {
    if (editorRef.current && elements) editorRef.current.loadElements(elements);
  }, [elements]);

  useEffect(() => {
    if (editorRef.current && layout) editorRef.current.runLayout(layout);
  }, [layout]);

  useImperativeHandle(ref, () => ({
    addNode: (...args) => editorRef.current?.addNode(...args),
    addEdge: (...args) => editorRef.current?.addEdge(...args),
    addNodeOfType: (...args) => editorRef.current?.addNodeOfType(...args),
    removeElement: (...args) => editorRef.current?.removeElement(...args),
    updateElement: (...args) => editorRef.current?.updateElement(...args),
    updateElementStyle: (...args) => editorRef.current?.updateElementStyle(...args),
    runLayout: (...args) => editorRef.current?.runLayout(...args),
    getAvailableLayouts: () => editorRef.current?.getAvailableLayouts(),
    getElements: () => editorRef.current?.getElements(),
    loadElements: (...args) => editorRef.current?.loadElements(...args),
    exportGraph: () => editorRef.current?.exportGraph(),
    importGraph: (...args) => editorRef.current?.importGraph(...args),
    getSelected: () => editorRef.current?.getSelected(),
    selectElements: (...args) => editorRef.current?.selectElements(...args),
    getCytoscape: () => editorRef.current?.getCytoscape(),
    getNodeTypes: () => editorRef.current?.getNodeTypes(),
    getEdgeTypes: () => editorRef.current?.getEdgeTypes(),
    getEdgeType: () => editorRef.current?.getEdgeType(),
    setEdgeType: (...args) => editorRef.current?.setEdgeType(...args),
    getStylesheet: () => editorRef.current?.getStylesheet(),
    setStylesheet: (...args) => editorRef.current?.setStylesheet(...args),
    addStyleRule: (...args) => editorRef.current?.addStyleRule(...args),
    updateStyleRule: (...args) => editorRef.current?.updateStyleRule(...args),
    removeStyleRule: (...args) => editorRef.current?.removeStyleRule(...args)
  }), []);

  function getSwatchStyle(type) {
    const radius = type.shape === 'ellipse' ? '50%' : type.shape === 'roundrectangle' ? '5px' : '2px';
    return { ...paletteStyle.swatch, background: type.color || '#ccc', borderColor: type.borderColor || '#666', borderRadius: radius };
  }

  return (
    <div style={paletteStyle.wrapper}>
      {nodeTypes.length > 0 && (
        <div style={paletteStyle.palette}>
          <div style={paletteStyle.header}>Node Types</div>
          {nodeTypes.map(type => (
            <div
              key={type.id}
              style={paletteStyle.item}
              title={`Add ${type.label}`}
              onClick={() => editorRef.current?.addNodeOfType(type.id)}
            >
              <div style={getSwatchStyle(type)} />
              <span style={paletteStyle.label}>{type.label}</span>
            </div>
          ))}
        </div>
      )}
      <div ref={containerRef} style={paletteStyle.canvas} />
    </div>
  );
});

BoxesEditor.displayName = 'BoxesEditor';

export default BoxesEditor;
