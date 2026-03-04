import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { BoxesEditor as BoxesCore } from '@boxes/core';

/**
 * React wrapper for BoxesEditor.
 * BoxesCore renders the full self-contained editor UI (canvas + sidebar)
 * into the container div. This component is purely a mount point + API bridge.
 */
const BoxesEditor = forwardRef(({
  elements = { nodes: [], edges: [] },
  style = [],
  layout = { name: 'preset' },
  nodeTypes = [],
  edgeTypes = [],
  onChange,
  onSelect,
  onUnselect,
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
  onEdgeHandleComplete,
  onHistoryChange
}, ref) => {
  const containerRef = useRef(null);
  const editorRef    = useRef(null);
  // Keep handlers current without re-initializing the editor
  const handlersRef  = useRef({});

  useEffect(() => {
    handlersRef.current = {
      onChange, onSelect, onUnselect, onSelectionChange,
      onNodeAdded, onEdgeAdded, onElementRemoved, onElementUpdated,
      onStyleUpdated, onLayoutRun, onElementsLoaded, onGraphImported,
      onEdgeTypeChanged, onEdgeHandleComplete, onHistoryChange
    };
  });

  // Initialize editor once on mount
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      editorRef.current = new BoxesCore(containerRef.current, {
        elements, style, layout, nodeTypes, edgeTypes
      });

      const eventMap = {
        change: 'onChange',
        select: 'onSelect',
        unselect: 'onUnselect',
        selectionChange: 'onSelectionChange',
        nodeAdded: 'onNodeAdded',
        edgeAdded: 'onEdgeAdded',
        elementRemoved: 'onElementRemoved',
        elementUpdated: 'onElementUpdated',
        styleUpdated: 'onStyleUpdated',
        layoutRun: 'onLayoutRun',
        elementsLoaded: 'onElementsLoaded',
        graphImported: 'onGraphImported',
        edgeTypeChanged: 'onEdgeTypeChanged',
        edgeHandleComplete: 'onEdgeHandleComplete',
        historyChange: 'onHistoryChange'
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

  // Expose imperative API via ref
  useImperativeHandle(ref, () => ({
    addNode: (...args) => editorRef.current?.addNode(...args),
    addEdge: (...args) => editorRef.current?.addEdge(...args),
    addNodeOfType: (...args) => editorRef.current?.addNodeOfType(...args),
    removeElement: (...args) => editorRef.current?.removeElement(...args),
    removeSelected: () => editorRef.current?.removeSelected(),
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
    removeStyleRule: (...args) => editorRef.current?.removeStyleRule(...args),
    undo: () => editorRef.current?.undo(),
    redo: () => editorRef.current?.redo(),
    canUndo: () => editorRef.current?.canUndo(),
    canRedo: () => editorRef.current?.canRedo()
  }), []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
});

BoxesEditor.displayName = 'BoxesEditor';

export default BoxesEditor;
