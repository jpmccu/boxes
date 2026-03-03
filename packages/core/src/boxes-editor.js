import cytoscape from 'cytoscape';

// Module-level counter ensures unique IDs even when elements are created in the same millisecond
let _idCounter = 0;
function _uniqueId(prefix) {
  return `${prefix}${Date.now()}_${++_idCounter}`;
}

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
  }

  /**
   * Add a node to the graph
   * @param {Object} data - Node data (id, label, etc.)
   * @param {Object} [position] - Optional {x, y} position
   * @param {Object} [style] - Optional style overrides
   */
  addNode(data, position = null, style = {}) {
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
   * Run a layout algorithm
   */
  runLayout(layoutOptions) {
    const layout = this.cy.layout(layoutOptions);
    layout.run();
    this._emit('layoutRun', { options: layoutOptions });
  }

  /**
   * Get available layout algorithms
   */
  getAvailableLayouts() {
    return ['preset', 'random', 'grid', 'circle', 'concentric', 'breadthfirst', 'cose'];
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
   * Export graph data including elements and user stylesheet
   */
  exportGraph() {
    return {
      elements: this.cy.json().elements,
      // Save only the user-editable stylesheet, not base styles or element-specific rules
      userStylesheet: this.userStylesheet.map(rule => ({
        selector: rule.selector,
        style: { ...rule.style }
      })),
      version: '1.0.0'
    };
  }

  /**
   * Import graph data
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
    this._emit('graphImported', { graphData });
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
    this.userStylesheet = rules.map(rule => ({
      selector: rule.selector,
      style: { ...rule.style }
    }));
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
  }

  /** Append a new rule */
  addStyleRule(selector, style = {}) {
    this.userStylesheet.push({ selector, style: { ...style } });
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    return this.userStylesheet.length - 1; // return index
  }

  /** Update rule at index */
  updateStyleRule(index, selector, style) {
    if (index < 0 || index >= this.userStylesheet.length) return false;
    this.userStylesheet[index] = { selector, style: { ...style } };
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    return true;
  }

  /** Remove rule at index */
  removeStyleRule(index) {
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

  // ─── Edge Handle (built-in half-circle drag-to-connect) ──────────────────

  _initEdgeHandle() {
    const iid = this._instanceId;

    // Half-circle handle element (shown at bottom of hovered node)
    this._ehHandle = document.createElement('div');
    this._ehHandle.style.cssText =
      'position:fixed;width:14px;height:7px;background:#3498db;' +
      'border-radius:0 0 14px 14px;cursor:crosshair;display:none;' +
      'z-index:100001;box-shadow:0 2px 6px rgba(52,152,219,.5);' +
      'transition:background .1s';

    // Full-page transparent overlay during drag (captures mouse events)
    this._ehDragOverlay = document.createElement('div');
    this._ehDragOverlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'z-index:100002;display:none;cursor:crosshair';

    // Rubber-band SVG
    const NS = 'http://www.w3.org/2000/svg';
    this._ehSvg = document.createElementNS(NS, 'svg');
    this._ehSvg.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'pointer-events:none;display:none;z-index:100003';
    const defs   = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', `boxes-arrow-${iid}`);
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const mPath = document.createElementNS(NS, 'path');
    mPath.setAttribute('d', 'M0,0 L8,3 L0,6 Z');
    mPath.setAttribute('fill', '#3498db');
    marker.appendChild(mPath);
    defs.appendChild(marker);
    this._ehSvg.appendChild(defs);
    this._ehLine = document.createElementNS(NS, 'line');
    this._ehLine.setAttribute('stroke', '#3498db');
    this._ehLine.setAttribute('stroke-width', '2');
    this._ehLine.setAttribute('stroke-dasharray', '6,3');
    this._ehLine.setAttribute('marker-end', `url(#boxes-arrow-${iid})`);
    this._ehSvg.appendChild(this._ehLine);

    document.body.appendChild(this._ehHandle);
    document.body.appendChild(this._ehDragOverlay);
    document.body.appendChild(this._ehSvg);

    this._ehDragState   = null;
    this._ehSourceNode  = null;
    this._ehHovered     = false;

    // Cytoscape event handlers (stored for cleanup)
    this._ehOnMouseover = (evt) => this._ehShow(evt.target);
    this._ehOnMouseout  = () => { setTimeout(() => { if (!this._ehHovered) this._ehHide(); }, 80); };
    this._ehOnViewport  = () => { if (!this._ehDragState) this._ehHide(); };
    this._ehOnGrab      = () => this._ehHide(true);
    this.cy.on('mouseover', 'node', this._ehOnMouseover);
    this.cy.on('mouseout',  'node', this._ehOnMouseout);
    this.cy.on('viewport',         this._ehOnViewport);
    this.cy.on('grab',      'node', this._ehOnGrab);

    this._ehHandle.addEventListener('mouseenter', () => { this._ehHovered = true; });
    this._ehHandle.addEventListener('mouseleave', () => {
      this._ehHovered = false;
      if (!this._ehDragState) this._ehHide();
    });

    this._ehHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (!this._ehSourceNode) return;
      this._ehDragState = { sourceNode: this._ehSourceNode };
      this.cy.userPanningEnabled(false);
      this.cy.userZoomingEnabled(false);
      this._ehDragOverlay.style.display = 'block';
      this._ehSvg.style.display = 'block';
      const pt = this._ehNodeBottom(this._ehSourceNode);
      this._ehLine.setAttribute('x1', pt.x); this._ehLine.setAttribute('y1', pt.y);
      this._ehLine.setAttribute('x2', e.clientX); this._ehLine.setAttribute('y2', e.clientY);
    });

    this._ehDragOverlay.addEventListener('mousemove', (e) => {
      if (!this._ehDragState) return;
      const pt = this._ehNodeBottom(this._ehDragState.sourceNode);
      this._ehLine.setAttribute('x1', pt.x); this._ehLine.setAttribute('y1', pt.y);
      this._ehLine.setAttribute('x2', e.clientX); this._ehLine.setAttribute('y2', e.clientY);
    });

    this._ehDragOverlay.addEventListener('mouseup', (e) => {
      this._ehDragOverlay.style.display = 'none';
      this._ehSvg.style.display = 'none';
      if (!this._ehDragState) return;
      const target = this._ehNodeAt(e.clientX, e.clientY);
      if (target && target.id() !== this._ehDragState.sourceNode.id()) {
        const edgeData = { label: '', ...(this.currentEdgeType?.data || {}) };
        this.addEdge(this._ehDragState.sourceNode.id(), target.id(), edgeData);
        this._emit('edgeHandleComplete', {
          sourceId: this._ehDragState.sourceNode.id(),
          targetId: target.id(),
          edgeType: this.currentEdgeType
        });
      }
      this._ehDragState = null;
      this.cy.userPanningEnabled(true);
      this.cy.userZoomingEnabled(true);
      this._ehHide();
    });
  }

  _ehShow(node) {
    this._ehSourceNode = node;
    const pt = this._ehNodeBottom(node);
    this._ehHandle.style.left = (pt.x - 7) + 'px';
    this._ehHandle.style.top  = (pt.y - 3) + 'px';
    this._ehHandle.style.display = 'block';
  }

  _ehHide(force = false) {
    if (!force && this._ehDragState) return;
    if (this._ehHandle) this._ehHandle.style.display = 'none';
    this._ehSourceNode = null;
  }

  _ehNodeBottom(node) {
    const rect = this.cy.container().getBoundingClientRect();
    const bb   = node.renderedBoundingBox({ includeOverlays: false });
    return { x: rect.left + (bb.x1 + bb.x2) / 2, y: rect.top + bb.y2 };
  }

  _ehNodeAt(clientX, clientY) {
    const rect  = this.cy.container().getBoundingClientRect();
    const pan   = this.cy.pan(), zoom = this.cy.zoom();
    const gx    = (clientX - rect.left - pan.x) / zoom;
    const gy    = (clientY - rect.top  - pan.y) / zoom;
    const hits  = this.cy.nodes().filter(n => {
      const bb = n.boundingBox({ includeOverlays: false });
      return gx >= bb.x1 && gx <= bb.x2 && gy >= bb.y1 && gy <= bb.y2;
    });
    return hits.length ? hits[0] : null;
  }

  _destroyEdgeHandle() {
    if (this.cy && this._ehOnMouseover) {
      this.cy.off('mouseover', 'node', this._ehOnMouseover);
      this.cy.off('mouseout',  'node', this._ehOnMouseout);
      this.cy.off('viewport',         this._ehOnViewport);
      this.cy.off('grab',      'node', this._ehOnGrab);
    }
    [this._ehHandle, this._ehDragOverlay, this._ehSvg].forEach(el => { if (el) el.remove(); });
    this._ehHandle = this._ehDragOverlay = this._ehSvg = this._ehLine = null;
  }
}
