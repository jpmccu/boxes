import cytoscape from 'cytoscape';
import cytoscapeEdgehandles from 'cytoscape-edgehandles';
import cytoscapeDagre from 'cytoscape-dagre';
import cytoscapeCola from 'cytoscape-cola';

// Register Cytoscape extensions once at module load (idempotent)
cytoscape.use(cytoscapeEdgehandles);
cytoscape.use(cytoscapeDagre);
cytoscape.use(cytoscapeCola);

// Module-level counter ensures unique IDs even when elements are created in the same millisecond
let _idCounter = 0;
function _uniqueId(prefix) {
  return `${prefix}${Date.now()}_${++_idCounter}`;
}

/**
 * Definitions for all known Cytoscape layout algorithms.
 * Built-in ones are always available; extension layouts are shown only if registered.
 * Each entry: { label, builtin, params: [ { name, label, type, default, min?, max?, options? } ] }
 */
const LAYOUT_DEFINITIONS = {
  random: {
    label: 'Random',
    builtin: true,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'fit', label: 'Fit to viewport', type: 'boolean', default: true }
    ]
  },
  grid: {
    label: 'Grid',
    builtin: true,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'spacingFactor', label: 'Spacing factor', type: 'number', default: 1.0, min: 0.1, max: 5, step: 0.1 },
      { name: 'avoidOverlap', label: 'Avoid overlap', type: 'boolean', default: true },
      { name: 'condense', label: 'Condense', type: 'boolean', default: false },
      { name: 'rows', label: 'Rows (0=auto)', type: 'number', default: 0, min: 0 },
      { name: 'cols', label: 'Columns (0=auto)', type: 'number', default: 0, min: 0 }
    ]
  },
  circle: {
    label: 'Circle',
    builtin: true,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'spacingFactor', label: 'Spacing factor', type: 'number', default: 1.75, min: 0.1, max: 5, step: 0.1 },
      { name: 'avoidOverlap', label: 'Avoid overlap', type: 'boolean', default: true },
      { name: 'radius', label: 'Radius (0=auto)', type: 'number', default: 0, min: 0 },
      { name: 'clockwise', label: 'Clockwise', type: 'boolean', default: true }
    ]
  },
  concentric: {
    label: 'Concentric',
    builtin: true,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'spacingFactor', label: 'Spacing factor', type: 'number', default: 1.75, min: 0.1, max: 5, step: 0.1 },
      { name: 'minNodeSpacing', label: 'Min node spacing', type: 'number', default: 10, min: 0 },
      { name: 'avoidOverlap', label: 'Avoid overlap', type: 'boolean', default: true },
      { name: 'equidistant', label: 'Equidistant rings', type: 'boolean', default: false },
      { name: 'clockwise', label: 'Clockwise', type: 'boolean', default: false }
    ]
  },
  breadthfirst: {
    label: 'Breadth-first',
    builtin: true,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'spacingFactor', label: 'Spacing factor', type: 'number', default: 1.75, min: 0.1, max: 5, step: 0.1 },
      { name: 'directed', label: 'Directed', type: 'boolean', default: false },
      { name: 'circle', label: 'Circular roots', type: 'boolean', default: false },
      { name: 'grid', label: 'Grid mode', type: 'boolean', default: false },
      { name: 'avoidOverlap', label: 'Avoid overlap', type: 'boolean', default: true },
      { name: 'maximalAdjacencies', label: 'Maximal adjacencies', type: 'boolean', default: false }
    ]
  },
  cose: {
    label: 'CoSE (force-directed)',
    builtin: true,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'nodeRepulsion', label: 'Node repulsion', type: 'number', default: 2048, min: 0, max: 100000 },
      { name: 'idealEdgeLength', label: 'Ideal edge length', type: 'number', default: 32, min: 1 },
      { name: 'edgeElasticity', label: 'Edge elasticity', type: 'number', default: 32, min: 0 },
      { name: 'gravity', label: 'Gravity', type: 'number', default: 1, min: 0 },
      { name: 'numIter', label: 'Iterations', type: 'number', default: 1000, min: 1, max: 10000 },
      { name: 'randomize', label: 'Randomize start', type: 'boolean', default: true },
      { name: 'avoidOverlap', label: 'Avoid overlap', type: 'boolean', default: true },
      { name: 'fit', label: 'Fit to viewport', type: 'boolean', default: true }
    ]
  },
  // Extension layouts (shown only if registered)
  dagre: {
    label: 'Dagre (DAG/hierarchical)',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'spacingFactor', label: 'Spacing factor', type: 'number', default: 1.0, min: 0.1, max: 5, step: 0.1 },
      { name: 'rankDir', label: 'Direction', type: 'select', default: 'TB', options: ['TB','BT','LR','RL'] },
      { name: 'align', label: 'Alignment', type: 'select', default: 'UL', options: ['UL','UR','DL','DR'] },
      { name: 'ranker', label: 'Ranker', type: 'select', default: 'network-simplex', options: ['network-simplex','tight-tree','longest-path'] },
      { name: 'nodeSep', label: 'Node separation', type: 'number', default: 50, min: 0 },
      { name: 'rankSep', label: 'Rank separation', type: 'number', default: 50, min: 0 },
      { name: 'edgeSep', label: 'Edge separation', type: 'number', default: 10, min: 0 }
    ]
  },
  cola: {
    label: 'Cola (constraint-based)',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'nodeSpacing', label: 'Node spacing', type: 'number', default: 10, min: 0 },
      { name: 'edgeLength', label: 'Edge length', type: 'number', default: 45, min: 1 },
      { name: 'maxSimulationTime', label: 'Max simulation time (ms)', type: 'number', default: 4000, min: 100 },
      { name: 'avoidOverlap', label: 'Avoid overlap', type: 'boolean', default: true },
      { name: 'handleDisconnected', label: 'Handle disconnected', type: 'boolean', default: true },
      { name: 'unconstrIter', label: 'Unconstrained iterations', type: 'number', default: 10, min: 0 },
      { name: 'userConstIter', label: 'User constrained iterations', type: 'number', default: 20, min: 0 },
      { name: 'allConstIter', label: 'All constrained iterations', type: 'number', default: 20, min: 0 }
    ]
  },
  fcose: {
    label: 'fCoSE (fast force-directed)',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'nodeSeparation', label: 'Node separation', type: 'number', default: 75, min: 0 },
      { name: 'idealEdgeLength', label: 'Ideal edge length', type: 'number', default: 50, min: 1 },
      { name: 'edgeElasticity', label: 'Edge elasticity', type: 'number', default: 0.45, min: 0, max: 1, step: 0.01 },
      { name: 'gravity', label: 'Gravity', type: 'number', default: 0.25, min: 0, step: 0.01 },
      { name: 'gravityRange', label: 'Gravity range', type: 'number', default: 3.8, min: 0, step: 0.1 },
      { name: 'numIter', label: 'Iterations', type: 'number', default: 2500, min: 100 },
      { name: 'randomize', label: 'Randomize start', type: 'boolean', default: true },
      { name: 'fit', label: 'Fit to viewport', type: 'boolean', default: true }
    ]
  },
  elk: {
    label: 'ELK',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 20, min: 0 },
      { name: 'elk.algorithm', label: 'Algorithm', type: 'select', default: 'layered', options: ['layered','stress','mrtree','radial','force','disco'] },
      { name: 'elk.direction', label: 'Direction', type: 'select', default: 'DOWN', options: ['DOWN','UP','RIGHT','LEFT'] },
      { name: 'elk.spacing.nodeNode', label: 'Node spacing', type: 'number', default: 20, min: 0 }
    ]
  },
  euler: {
    label: 'Euler (force-directed)',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'springLength', label: 'Spring length', type: 'number', default: 80, min: 1 },
      { name: 'springCoeff', label: 'Spring coefficient', type: 'number', default: 0.0008, min: 0, step: 0.0001 },
      { name: 'mass', label: 'Node mass', type: 'number', default: 4, min: 1 },
      { name: 'gravity', label: 'Gravity', type: 'number', default: -1.2, step: 0.1 },
      { name: 'pull', label: 'Pull force', type: 'number', default: 0.001, min: 0, step: 0.0001 },
      { name: 'theta', label: 'Theta (Barnes-Hut)', type: 'number', default: 0.666, min: 0, max: 1, step: 0.001 },
      { name: 'maxIterations', label: 'Max iterations', type: 'number', default: 1000, min: 100 },
      { name: 'randomize', label: 'Randomize start', type: 'boolean', default: true },
      { name: 'fit', label: 'Fit to viewport', type: 'boolean', default: true }
    ]
  },
  spread: {
    label: 'Spread',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'minDist', label: 'Min distance', type: 'number', default: 1, min: 0 },
      { name: 'expandingFactor', label: 'Expanding factor', type: 'number', default: -1.0, step: 0.1 },
      { name: 'maxExpandIterations', label: 'Max expand iterations', type: 'number', default: 4, min: 1 },
      { name: 'fit', label: 'Fit to viewport', type: 'boolean', default: true }
    ]
  },
  klay: {
    label: 'KLay (hierarchical)',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 30, min: 0 },
      { name: 'spacing', label: 'Spacing', type: 'number', default: 20, min: 0 },
      { name: 'klay.direction', label: 'Direction', type: 'select', default: 'DOWN', options: ['DOWN','UP','RIGHT','LEFT'] },
      { name: 'klay.edgeRouting', label: 'Edge routing', type: 'select', default: 'ORTHOGONAL', options: ['ORTHOGONAL','POLYLINE','SPLINES'] },
      { name: 'klay.nodeLayering', label: 'Node layering', type: 'select', default: 'NETWORK_SIMPLEX', options: ['NETWORK_SIMPLEX','LONGEST_PATH','INTERACTIVE'] }
    ]
  },
  avsdf: {
    label: 'AVSDF (circular)',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 10, min: 0 },
      { name: 'nodeSeparation', label: 'Node separation', type: 'number', default: 60, min: 0 }
    ]
  },
  cise: {
    label: 'CiSE (clustered)',
    builtin: false,
    params: [
      { name: 'padding', label: 'Padding', type: 'number', default: 10, min: 0 },
      { name: 'nodeSeparation', label: 'Node separation', type: 'number', default: 12.5, min: 0 },
      { name: 'idealInterClusterEdgeLengthCoefficient', label: 'Inter-cluster edge length', type: 'number', default: 1.4, min: 0, step: 0.1 },
      { name: 'allowNodesInsideCircle', label: 'Allow nodes inside circle', type: 'boolean', default: false },
      { name: 'maxRatioOfNodesInsideCircle', label: 'Max ratio inside circle', type: 'number', default: 0.1, min: 0, max: 1, step: 0.01 },
      { name: 'springCoeff', label: 'Spring coefficient', type: 'number', default: 0.45, min: 0, max: 1, step: 0.01 },
      { name: 'nodeRepulsion', label: 'Node repulsion', type: 'number', default: 4500, min: 0 },
      { name: 'gravity', label: 'Gravity', type: 'number', default: 0.25, min: 0, step: 0.01 },
      { name: 'gravityRange', label: 'Gravity range', type: 'number', default: 3.8, min: 0, step: 0.1 }
    ]
  }
};

/**
 * BoxesEditor - A Cytoscape.js-based Labeled Property Graph editor
 */
export class BoxesEditor {
  constructor(container, options = {}) {
    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.options = {
      layout: options.layout || { name: 'preset' },
      ...options
    };

    // Unique ID for this instance (used for SVG marker IDs, etc.)
    this._instanceId = Math.random().toString(36).slice(2, 9);

    // userStylesheet = the per-graph editable rules (saved with the document)
    this.userStylesheet = (options.style || []).map(rule => ({
      selector: rule.selector,
      style: { ...rule.style }
    }));

    // Node and edge type definitions (from template or passed directly)
    this._nodeTypes = (options.nodeTypes || []).map(t => ({ ...t }));
    this._edgeTypes = (options.edgeTypes || []).map(t => ({ ...t }));
    // Track current edge type used by the edge handle
    this.currentEdgeType = this._edgeTypes[0] || null;

    this.cy = null;
    this.eventHandlers = new Map();

    // Track the last used layout name and options (saved with file)
    this._lastLayout = { name: 'cose', options: {} };

    // Undo/redo snapshot stacks
    this._undoStack = [];
    this._redoStack = [];
    this._restoringState = false;
    this._preGrabSnapshot = null;

    this._init();

    // Built-in edge handle (half-circle drag-to-connect); disable with edgeHandle: false
    if (options.edgeHandle !== false && typeof document !== 'undefined' && document.body) {
      this._initEdgeHandle();
    }
  }

  _init() {
    // Build complete stylesheet from options.style and element _style properties
    const stylesheet = this._buildStylesheet();

    this.cy = cytoscape({
      container: this.container,
      elements: this.options.elements || { nodes: [], edges: [] },
      style: stylesheet,
      layout: this.options.layout,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true
    });

    // Setup default event handlers
    this._setupEvents();
  }

  _buildStylesheet() {
    const baseStyles = [
      // Default node styles
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'background-color': '#666',
          'color': '#fff',
          'font-size': '12px',
          'width': '60px',
          'height': '60px'
        }
      },
      // Default edge styles
      {
        selector: 'edge',
        style: {
          'label': 'data(label)',
          'width': 2,
          'line-color': '#999',
          'target-arrow-color': '#999',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'font-size': '10px'
        }
      },
      // Selected element styles
      {
        selector: ':selected',
        style: {
          'overlay-color': '#4A90E2',
          'overlay-padding': 6,
          'overlay-opacity': 0.25,
          'border-width': 3,
          'border-color': '#4A90E2'
        }
      },
      // cytoscape-edgehandles ghost/preview styles (handle is DOM-based via popper)
      {
        selector: '.eh-source',
        style: { 'border-width': 3, 'border-color': '#3498db' }
      },
      {
        selector: '.eh-target',
        style: { 'border-width': 3, 'border-color': '#3498db' }
      },
      {
        selector: '.eh-preview, .eh-ghost-edge',
        style: {
          'background-color': '#3498db',
          'line-color': '#3498db',
          'target-arrow-color': '#3498db',
          'source-arrow-color': '#3498db',
          'line-style': 'dashed'
        }
      },
      {
        selector: '.eh-ghost-edge.eh-preview-active',
        style: { 'opacity': 0 }
      }
    ];

    // Add custom styles from per-graph userStylesheet
    const customStyles = this.userStylesheet;

    // Add element-specific styles from _style data property
    const elementStyles = this._generateElementStyles();

    return [...baseStyles, ...customStyles, ...elementStyles];
  }

  _generateElementStyles() {
    const styles = [];

    // If cy is initialized, read live elements; otherwise fall back to options
    if (this.cy) {
      this.cy.elements().forEach(el => {
        const style = el.data('_style');
        if (style && Object.keys(style).length > 0) {
          const group = el.isNode() ? 'node' : 'edge';
          styles.push({
            selector: `${group}[id="${el.id()}"]`,
            style
          });
        }
      });
    } else {
      const elements = this.options.elements || { nodes: [], edges: [] };
      (elements.nodes || []).forEach(node => {
        if (node.data && node.data._style) {
          styles.push({ selector: `node[id="${node.data.id}"]`, style: node.data._style });
        }
      });
      (elements.edges || []).forEach(edge => {
        if (edge.data && edge.data._style) {
          styles.push({ selector: `edge[id="${edge.data.id}"]`, style: edge.data._style });
        }
      });
    }

    return styles;
  }

  _setupEvents() {
    // Emit change events for graph modifications
    this.cy.on('add remove data', (evt) => {
      this._emit('change', { type: evt.type, target: evt.target });
    });

    // Emit both 'select'/'unselect' (element-level) and 'selectionChange' (aggregate)
    this.cy.on('select', (evt) => {
      this._emit('select', { target: evt.target });
      this._emit('selectionChange', {
        type: 'select',
        target: evt.target,
        selected: this.cy.$(':selected').jsons()
      });
    });

    this.cy.on('unselect', (evt) => {
      this._emit('unselect', { target: evt.target });
      this._emit('selectionChange', {
        type: 'unselect',
        target: evt.target,
        selected: this.cy.$(':selected').jsons()
      });
    });

    // Drag undo: snapshot position before grab; commit to undo stack only if position changed
    this.cy.on('grabon', 'node', (evt) => {
      const node = evt.target;
      const pos = node.position();
      this._preGrabPos = { x: pos.x, y: pos.y };
      this._preGrabSnapshot = this.exportGraph();
    });

    this.cy.on('free', 'node', (evt) => {
      if (!this._preGrabSnapshot) return;
      const node = evt.target;
      const pos = node.position();
      if (pos.x !== this._preGrabPos.x || pos.y !== this._preGrabPos.y) {
        this._undoStack.push(this._preGrabSnapshot);
        if (this._undoStack.length > 50) this._undoStack.shift();
        this._redoStack.length = 0;
        this._emitHistoryChange();
      }
      this._preGrabSnapshot = null;
      this._preGrabPos = null;
    });
  }

  /**
   * Add a node to the graph
   * @param {Object} data - Node data (id, label, etc.)
   * @param {Object} [position] - Optional {x, y} position
   * @param {Object} [style] - Optional style overrides
   */
  addNode(data, position = null, style = {}) {
    this._pushUndo();
    const nodeData = { ...data };
    if (Object.keys(style).length > 0) {
      nodeData._style = { ...(nodeData._style || {}), ...style };
    }

    const entry = { group: 'nodes', data: nodeData };
    if (position && typeof position.x === 'number') {
      entry.position = position;
    }

    const node = this.cy.add(entry);

    this._updateStylesheet();
    this._emit('nodeAdded', { node: node.json() });
    return node.json();
  }

  /**
   * Add an edge to the graph
   */
  addEdge(sourceId, targetId, data = {}, style = {}) {
    this._pushUndo();
    const edgeData = {
      source: sourceId,
      target: targetId,
      ...data
    };

    if (Object.keys(style).length > 0) {
      edgeData._style = style;
    }

    const edge = this.cy.add({
      group: 'edges',
      data: edgeData
    });

    this._updateStylesheet();
    this._emit('edgeAdded', { edge: edge.json() });
    return edge.json();
  }

  /**
   * Remove an element by ID
   */
  removeElement(elementId) {
    this._pushUndo();
    const element = this.cy.getElementById(elementId);
    if (element.length > 0) {
      const json = element.json();
      element.remove();
      this._emit('elementRemoved', { element: json });
      return true;
    }
    return false;
  }

  /**
   * Update element data
   */
  updateElement(elementId, data, style = null) {
    this._pushUndo();
    const element = this.cy.getElementById(elementId);
    if (element.length === 0) {
      return false;
    }

    // Preserve existing _style if not updating style
    const currentData = element.data();
    const newData = { ...data };
    
    if (style !== null) {
      newData._style = { ...currentData._style, ...style };
    } else if (currentData._style) {
      newData._style = currentData._style;
    }

    element.data(newData);

    // Update stylesheet if style changed
    if (style !== null) {
      this._updateStylesheet();
    }

    this._emit('elementUpdated', { element: element.json() });
    return element.json();
  }

  /**
   * Update element style
   */
  updateElementStyle(elementId, style) {
    this._pushUndo();
    const element = this.cy.getElementById(elementId);
    if (element.length === 0) {
      return false;
    }

    const currentStyle = element.data('_style') || {};
    const newStyle = { ...currentStyle, ...style };
    
    element.data('_style', newStyle);
    this._updateStylesheet();

    this._emit('styleUpdated', { elementId, style: newStyle });
    return newStyle;
  }

  /**
   * Rebuild and update the stylesheet
   */
  _updateStylesheet() {
    const newStylesheet = this._buildStylesheet();
    this.cy.style().fromJson(newStylesheet).update();
  }

  /**
   * Run a layout algorithm. Accepts a layout name string or full options object.
   * Saves the chosen layout and options as lastLayout.
   */
  runLayout(layoutOptions) {
    this._pushUndo();
    if (typeof layoutOptions === 'string') layoutOptions = { name: layoutOptions };
    const { name, ...rest } = layoutOptions;
    this._lastLayout = { name, options: { ...rest } };
    const layout = this.cy.layout(layoutOptions);
    layout.run();
    this._emit('layoutRun', { options: layoutOptions });
  }

  /** Return the last used layout { name, options } */
  getLastLayout() {
    return { ...this._lastLayout, options: { ...this._lastLayout.options } };
  }

  /** Set the last layout without running it */
  setLastLayout(name, options = {}) {
    this._lastLayout = { name, options: { ...options } };
  }

  /**
   * Get available layout algorithms — built-ins always included; extensions only if registered.
   * Returns array of { name, label, params } objects.
   */
  getAvailableLayouts() {
    return Object.entries(LAYOUT_DEFINITIONS)
      .filter(([name, def]) => def.builtin || this._isLayoutRegistered(name))
      .map(([name, def]) => ({ name, label: def.label, params: def.params }));
  }

  /** Get parameter definitions for a single layout by name */
  getLayoutParams(name) {
    return LAYOUT_DEFINITIONS[name]?.params || [];
  }

  /** Check whether a layout extension is registered with Cytoscape */
  _isLayoutRegistered(name) {
    try {
      // cytoscape.prototype.layout creates a layout object; if name is unknown it throws
      const l = this.cy.layout({ name, stop: () => {} });
      if (l && typeof l.run === 'function') return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get all elements in Cytoscape JSON format
   */
  getElements() {
    return this.cy.json().elements;
  }

  /**
   * Load elements into the graph, replacing any existing elements
   */
  loadElements(elements) {
    // Normalize to flat array to avoid any format ambiguity
    const nodes = elements.nodes || (Array.isArray(elements) ? elements.filter(e => e.group === 'nodes' || !e.data?.source) : []);
    const edges = elements.edges || (Array.isArray(elements) ? elements.filter(e => e.group === 'edges' || e.data?.source) : []);

    this.cy.elements().remove();
    // Add nodes first, then edges (edges need source/target to exist)
    if (nodes.length) this.cy.add(nodes);
    if (edges.length) this.cy.add(edges);

    this._updateStylesheet();
    this._emit('elementsLoaded', { elements });
  }

  /**
   * Export graph data including elements, user stylesheet, and last layout.
   */
  exportGraph() {
    return {
      elements: this.cy.json().elements,
      userStylesheet: this.userStylesheet.map(rule => ({
        selector: rule.selector,
        style: { ...rule.style }
      })),
      lastLayout: this.getLastLayout(),
      version: '1.0.0'
    };
  }

  /**
   * Import graph data. If the loaded nodes have no position info, applies lastLayout (or cose).
   */
  importGraph(graphData) {
    if (graphData.elements) {
      this.loadElements(graphData.elements);
    }
    // Support both 'userStylesheet' (new format) and legacy 'stylesheet'
    const incoming = graphData.userStylesheet || graphData.stylesheet;
    if (incoming) {
      this.userStylesheet = incoming.map(rule => ({
        selector: rule.selector,
        style: { ...rule.style }
      }));
      this._updateStylesheet();
      this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    }
    // Restore last layout preference
    if (graphData.lastLayout) {
      this._lastLayout = {
        name: graphData.lastLayout.name || 'cose',
        options: { ...(graphData.lastLayout.options || {}) }
      };
      // Sync the panel UI if it exists
      if (this._layoutPanel) this._layoutPanelSync();
    }
    // Auto-run layout if nodes have no meaningful positions (all at origin)
    if (this._nodesNeedLayout()) {
      const { name, options } = this._lastLayout;
      this.runLayout({ name, ...options });
    }
    this._emit('graphImported', { graphData });
  }

  /** Return true if loaded nodes have no real position data (all at 0,0 or graph is empty) */
  _nodesNeedLayout() {
    const nodes = this.cy.nodes();
    if (!nodes.length) return false;
    return nodes.every(n => {
      const p = n.position();
      return p.x === 0 && p.y === 0;
    });
  }

  // ─── Stylesheet management API ────────────────────────────────────────────

  /** Return a copy of the user stylesheet */
  getStylesheet() {
    return this.userStylesheet.map(rule => ({
      selector: rule.selector,
      style: { ...rule.style }
    }));
  }

  /** Replace the entire user stylesheet */
  setStylesheet(rules) {
    this._pushUndo();
    this.userStylesheet = rules.map(rule => ({
      selector: rule.selector,
      style: { ...rule.style }
    }));
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
  }

  /** Append a new rule */
  addStyleRule(selector, style = {}) {
    this._pushUndo();
    this.userStylesheet.push({ selector, style: { ...style } });
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    return this.userStylesheet.length - 1; // return index
  }

  /** Update rule at index */
  updateStyleRule(index, selector, style) {
    this._pushUndo();
    if (index < 0 || index >= this.userStylesheet.length) return false;
    this.userStylesheet[index] = { selector, style: { ...style } };
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    return true;
  }

  /** Remove rule at index */
  removeStyleRule(index) {
    this._pushUndo();
    if (index < 0 || index >= this.userStylesheet.length) return false;
    this.userStylesheet.splice(index, 1);
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    return true;
  }

  /**
   * Get selected elements as Cytoscape element objects
   */
  getSelected() {
    return this.cy.$(':selected').toArray();
  }

  /**
   * Remove all currently selected elements (nodes + edges) in one undo step.
   */
  removeSelected() {
    const selected = this.cy.$(':selected');
    if (!selected.length) return 0;
    this._pushUndo();
    // Also remove edges connected to selected nodes (cy handles connected edges automatically)
    selected.forEach(el => {
      const json = el.json();
      this.cy.remove(el);
      this._emit('elementRemoved', { element: json });
    });
    this._updateStylesheet();
    return selected.length;
  }

  // ─── Undo / Redo ─────────────────────────────────────────────────────────

  _pushUndo() {
    if (this._restoringState) return;
    this._undoStack.push(this.exportGraph());
    if (this._undoStack.length > 50) this._undoStack.shift();
    this._redoStack.length = 0;
    this._emitHistoryChange();
  }

  _emitHistoryChange() {
    this._emit('historyChange', { canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  _restoreSnapshot(snapshot) {
    this._restoringState = true;
    try {
      this.loadElements(snapshot.elements || {});
      if (snapshot.userStylesheet) {
        this.userStylesheet = snapshot.userStylesheet.map(r => ({
          selector: r.selector,
          style: { ...r.style }
        }));
        this._updateStylesheet();
        this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
      }
      if (snapshot.lastLayout) {
        this._lastLayout = { name: snapshot.lastLayout.name, options: { ...(snapshot.lastLayout.options || {}) } };
        if (this._layoutPanel) this._layoutPanelSync();
      }
    } finally {
      this._restoringState = false;
    }
    this._emit('graphImported', { graphData: snapshot });
  }

  /** Undo the last action. Returns true if an undo was performed. */
  undo() {
    if (!this._undoStack.length) return false;
    this._redoStack.push(this.exportGraph());
    const snapshot = this._undoStack.pop();
    this._restoreSnapshot(snapshot);
    this._emitHistoryChange();
    return true;
  }

  /** Redo the last undone action. Returns true if a redo was performed. */
  redo() {
    if (!this._redoStack.length) return false;
    this._undoStack.push(this.exportGraph());
    const snapshot = this._redoStack.pop();
    this._restoreSnapshot(snapshot);
    this._emitHistoryChange();
    return true;
  }

  canUndo() { return this._undoStack.length > 0; }
  canRedo() { return this._redoStack.length > 0; }

  /**
   * Select elements by ID
   */
  selectElements(elementIds) {
    this.cy.elements().unselect();
    elementIds.forEach(id => {
      this.cy.getElementById(id).select();
    });
  }

  /**
   * Event system
   */
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
  }

  off(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      return;
    }
    const handlers = this.eventHandlers.get(eventName);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  _emit(eventName, data) {
    if (this.eventHandlers.has(eventName)) {
      this.eventHandlers.get(eventName).forEach(handler => {
        handler(data);
      });
    }
  }

  /**
   * Get the underlying Cytoscape instance
   */
  getCytoscape() {
    return this.cy;
  }

  /**
   * Destroy the editor
   */
  destroy() {
    this._destroyEdgeHandle();
    this._destroyLayoutPanel();
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
    this.eventHandlers.clear();
  }

  // ─── Node / Edge Type API ─────────────────────────────────────────────────

  /** Return node type definitions passed in options */
  getNodeTypes() {
    return this._nodeTypes.map(t => ({ ...t }));
  }

  /** Return edge type definitions passed in options */
  getEdgeTypes() {
    return this._edgeTypes.map(t => ({ ...t }));
  }

  /**
   * Add a node of a named type at an optional position.
   * If position is omitted, places it at the viewport centre with a small cascade offset.
   */
  addNodeOfType(typeId, position = null) {
    const type = this._nodeTypes.find(t => t.id === typeId);
    if (!type) return null;
    const nodeData = { id: _uniqueId('n'), label: type.label, ...type.data };
    if (!position) {
      const pan = this.cy.pan(), zoom = this.cy.zoom();
      const offset = this.cy.nodes().length * 15;
      position = {
        x: (this.container.offsetWidth  / 2 - pan.x) / zoom + (offset % 150) - 75,
        y: (this.container.offsetHeight / 2 - pan.y) / zoom + Math.floor(offset / 150) * 80
      };
    }
    return this.addNode(nodeData, position);
  }

  /**
   * Set the current edge type used by the built-in edge handle.
   * @param {string} typeId - id from edgeTypes, or null to reset to first type
   */
  setEdgeType(typeId) {
    const type = this._edgeTypes.find(t => t.id === typeId) || null;
    this.currentEdgeType = type;
    this._emit('edgeTypeChanged', { edgeType: this.currentEdgeType });
  }

  /** Return the currently active edge type */
  getEdgeType() {
    return this.currentEdgeType ? { ...this.currentEdgeType } : null;
  }

  // ─── Edge Handle (popper-based, uses cytoscape-edgehandles v4) ──────────

  _initEdgeHandle() {
    this._eh = this.cy.edgehandles({
      canConnect: (sourceNode, targetNode) => !sourceNode.same(targetNode),
      edgeParams: (sourceNode, targetNode) => ({
        data: {
          label: this.currentEdgeType?.label || '',
          ...(this.currentEdgeType?.data || {})
        }
      }),
      snap: false,
      noEdgeEventsInDraw: true,
      disableBrowserGestures: true
    });

    // DOM-handle state (manually positioned relative to node's rendered bounding box)
    this._ehHandleDiv = null;
    this._ehHandleNode = null;
    this._ehDrawing = false;

    const positionHandle = (node, div) => {
      const bb = node.renderedBoundingBox({ includeLabels: false });
      const containerRect = this.cy.container().getBoundingClientRect();
      const cx = containerRect.left + (bb.x1 + bb.x2) / 2;
      const bottom = containerRect.top + bb.y2;
      const w = 16, h = 8;
      div.style.left = `${cx - w / 2}px`;
      div.style.top  = `${bottom - h / 2}px`; // straddle the bottom edge
    };

    const removeHandle = () => {
      if (this._ehHandleDiv) {
        this._ehHandleDiv.removeEventListener('mousedown', this._ehStartDrawing);
        this._ehHandleDiv.parentNode?.removeChild(this._ehHandleDiv);
        this._ehHandleDiv = null;
      }
      this._ehHandleNode = null;
    };

    const setHandleOn = (node) => {
      if (this._ehDrawing) return;
      removeHandle();
      this._ehHandleNode = node;

      const div = document.createElement('div');
      div.className = 'boxes-eh-handle';
      div.style.cssText = [
        'position:fixed',
        'width:16px',
        'height:8px',
        'background:#3498db',
        'border-radius:0 0 16px 16px',
        'cursor:crosshair',
        'z-index:9999',
        'opacity:0.85',
        'pointer-events:auto'
      ].join(';');
      div.addEventListener('mousedown', this._ehStartDrawing);
      document.body.appendChild(div);
      this._ehHandleDiv = div;
      positionHandle(node, div);
    };

    this._ehStartDrawing = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._ehHandleNode) this._eh.start(this._ehHandleNode);
    };

    this._ehMouseoverHandler = (e) => setHandleOn(e.target);
    this._ehRemoveHandler = () => removeHandle();
    this._ehWindowMouseup = () => this._eh.stop();

    this.cy.on('mouseover', 'node', this._ehMouseoverHandler);
    this.cy.on('grab', 'node', this._ehRemoveHandler);
    this.cy.on('tap', (e) => { if (e.target === this.cy) removeHandle(); });
    this.cy.on('zoom pan', this._ehRemoveHandler);
    window.addEventListener('mouseup', this._ehWindowMouseup);

    // When an edge is completed, update styles and emit our events
    this._ehCompleteHandler = (event, sourceNode, targetNode, addedEdges) => {
      this._updateStylesheet();
      addedEdges.forEach(edge => {
        this._emit('edgeAdded', { edge: edge.json() });
      });
      this._emit('edgeHandleComplete', {
        sourceId: sourceNode.id(),
        targetId: targetNode.id(),
        edgeType: this.currentEdgeType
      });
    };

    this.cy.on('ehstart', () => { this._pushUndo(); this._ehDrawing = true; removeHandle(); });
    this.cy.on('ehstop', () => { this._ehDrawing = false; });
    this.cy.on('ehcomplete', this._ehCompleteHandler);
  }

  _destroyEdgeHandle() {
    if (this._ehCompleteHandler) {
      this.cy.off('ehcomplete', this._ehCompleteHandler);
      this._ehCompleteHandler = null;
    }
    if (this._ehMouseoverHandler) {
      this.cy.off('mouseover', this._ehMouseoverHandler);
      this._ehMouseoverHandler = null;
    }
    if (this._ehRemoveHandler) {
      this.cy.off('grab', this._ehRemoveHandler);
      this.cy.off('zoom pan', this._ehRemoveHandler);
      this._ehRemoveHandler = null;
    }
    if (this._ehWindowMouseup) {
      window.removeEventListener('mouseup', this._ehWindowMouseup);
      this._ehWindowMouseup = null;
    }
    // Clean up any lingering handle div
    if (this._ehHandleDiv) {
      this._ehHandleDiv.parentNode?.removeChild(this._ehHandleDiv);
      this._ehHandleDiv = null;
    }
    if (this._eh) {
      this._eh.destroy();
      this._eh = null;
    }
  }

  // ─── Layout Panel (renders into a caller-provided element) ──────────────

  /**
   * Render the layout configuration UI into `targetEl`.
   * Call this after creating the editor, passing any container element (e.g. a tab pane).
   * Can be called again after destroy+recreate to re-attach.
   */
  createLayoutPanel(targetEl) {
    if (!targetEl) return;
    this._destroyLayoutPanel(); // clean up any prior binding

    // Inject shared CSS once per page
    if (!document.getElementById('boxes-layout-panel-css')) {
      const style = document.createElement('style');
      style.id = 'boxes-layout-panel-css';
      style.textContent = `
.blp-panel { padding: 10px; font-size: 12px; }
.blp-algo-row { display:flex;align-items:center;gap:8px;margin-bottom:10px; }
.blp-algo-row label { font-weight:600;white-space:nowrap; }
.blp-algo-row select { flex:1; }
.blp-params { border-top:1px solid #eee;padding-top:8px;margin-bottom:8px; }
.blp-row {
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:6px;gap:8px;
}
.blp-row label { flex:0 0 auto;width:48%;font-size:11px;color:#555; }
.blp-row input, .blp-row select {
  flex:1;min-width:0;padding:2px 5px;border:1px solid #ccc;
  border-radius:3px;font-size:12px;box-sizing:border-box;
}
.blp-row input[type=checkbox] { flex:none;width:auto;align-self:center; }
.blp-run-btn {
  width:100%;padding:6px;background:#3498db;color:#fff;
  border:none;border-radius:4px;cursor:pointer;font-size:12px;
}
.blp-run-btn:hover { background:#2176ae; }
      `;
      document.head.appendChild(style);
    }

    this._layoutPanelTarget = targetEl;
    targetEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'blp-panel';

    // Algorithm selector row
    const algoRow = document.createElement('div');
    algoRow.className = 'blp-algo-row';
    const algoLabel = document.createElement('label');
    algoLabel.textContent = 'Algorithm';
    const algoSel = document.createElement('select');
    this.getAvailableLayouts().forEach(({ name, label }) => {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = label;
      algoSel.appendChild(opt);
    });
    algoSel.value = this._lastLayout.name;
    algoRow.appendChild(algoLabel);
    algoRow.appendChild(algoSel);
    wrap.appendChild(algoRow);

    // Parameters section
    const paramsDiv = document.createElement('div');
    paramsDiv.className = 'blp-params';
    wrap.appendChild(paramsDiv);

    // Run button
    const runBtn = document.createElement('button');
    runBtn.className = 'blp-run-btn';
    runBtn.textContent = '▶ Apply Layout';
    wrap.appendChild(runBtn);

    targetEl.appendChild(wrap);

    const renderParams = (name) => {
      const defs = this.getLayoutParams(name);
      const saved = name === this._lastLayout.name ? this._lastLayout.options : {};
      paramsDiv.innerHTML = '';
      defs.forEach(p => {
        const row = document.createElement('div');
        row.className = 'blp-row';
        const lbl = document.createElement('label');
        lbl.textContent = p.label;
        row.appendChild(lbl);
        let input;
        if (p.type === 'boolean') {
          input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = p.name in saved ? saved[p.name] : p.default;
        } else if (p.type === 'select') {
          input = document.createElement('select');
          p.options.forEach(o => {
            const oel = document.createElement('option');
            oel.value = o; oel.textContent = o;
            input.appendChild(oel);
          });
          input.value = p.name in saved ? saved[p.name] : p.default;
        } else {
          input = document.createElement('input');
          input.type = 'number';
          if (p.min !== undefined) input.min = p.min;
          if (p.max !== undefined) input.max = p.max;
          if (p.step !== undefined) input.step = p.step;
          input.value = p.name in saved ? saved[p.name] : p.default;
        }
        input.dataset.param = p.name;
        row.appendChild(input);
        paramsDiv.appendChild(row);
      });
    };

    renderParams(this._lastLayout.name);
    this._layoutPanelRenderParams = renderParams;

    algoSel.addEventListener('change', () => renderParams(algoSel.value));

    runBtn.addEventListener('click', () => {
      const name = algoSel.value;
      const defs = this.getLayoutParams(name);
      const opts = {};
      defs.forEach(p => {
        const el = paramsDiv.querySelector(`[data-param="${CSS.escape(p.name)}"]`);
        if (!el) return;
        if (p.type === 'boolean') opts[p.name] = el.checked;
        else if (p.type === 'number') {
          const v = parseFloat(el.value);
          if (!isNaN(v) && !(v === 0 && (p.name === 'rows' || p.name === 'cols' || p.name === 'radius'))) {
            opts[p.name] = v;
          }
        } else {
          opts[p.name] = el.value;
        }
      });
      this.runLayout({ name, ...opts });
    });

    // Store references for sync
    this._layoutPanelAlgoSel = algoSel;
    this._layoutPanelParamsDiv = paramsDiv;
  }

  /** Sync the panel UI to reflect the current _lastLayout (called after import) */
  _layoutPanelSync() {
    if (!this._layoutPanelAlgoSel) return;
    this._layoutPanelAlgoSel.value = this._lastLayout.name;
    if (this._layoutPanelRenderParams) this._layoutPanelRenderParams(this._lastLayout.name);
  }

  _destroyLayoutPanel() {
    this._layoutPanelTarget = null;
    this._layoutPanelAlgoSel = null;
    this._layoutPanelParamsDiv = null;
    this._layoutPanelRenderParams = null;
  }
}
