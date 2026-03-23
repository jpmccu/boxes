import cytoscape from 'cytoscape';
import cytoscapeEdgehandles from 'cytoscape-edgehandles';
import cytoscapeDagre from 'cytoscape-dagre';
import cytoscapeCola from 'cytoscape-cola';
import cytoscapeKlay from 'cytoscape-klay';
import cytoscapeEuler from 'cytoscape-euler';

// Register Cytoscape extensions once at module load (idempotent)
cytoscape.use(cytoscapeEdgehandles);
cytoscape.use(cytoscapeDagre);
cytoscape.use(cytoscapeCola);
cytoscape.use(cytoscapeKlay);
cytoscape.use(cytoscapeEuler);

// cytoscape-pdf-export is large (bundles PDFKit with fonts).
// It is registered lazily on first use so it splits into a separate async chunk.
let _pdfPluginRegistered = false;

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
    if (!container) throw new Error('Container element is required');
    this.container = container;
    this.options = { layout: options.layout || { name: 'preset' }, ...options };
    this._instanceId = Math.random().toString(36).slice(2, 9);
    this.userStylesheet = (options.style || []).map(rule => ({ selector: rule.selector, style: { ...rule.style } }));
    this._nodeTypes = (options.nodeTypes || []).map(t => ({ ...t }));
    this._edgeTypes = (options.edgeTypes || []).map(t => ({ ...t }));
    this.currentEdgeType = this._edgeTypes[0] || null;
    this.cy = null;
    this.eventHandlers = new Map();
    this._lastLayout = { name: 'dagre', options: { rankdir: 'LR', ranksep: 60, nodesep: 30 } };
    this._undoStack = [];
    this._redoStack = [];
    this._restoringState = false;
    this._preGrabSnapshot = null;
    this._clipboard = null;   // { nodes: [...json], edges: [...json] }
    this._pasteOffset = 0;    // increments each paste so repeated pastes cascade
    this._currentNodeTypeId = this._nodeTypes[0]?.id || null;
    this._selectedElement = null;
    this._ctxTarget = null;
    this._ctxPosition = null;
    this.context = { ...(options.context || {}) };

    this._init();

    if (options.edgeHandle !== false && typeof document !== 'undefined' && document.body) {
      this._initEdgeHandle();
    }
  }

  _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  _injectCSS() {
    if (document.getElementById('bxe-styles')) return;
    const style = document.createElement('style');
    style.id = 'bxe-styles';
    style.textContent = `
.bxe-wrap { display:flex; width:100%; height:100%; overflow:hidden; font-family:system-ui,sans-serif; font-size:13px; }
.bxe-wrap *, .bxe-wrap *::before, .bxe-wrap *::after { box-sizing:border-box; }
.bxe-canvas-wrap { flex:1; min-width:0; height:100%; position:relative; overflow:hidden; }
.bxe-canvas { width:100%; height:100%; }
.bxe-panzoom { position:absolute; bottom:12px; right:12px; display:flex; flex-direction:column; gap:3px; z-index:10; }
.bxe-pz-btn { width:28px; height:28px; background:#fff; border:1px solid #aaa; border-radius:4px; cursor:pointer; font-size:15px; font-weight:bold; line-height:1; padding:0; color:#444; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,.15); }
.bxe-pz-btn:hover { background:#f0f0f0; border-color:#888; }
.bxe-pz-btn:active { background:#e0e0e0; }
.bxe-sidebar { width:325px; min-width:160px; height:100%; display:flex; flex-direction:column; background:#f8f9fa; border-left:1px solid #dee2e6; overflow:hidden; transition:width .15s; }
.bxe-sidebar.bxe-collapsed { width:0 !important; min-width:0 !important; }
.bxe-resize-handle { width:4px; background:transparent; cursor:col-resize; flex-shrink:0; transition:background .15s; }
.bxe-resize-handle:hover, .bxe-resize-handle.dragging { background:#c0d4f5; }
.bxe-panel-toggle { position:absolute; right:0; top:50%; transform:translateY(-50%); width:16px; height:44px; background:#e8eaed; border:1px solid #bbb; border-right:none; border-radius:4px 0 0 4px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; color:#555; z-index:5; line-height:1; padding:0; }
.bxe-panel-toggle:hover { background:#d0d5dc; color:#222; }
.bxe-toolbar { display:flex; gap:4px; padding:4px 8px; background:#fff; border-bottom:1px solid #dee2e6; flex-shrink:0; }
.bxe-toolbar button { padding:2px 8px; font-size:13px; cursor:pointer; background:#fff; border:1px solid #ccc; border-radius:3px; }
.bxe-toolbar button:hover:not(:disabled) { background:#f0f0f0; }
.bxe-toolbar button:disabled { opacity:.4; cursor:default; }
.bxe-tab-nav { display:flex; background:#fff; border-bottom:1px solid #dee2e6; flex-shrink:0; }
.bxe-tab-btn { flex:1; padding:6px 4px; font-size:16px; cursor:pointer; background:none; border:none; border-bottom:2px solid transparent; color:#666; }
.bxe-tab-btn:hover { background:#f0f0f0; }
.bxe-tab-btn.active { color:#0d6efd; border-bottom-color:#0d6efd; background:#f8f9fa; }
.bxe-tab-body { flex:1; min-height:0; overflow-y:auto; }
.bxe-pane { display:none; padding:10px; }
.bxe-pane.active { display:block; }
.bxe-pane-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#888; margin-bottom:8px; }
.bxe-pane-label { font-size:12px; font-weight:600; color:#666; margin-bottom:4px; }
.bxe-pane-label small { font-weight:normal; color:#999; }
.bxe-palette { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
.bxe-palette-item { display:flex; align-items:center; gap:8px; padding:5px 8px; border:1px solid #dee2e6; border-radius:5px; cursor:pointer; background:#fff; }
.bxe-palette-item:hover { background:#e9f0ff; border-color:#90b8f8; }
.bxe-palette-item.selected { background:#dce8ff; border-color:#4d90fe; }
.bxe-palette-label { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bxe-node-swatch { width:20px; height:20px; border:2px solid #999; flex-shrink:0; }
.bxe-prop-group { margin-bottom:8px; }
.bxe-prop-group > label { display:block; font-size:12px; font-weight:600; color:#666; margin-bottom:2px; }
.bxe-input { width:100%; padding:3px 5px; border:1px solid #ccc; border-radius:3px; font-size:12px; }
.bxe-input[readonly] { background:#f5f5f5; color:#666; }
.bxe-prop-table-wrap { border:1px solid #dee2e6; border-radius:4px; overflow:hidden; }
.bxe-prop-table { width:100%; border-collapse:collapse; font-size:12px; }
.bxe-prop-table td { padding:2px 4px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
.bxe-prop-table tr:last-child td { border-bottom:none; }
.bxe-cell-input { width:100%; border:none; outline:none; font-size:12px; background:transparent; padding:1px 2px; min-height:22px; font-family:inherit; }
.bxe-cell-input:focus { background:#f0f8ff; }
.bxe-cell-textarea { resize:vertical; }
.bxe-btn-del { background:none; border:none; color:#999; cursor:pointer; font-size:14px; line-height:1; padding:0 2px; }
.bxe-btn-del:hover { color:#dc3545; }
.bxe-btn-add { display:block; width:100%; margin-top:4px; padding:3px 6px; background:#fff; border:1px solid #ccc; border-radius:3px; font-size:12px; cursor:pointer; text-align:center; }
.bxe-btn-add:hover { background:#f0f0f0; }
.bxe-btn-danger { padding:4px 10px; background:#fff; border:1px solid #dc3545; color:#dc3545; border-radius:3px; cursor:pointer; font-size:12px; }
.bxe-btn-danger:hover { background:#dc3545; color:#fff; }
.bxe-style-rule { margin-bottom:8px; border:1px solid #dee2e6; border-radius:5px; overflow:hidden; }
.bxe-style-rule-header { display:flex; align-items:center; gap:4px; background:#e9ecef; padding:4px 6px; }
.bxe-style-rule-header input { flex:1; border:1px solid #ced4da; border-radius:3px; padding:2px 5px; font-size:12px; font-family:monospace; }
.bxe-style-rule-props { padding:5px 6px; }
.bxe-style-prop-row { display:flex; gap:4px; margin-bottom:3px; align-items:center; }
.bxe-style-prop-row input { flex:1; border:1px solid #e0e0e0; border-radius:3px; padding:2px 4px; font-size:12px; }
.bxe-btn-link { background:none; border:none; color:#0d6efd; cursor:pointer; font-size:12px; padding:2px 0; }
.bxe-btn-link:hover { text-decoration:underline; }
.bxe-empty { color:#999; font-size:12px; text-align:center; padding:12px 0; }
.bxe-empty-small { color:#999; font-size:12px; padding:2px; }
.bxe-ctx-menu { position:fixed; z-index:99999; background:#fff; border:1px solid #dee2e6; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,.15); min-width:160px; overflow:hidden; }
.bxe-ctx-item { padding:7px 14px; cursor:pointer; font-size:13px; color:#333; }
.bxe-ctx-item:hover { background:#f0f4ff; }
.bxe-ctx-item.danger { color:#dc3545; }
.bxe-ctx-item.danger:hover { background:#fff0f0; }
.bxe-ctx-sep { height:1px; background:#dee2e6; }
.bxe-ctx-row { display:flex; align-items:flex-start; gap:3px; padding:3px 0; border-bottom:1px solid #f0f0f0; }
.bxe-ctx-key { width:80px; flex-shrink:0; font-family:monospace; }
.bxe-ctx-val { flex:1; min-width:0; font-family:monospace; font-size:12px; }
.bxe-ctx-colon { color:#999; font-size:12px; flex-shrink:0; padding-top:3px; }
.bxe-ctx-obj-val { resize:vertical; min-height:44px; line-height:1.4; white-space:pre; overflow-x:auto; }
.bxe-ctx-obj-val.bxe-ctx-invalid { border:1px solid #e74c3c !important; background:#fff5f5 !important; }
.bxe-ctx-type-badge { font-size:12px; color:#888; font-family:monospace; letter-spacing:0; flex-shrink:0; padding-top:4px; }
.bxe-ctx-addbtns { display:flex; gap:4px; flex-wrap:wrap; padding-top:4px; }
.bxe-ctx-addbtns .bxe-btn-add { flex:1; }
.bxe-label-editor { position:absolute; z-index:20; background:rgba(255,255,255,.95); border:2px solid #4d90fe; border-radius:4px; padding:2px 6px; font-size:13px; font-family:inherit; outline:none; box-sizing:border-box; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,.2); line-height:1.4; }
`;
    document.head.appendChild(style);
  }

  _createUI() {
    this.container.style.cssText = 'display:flex;overflow:hidden;width:100%;height:100%;';

    // Canvas wrapper holds both the cy container and the panzoom overlay.
    this._canvasWrap = document.createElement('div');
    this._canvasWrap.className = 'bxe-canvas-wrap';
    this._canvasWrap.style.position = 'relative';
    this.container.appendChild(this._canvasWrap);

    this._canvasDiv = document.createElement('div');
    this._canvasDiv.className = 'bxe-canvas';
    this._canvasWrap.appendChild(this._canvasDiv);

    // Toggle button floats on the right edge of the canvas
    this._panelToggleBtn = document.createElement('button');
    this._panelToggleBtn.className = 'bxe-panel-toggle';
    this._panelToggleBtn.title = 'Hide panel';
    this._panelToggleBtn.textContent = '›';
    this._panelToggleBtn.addEventListener('click', () => this._toggleSidebar());
    this._canvasWrap.appendChild(this._panelToggleBtn);

    // Resize handle sits between canvas-wrap and sidebar
    this._resizeHandle = document.createElement('div');
    this._resizeHandle.className = 'bxe-resize-handle';
    this.container.appendChild(this._resizeHandle);

    this._sidebarEl = document.createElement('div');
    this._sidebarEl.className = 'bxe-sidebar';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'bxe-toolbar';
    this._undoBtn = document.createElement('button');
    this._undoBtn.title = 'Undo (Ctrl+Z)';
    this._undoBtn.textContent = '\u21A9';
    this._undoBtn.disabled = true;
    this._undoBtn.addEventListener('click', () => this.undo());
    this._redoBtn = document.createElement('button');
    this._redoBtn.title = 'Redo (Ctrl+Y)';
    this._redoBtn.textContent = '\u21AA';
    this._redoBtn.disabled = true;
    this._redoBtn.addEventListener('click', () => this.redo());
    toolbar.appendChild(this._undoBtn);
    toolbar.appendChild(this._redoBtn);
    this._sidebarEl.appendChild(toolbar);

    // Tab nav
    const tabNav = document.createElement('div');
    tabNav.className = 'bxe-tab-nav';
    const tabDefs = [
      { id: 'palette', icon: '\u2726', title: 'Palette' },
      { id: 'properties', icon: '\u2630', title: 'Properties' },
      { id: 'stylesheet', icon: '\u270F', title: 'Stylesheet' },
      { id: 'layout', icon: '\u2295', title: 'Layout' },
      { id: 'context', icon: '@', title: 'Context' }
    ];
    this._tabBtns = {};
    tabDefs.forEach(({ id, icon, title }) => {
      const btn = document.createElement('button');
      btn.className = 'bxe-tab-btn';
      btn.textContent = icon;
      btn.title = title;
      btn.dataset.tab = id;
      btn.addEventListener('click', () => this._switchPane(id));
      this._tabBtns[id] = btn;
      tabNav.appendChild(btn);
    });
    this._sidebarEl.appendChild(tabNav);

    // Tab body
    const tabBody = document.createElement('div');
    tabBody.className = 'bxe-tab-body';
    this._panes = {};

    // ── Palette pane ──
    const palettePane = document.createElement('div');
    palettePane.className = 'bxe-pane';
    palettePane.dataset.pane = 'palette';
    const palTitle = document.createElement('div');
    palTitle.className = 'bxe-pane-title';
    palTitle.textContent = 'Palette';
    palettePane.appendChild(palTitle);
    const nodeLabel = document.createElement('div');
    nodeLabel.className = 'bxe-pane-label';
    nodeLabel.innerHTML = 'Node type <small>(double-click canvas to add)</small>';
    palettePane.appendChild(nodeLabel);
    this._nodePaletteEl = document.createElement('div');
    palettePane.appendChild(this._nodePaletteEl);
    const edgeLabel = document.createElement('div');
    edgeLabel.className = 'bxe-pane-label';
    edgeLabel.innerHTML = 'Edge type <small>(drag handle to connect)</small>';
    palettePane.appendChild(edgeLabel);
    this._edgePaletteEl = document.createElement('div');
    palettePane.appendChild(this._edgePaletteEl);
    this._nodePaletteEl.addEventListener('click', (e) => {
      const item = e.target.closest('.bxe-palette-item');
      if (item) this._selectNodeType(item.dataset.typeId);
    });
    this._edgePaletteEl.addEventListener('click', (e) => {
      const item = e.target.closest('.bxe-palette-item');
      if (item) this.setEdgeType(item.dataset.typeId);
    });
    this._panes['palette'] = palettePane;

    // ── Properties pane ──
    const propsPane = document.createElement('div');
    propsPane.className = 'bxe-pane';
    propsPane.dataset.pane = 'properties';
    const propsTitle = document.createElement('div');
    propsTitle.className = 'bxe-pane-title';
    propsTitle.textContent = 'Properties';
    propsPane.appendChild(propsTitle);
    this._propsContentEl = document.createElement('div');
    propsPane.appendChild(this._propsContentEl);
    propsPane.addEventListener('input', (e) => this._handlePropertiesEvent(e));
    propsPane.addEventListener('change', (e) => this._handlePropertiesEvent(e));
    propsPane.addEventListener('blur', (e) => this._handlePropertiesEvent(e), true);
    propsPane.addEventListener('click', (e) => this._handlePropertiesEvent(e));
    this._panes['properties'] = propsPane;

    // ── Stylesheet pane ──
    const stylePane = document.createElement('div');
    stylePane.className = 'bxe-pane';
    stylePane.dataset.pane = 'stylesheet';
    const styleTitle = document.createElement('div');
    styleTitle.className = 'bxe-pane-title';
    styleTitle.textContent = 'Stylesheet';
    stylePane.appendChild(styleTitle);
    this._stylesheetRulesEl = document.createElement('div');
    stylePane.appendChild(this._stylesheetRulesEl);
    stylePane.addEventListener('change', (e) => this._handleStylesheetEvent(e));
    stylePane.addEventListener('click', (e) => this._handleStylesheetEvent(e));
    stylePane.addEventListener('focusout', (e) => this._handleStylesheetEvent(e));
    this._panes['stylesheet'] = stylePane;

    // ── Layout pane ──
    const layoutPane = document.createElement('div');
    layoutPane.className = 'bxe-pane';
    layoutPane.dataset.pane = 'layout';
    const layoutTitle = document.createElement('div');
    layoutTitle.className = 'bxe-pane-title';
    layoutTitle.textContent = 'Layout';
    layoutPane.appendChild(layoutTitle);
    this._layoutPaneContentEl = document.createElement('div');
    layoutPane.appendChild(this._layoutPaneContentEl);
    this._panes['layout'] = layoutPane;

    // ── Context pane ──
    const contextPane = document.createElement('div');
    contextPane.className = 'bxe-pane';
    contextPane.dataset.pane = 'context';
    const ctxTitle = document.createElement('div');
    ctxTitle.className = 'bxe-pane-title';
    ctxTitle.textContent = 'JSON-LD Context';
    contextPane.appendChild(ctxTitle);
    this._contextEntriesEl = document.createElement('div');
    contextPane.appendChild(this._contextEntriesEl);
    contextPane.addEventListener('change', (e) => this._handleContextEvent(e));
    contextPane.addEventListener('click', (e) => this._handleContextEvent(e));
    contextPane.addEventListener('focusout', (e) => this._handleContextEvent(e));
    this._panes['context'] = contextPane;

    [palettePane, propsPane, stylePane, layoutPane, contextPane].forEach(p => tabBody.appendChild(p));
    this._sidebarEl.appendChild(tabBody);
    this.container.appendChild(this._sidebarEl);

    this._sidebarCollapsed = false;
    this._sidebarStoredWidth = 325;
    this._initSidebarResize();

    // Context menu (appended to body)
    this._ctxMenu = document.createElement('div');
    this._ctxMenu.className = 'bxe-ctx-menu';
    this._ctxMenu.style.display = 'none';
    this._ctxMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.bxe-ctx-item');
      if (!item) return;
      const action = item.dataset.action;
      if (action === 'edit-props') {
        if (this._ctxTarget) { this._refreshProperties(this._ctxTarget); this._switchPane('properties'); }
      } else if (action === 'duplicate') {
        if (this._ctxTarget?.isNode()) {
          const data = { ...this._ctxTarget.data() };
          delete data.id;
          data.label = (data.label || 'Node') + ' (copy)';
          const pos = this._ctxTarget.position();
          this.addNode(data, { x: pos.x + 50, y: pos.y + 50 });
        }
      } else if (action === 'cut') {
        this.cut();
      } else if (action === 'copy') {
        this.copy();
      } else if (action === 'paste') {
        this.paste();
      } else if (action === 'delete') {
        const numSel = this.cy.$(':selected').length;
        if (numSel > 0) this.removeSelected();
        else if (this._ctxTarget) this.removeElement(this._ctxTarget.id());
        this._clearProperties();
      } else if (action === 'add-node-here') {
        if (this._ctxPosition) this._addNodeAtPosition(this._ctxPosition);
      }
      this._hideContextMenu();
    });
    document.body.appendChild(this._ctxMenu);

    // Keyboard handler
    this._keydownHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); this.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); this.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault(); this.copy();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault(); this.cut();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault(); this.paste();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          this.removeSelected();
        }
      }
    };
    document.addEventListener('keydown', this._keydownHandler);

    this._switchPane('palette');
    this._renderContextPane();
  }

  _initSidebarResize() {
    const handle = this._resizeHandle;
    const sidebar = this._sidebarEl;
    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
      if (this._sidebarCollapsed) return;
      dragging = true;
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      handle.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const delta = startX - e.clientX; // dragging left = wider
      const newWidth = Math.max(160, Math.min(800, startWidth + delta));
      sidebar.style.width = newWidth + 'px';
      this._sidebarStoredWidth = newWidth;
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
    });
  }

  _toggleSidebar() {
    const sidebar = this._sidebarEl;
    const handle = this._resizeHandle;
    const btn = this._panelToggleBtn;

    if (this._sidebarCollapsed) {
      sidebar.style.width = this._sidebarStoredWidth + 'px';
      sidebar.classList.remove('bxe-collapsed');
      handle.style.display = '';
      btn.textContent = '›';
      btn.title = 'Hide panel';
      this._sidebarCollapsed = false;
    } else {
      this._sidebarStoredWidth = sidebar.offsetWidth || this._sidebarStoredWidth;
      sidebar.classList.add('bxe-collapsed');
      handle.style.display = 'none';
      btn.textContent = '‹';
      btn.title = 'Show panel';
      this._sidebarCollapsed = true;
    }
  }

  _startInlineLabelEdit(ele) {
    this._cancelInlineLabelEdit();

    const isNode = ele.isNode();
    const currentLabel = ele.data('label') || '';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentLabel;
    input.className = 'bxe-label-editor';

    if (isNode) {
      const bb = ele.renderedBoundingBox({ includeLabels: false });
      input.style.left   = bb.x1 + 'px';
      input.style.top    = (bb.y1 + bb.h / 2 - 14) + 'px';
      input.style.width  = Math.max(bb.w, 80) + 'px';
    } else {
      const mp = ele.renderedMidpoint();
      const w = 140;
      input.style.left = (mp.x - w / 2) + 'px';
      input.style.top  = (mp.y - 14) + 'px';
      input.style.width = w + 'px';
    }

    const commit = () => {
      const newLabel = input.value;
      if (newLabel !== currentLabel) {
        this.updateElement(ele.id(), { label: newLabel });
        if (this._selectedElement && this._selectedElement.id() === ele.id()) {
          this._refreshProperties(ele);
        }
      }
      input.remove();
      this._labelEditorInput = null;
    };

    const cancel = () => {
      input.remove();
      this._labelEditorInput = null;
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); e.stopPropagation(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
      else e.stopPropagation(); // don't let Delete/Backspace trigger graph shortcuts
    });
    // Prevent tap events from reaching Cytoscape while editing
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('click',     (e) => e.stopPropagation());

    this._labelEditorInput = input;
    this._canvasWrap.appendChild(input);
    input.focus();
    input.select();
  }

  _cancelInlineLabelEdit() {
    if (this._labelEditorInput) {
      this._labelEditorInput.remove();
      this._labelEditorInput = null;
    }
  }

  _switchPane(name) {
    Object.entries(this._panes).forEach(([id, pane]) => {
      pane.classList.toggle('active', id === name);
    });
    Object.entries(this._tabBtns).forEach(([id, btn]) => {
      btn.classList.toggle('active', id === name);
    });
  }

  _renderPalette() {
    const nodeTypes = this._nodeTypes;
    const edgeTypes = this._edgeTypes;
    if (!this._nodePaletteEl) return;

    if (!nodeTypes.length) {
      this._nodePaletteEl.innerHTML = '<div class="bxe-empty-small">No node types defined</div>';
    } else {
      this._nodePaletteEl.innerHTML = '';
      const palette = document.createElement('div');
      palette.className = 'bxe-palette';
      nodeTypes.forEach((type, i) => {
        const radius = type.shape === 'ellipse' ? '50%' : type.shape === 'roundrectangle' ? '5px' : '2px';
        const bg = type.color || '#e0e0e0';
        const border = type.borderColor || '#999';
        const item = document.createElement('div');
        item.className = 'bxe-palette-item' + (i === 0 ? ' selected' : '');
        item.dataset.typeId = type.id;
        const swatch = document.createElement('div');
        swatch.className = 'bxe-node-swatch';
        swatch.style.cssText = `background:${bg};border-color:${border};border-radius:${radius}`;
        const label = document.createElement('span');
        label.className = 'bxe-palette-label';
        label.textContent = type.label;
        item.appendChild(swatch);
        item.appendChild(label);
        palette.appendChild(item);
      });
      this._nodePaletteEl.appendChild(palette);
    }

    if (!edgeTypes.length) {
      this._edgePaletteEl.innerHTML = '<div class="bxe-empty-small">No edge types defined</div>';
    } else {
      this._edgePaletteEl.innerHTML = '';
      const palette = document.createElement('div');
      palette.className = 'bxe-palette';
      edgeTypes.forEach((type, i) => {
        const color = type.color || '#666666';
        const dashArray = type.lineStyle === 'dashed' ? '6,3' : type.lineStyle === 'dotted' ? '2,3' : 'none';
        const markerId = `bxe-arr-${this._instanceId}-${String(type.id).replace(/[^a-zA-Z0-9]/g, '_')}`;
        const item = document.createElement('div');
        item.className = 'bxe-palette-item' + (i === 0 ? ' selected' : '');
        item.dataset.typeId = type.id;
        const svgLine = dashArray === 'none'
          ? `<line x1="4" y1="11" x2="34" y2="11" stroke="${color}" stroke-width="2" marker-end="url(#${markerId})"/>`
          : `<line x1="4" y1="11" x2="34" y2="11" stroke="${color}" stroke-width="2" stroke-dasharray="${dashArray}" marker-end="url(#${markerId})"/>`;
        item.innerHTML = `<svg width="44" height="22" style="flex-shrink:0;overflow:visible"><defs><marker id="${markerId}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${color}"/></marker></defs>${svgLine}</svg><span class="bxe-palette-label">${this._esc(type.label)}</span>`;
        palette.appendChild(item);
      });
      this._edgePaletteEl.appendChild(palette);
    }

    this._currentNodeTypeId = nodeTypes[0]?.id || null;
    if (edgeTypes[0]) {
      this.currentEdgeType = edgeTypes[0];
    }
  }

  _selectNodeType(typeId) {
    this._currentNodeTypeId = typeId;
    if (this._nodePaletteEl) {
      this._nodePaletteEl.querySelectorAll('.bxe-palette-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.typeId === typeId);
      });
    }
  }

  _addNodeAtPosition(position) {
    if (this._currentNodeTypeId) {
      this.addNodeOfType(this._currentNodeTypeId, position);
    } else {
      this.addNode({ label: 'New Node' }, position);
    }
  }

  _refreshProperties(element) {
    this._selectedElement = element;
    if (!this._propsContentEl) return;
    const data = element.data();
    const isNode = element.isNode();
    const exclude = new Set(['id', 'label', 'source', 'target', '_style']);
    const props = Object.keys(data).filter(k => !exclude.has(k));
    const elId = this._esc(data.id || '');

    let html = `
    <div class="bxe-prop-group">
      <label>ID</label>
      <input class="bxe-input" type="text" value="${elId}" readonly data-field="id">
    </div>
    <div class="bxe-prop-group">
      <label>Label</label>
      <input class="bxe-input" type="text" value="${this._esc(data.label || '')}" placeholder="Enter label" data-field="label" data-element-id="${elId}">
    </div>`;

    if (!isNode) {
      html += `
    <div class="bxe-prop-group">
      <label>Source → Target</label>
      <input class="bxe-input" type="text" value="${this._esc(data.source)} → ${this._esc(data.target)}" readonly>
    </div>`;
    }

    let propsRows = '';
    if (!props.length) {
      propsRows = `<tr class="bxe-no-props-row"><td colspan="3" class="bxe-empty-small">No properties</td></tr>`;
    } else {
      props.forEach(key => {
        propsRows += `
        <tr class="bxe-prop-row" data-key="${this._esc(key)}">
          <td><input class="bxe-cell-input" type="text" value="${this._esc(key)}" placeholder="key" data-field="key"></td>
          <td><textarea class="bxe-cell-input bxe-cell-textarea" placeholder="value" data-field="value" rows="1">${this._esc(String(data[key] ?? ''))}</textarea></td>
          <td><button class="bxe-btn-del" data-action="del-prop" title="Remove">×</button></td>
        </tr>`;
      });
    }

    html += `
    <div class="bxe-prop-group">
      <label>Properties</label>
      <div class="bxe-prop-table-wrap">
        <table class="bxe-prop-table">
          <colgroup><col style="width:35%"><col style="width:55%"><col style="width:22px"></colgroup>
          <tbody class="bxe-props-tbody" data-element-id="${elId}">${propsRows}</tbody>
        </table>
      </div>
      <button class="bxe-btn-add" data-action="add-prop">+ Add Property</button>
    </div>
    <div style="padding-top:8px;border-top:1px solid #eee;">
      <button class="bxe-btn-danger" data-action="delete-el" data-element-id="${elId}">Delete</button>
    </div>`;

    this._propsContentEl.innerHTML = html;
  }

  _clearProperties() {
    this._selectedElement = null;
    if (this._propsContentEl) {
      this._propsContentEl.innerHTML = '<div class="bxe-empty">Select a node or edge<br>to edit its properties</div>';
    }
  }

  _handlePropertiesEvent(e) {
    const el = e.target;
    if (!el || !this._selectedElement) return;

    if (e.type === 'input' && el.dataset.field === 'label') {
      const id = this._selectedElement.id();
      this.updateElement(id, { label: el.value });
      return;
    }

    if (e.type === 'input' && el.dataset.field === 'value') {
      const tr = el.closest('tr.bxe-prop-row');
      if (!tr) return;
      const key = tr.dataset.key;
      if (!key) return;
      this.updateElement(this._selectedElement.id(), { [key]: el.value });
      return;
    }

    if (e.type === 'blur' && el.dataset.field === 'key') {
      const tr = el.closest('tr.bxe-prop-row');
      if (!tr) return;
      const oldKey = tr.dataset.key;
      const newKey = el.value.trim();
      if (!newKey) return;
      const id = this._selectedElement.id();
      if (oldKey && oldKey !== newKey) {
        const valEl = tr.querySelector('[data-field="value"]');
        const val = valEl ? valEl.value : '';
        this.updateElement(id, { [oldKey]: undefined, [newKey]: val });
      } else if (!oldKey && newKey) {
        const valEl = tr.querySelector('[data-field="value"]');
        const val = valEl ? valEl.value : '';
        this.updateElement(id, { [newKey]: val });
      }
      tr.dataset.key = newKey;
      return;
    }

    if (e.type === 'click' && el.dataset.action === 'add-prop') {
      const tbody = this._propsContentEl?.querySelector('.bxe-props-tbody');
      if (!tbody) return;
      tbody.querySelector('.bxe-no-props-row')?.remove();
      const tr = document.createElement('tr');
      tr.className = 'bxe-prop-row';
      tr.dataset.key = '';
      tr.innerHTML = `
      <td><input class="bxe-cell-input" type="text" value="" placeholder="key" data-field="key"></td>
      <td><textarea class="bxe-cell-input bxe-cell-textarea" placeholder="value" data-field="value" rows="1"></textarea></td>
      <td><button class="bxe-btn-del" data-action="del-prop" title="Remove">×</button></td>`;
      tbody.appendChild(tr);
      tr.querySelector('[data-field="key"]').focus();
      return;
    }

    if (e.type === 'click' && el.dataset.action === 'del-prop') {
      const tr = el.closest('tr.bxe-prop-row');
      if (!tr) return;
      const key = tr.dataset.key;
      if (key) this.updateElement(this._selectedElement.id(), { [key]: undefined });
      tr.remove();
      const tbody = this._propsContentEl?.querySelector('.bxe-props-tbody');
      if (tbody && !tbody.querySelector('.bxe-prop-row')) {
        tbody.innerHTML = '<tr class="bxe-no-props-row"><td colspan="3" class="bxe-empty-small">No properties</td></tr>';
      }
      return;
    }

    if (e.type === 'click') {
      const btn = el.closest('[data-action="delete-el"]');
      if (btn) {
        const numSel = this.cy.$(':selected').length;
        if (numSel > 0) this.removeSelected();
        else {
          const id = this._selectedElement.id();
          this.removeElement(id);
        }
        this._clearProperties();
      }
    }
  }

  _refreshStylesheet() {
    if (!this._stylesheetRulesEl) return;
    const rules = this.userStylesheet;

    const ruleHtml = (rule, i) => {
      const props = Object.entries(rule.style || {});
      const propsHtml = props.map(([prop, val]) => `
      <div class="bxe-style-prop-row">
        <input type="text" value="${this._esc(prop)}" placeholder="property" data-field="key" data-rule="${i}" data-prop="${this._esc(prop)}">
        <input type="text" value="${this._esc(String(val))}" placeholder="value" data-field="value" data-rule="${i}" data-prop="${this._esc(prop)}">
        <button class="bxe-btn-del" data-action="del-prop" data-rule="${i}" data-prop="${this._esc(prop)}" title="Remove">×</button>
      </div>`).join('');
      return `
      <div class="bxe-style-rule" data-rule="${i}">
        <div class="bxe-style-rule-header">
          <input type="text" value="${this._esc(rule.selector)}" placeholder="selector" data-field="selector" data-rule="${i}">
          <button class="bxe-btn-del" data-action="del-rule" data-rule="${i}" title="Delete rule">🗑</button>
        </div>
        <div class="bxe-style-rule-props">
          ${propsHtml}
          <div class="bxe-style-prop-row bxe-style-prop-blank">
            <input type="text" value="" placeholder="property" data-field="key" data-rule="${i}" data-prop="">
            <input type="text" value="" placeholder="value" data-field="value" data-rule="${i}" data-prop="">
          </div>
        </div>
      </div>`;
    };

    // Always append a blank rule at the bottom for adding new rules.
    const blankRuleHtml = `
      <div class="bxe-style-rule bxe-style-rule-blank">
        <div class="bxe-style-rule-header">
          <input type="text" value="" placeholder="selector (e.g. node, edge)" data-field="selector" data-rule="new">
        </div>
      </div>`;

    this._stylesheetRulesEl.innerHTML =
      rules.map((rule, i) => ruleHtml(rule, i)).join('') + blankRuleHtml;
  }

  _handleStylesheetEvent(e) {
    const el = e.target;
    if (!el) return;

    // ── Existing rule / prop changes ────────────────────────────────────────
    if (e.type === 'change') {
      if (el.dataset.field === 'selector' && el.dataset.rule !== 'new') {
        const ri = parseInt(el.dataset.rule);
        const rule = this.userStylesheet[ri];
        if (rule) this.updateStyleRule(ri, el.value, rule.style);
        return;
      }
      // Existing prop key rename (data-prop is non-empty on real rows)
      if (el.dataset.field === 'key' && el.dataset.prop) {
        const ri = parseInt(el.dataset.rule);
        const oldKey = el.dataset.prop;
        const newKey = el.value.trim();
        if (!newKey) return;
        const rule = this.userStylesheet[ri];
        if (!rule) return;
        const style = { ...rule.style };
        const val = style[oldKey];
        delete style[oldKey];
        style[newKey] = val;
        this.updateStyleRule(ri, rule.selector, style);
        return;
      }
      // Existing prop value change (data-prop is non-empty on real rows)
      if (el.dataset.field === 'value' && el.dataset.prop) {
        const ri = parseInt(el.dataset.rule);
        const prop = el.dataset.prop;
        const rule = this.userStylesheet[ri];
        if (!rule) return;
        this.updateStyleRule(ri, rule.selector, { ...rule.style, [prop]: el.value });
        return;
      }
    }

    // ── Blank row commits (focusout) ────────────────────────────────────────
    if (e.type === 'focusout') {
      // Blank rule: commit when focus leaves the whole rule div
      if (el.dataset.field === 'selector' && el.dataset.rule === 'new') {
        const ruleDiv = el.closest('.bxe-style-rule-blank');
        if (e.relatedTarget && ruleDiv?.contains(e.relatedTarget)) return;
        const sel = el.value.trim();
        if (sel) this.addStyleRule(sel, {});
        return;
      }
      // Blank prop row: commit when focus leaves the whole row div
      if (el.dataset.prop === '' && (el.dataset.field === 'key' || el.dataset.field === 'value')) {
        const row = el.closest('.bxe-style-prop-blank');
        if (!row) return;
        if (e.relatedTarget && row.contains(e.relatedTarget)) return;
        const ri = parseInt(el.dataset.rule);
        if (isNaN(ri)) return;
        const key = row.querySelector('[data-field="key"]')?.value.trim();
        const val = row.querySelector('[data-field="value"]')?.value || '';
        if (!key) return;
        const rule = this.userStylesheet[ri];
        if (!rule) return;
        this.updateStyleRule(ri, rule.selector, { ...rule.style, [key]: val });
        return;
      }
    }

    // ── Delete actions ───────────────────────────────────────────────────────
    if (e.type === 'click') {
      if (el.dataset.action === 'del-rule') {
        this.removeStyleRule(parseInt(el.dataset.rule));
        return;
      }
      if (el.dataset.action === 'del-prop') {
        const ri = parseInt(el.dataset.rule);
        const prop = el.dataset.prop;
        const rule = this.userStylesheet[ri];
        if (!rule) return;
        const style = { ...rule.style };
        delete style[prop];
        this.updateStyleRule(ri, rule.selector, style);
        return;
      }
    }
  }

  _showContextMenu(x, y, target) {
    this._ctxTarget = target;
    const isNode = target.isNode();
    const numSel = this.cy.$(':selected').length;
    const deleteLabel = numSel > 1 ? `Delete (${numSel})` : 'Delete';
    const hasSel = numSel > 0;
    const hasPaste = !!this._clipboard;
    this._ctxMenu.innerHTML = `
    <div class="bxe-ctx-item" data-action="edit-props">Edit Properties</div>
    <div class="bxe-ctx-sep"></div>
    ${hasSel ? `<div class="bxe-ctx-item" data-action="cut">Cut${numSel > 1 ? ` (${numSel})` : ''}</div>` : ''}
    ${hasSel ? `<div class="bxe-ctx-item" data-action="copy">Copy${numSel > 1 ? ` (${numSel})` : ''}</div>` : ''}
    ${hasPaste ? `<div class="bxe-ctx-item" data-action="paste">Paste</div>` : ''}
    ${(hasSel || hasPaste) ? '<div class="bxe-ctx-sep"></div>' : ''}
    ${isNode && !hasSel ? '<div class="bxe-ctx-item" data-action="duplicate">Duplicate</div><div class="bxe-ctx-sep"></div>' : ''}
    <div class="bxe-ctx-item danger" data-action="delete">${this._esc(deleteLabel)}</div>`;
    this._ctxMenu.style.left = x + 'px';
    this._ctxMenu.style.top = y + 'px';
    this._ctxMenu.style.display = 'block';
    setTimeout(() => document.addEventListener('click', () => this._hideContextMenu(), { once: true }), 50);
  }

  _showBackgroundContextMenu(x, y) {
    const hasPaste = !!this._clipboard;
    this._ctxMenu.innerHTML = `
    <div class="bxe-ctx-item" data-action="add-node-here">Add Node Here</div>
    ${hasPaste ? '<div class="bxe-ctx-sep"></div><div class="bxe-ctx-item" data-action="paste">Paste</div>' : ''}`;
    this._ctxMenu.style.left = x + 'px';
    this._ctxMenu.style.top = y + 'px';
    this._ctxMenu.style.display = 'block';
    setTimeout(() => document.addEventListener('click', () => this._hideContextMenu(), { once: true }), 50);
  }

  _hideContextMenu() {
    if (this._ctxMenu) this._ctxMenu.style.display = 'none';
  }

  _updateHistoryButtons() {
    if (this._undoBtn) this._undoBtn.disabled = !this.canUndo();
    if (this._redoBtn) this._redoBtn.disabled = !this.canRedo();
  }

  _init() {
    this._injectCSS();
    this._createUI();

    const stylesheet = this._buildStylesheet();
    this.cy = cytoscape({
      container: this._canvasDiv,
      elements: this.options.elements || { nodes: [], edges: [] },
      style: stylesheet,
      layout: this.options.layout,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true
    });

    this._initPanzoomControls();
    this._setupEvents();
    this._renderPalette();
    this.createLayoutPanel(this._layoutPaneContentEl);
    this._refreshStylesheet();
  }

  _buildStylesheet() {
    const baseStyles = [
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
      },
      {
        // Hide the edgehandles plugin's built-in teardrop handle node;
        // our custom ring div replaces it entirely.
        selector: '.eh-handle',
        style: { 'opacity': 0, 'events': 'no' }
      },
      {
        selector: '.eh-reconnect-target',
        style: { 'border-width': 3, 'border-color': '#3498db', 'border-opacity': 1 }
      }
    ];

    const customStyles = this.userStylesheet;
    const elementStyles = this._generateElementStyles();

    return [...baseStyles, ...customStyles, ...elementStyles];
  }

  _generateElementStyles() {
    const styles = [];

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
    this.cy.on('add remove data', (evt) => {
      this._emit('change', { type: evt.type, target: evt.target });
    });

    this.cy.on('select', (evt) => {
      this._emit('select', { target: evt.target });
      this._emit('selectionChange', { type: 'select', target: evt.target, selected: this.cy.$(':selected').jsons() });
      this._selectedElement = evt.target;
      this._refreshProperties(evt.target);
      this._switchPane('properties');
    });

    this.cy.on('unselect', (evt) => {
      this._emit('unselect', { target: evt.target });
      this._emit('selectionChange', { type: 'unselect', target: evt.target, selected: this.cy.$(':selected').jsons() });
      if (!this.cy.$(':selected').length) this._clearProperties();
    });

    this.cy.on('grabon', 'node', (evt) => {
      if (this._restoringState || this._ehDrawing) return;
      const node = evt.target;
      const pos = node.position();
      this._preGrabPos = { x: pos.x, y: pos.y };
      this._preGrabSnapshot = this.exportGraph();
    });

    this.cy.on('free', 'node', (evt) => {
      if (this._restoringState || this._ehDrawing || !this._preGrabSnapshot) return;
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

    this.cy.on('dbltap', 'node,edge', (evt) => {
      this._startInlineLabelEdit(evt.target);
    });

    this.cy.on('dbltap', (evt) => {
      if (evt.target === this.cy) this._addNodeAtPosition(evt.position);
    });

    this.cy.on('zoom pan', () => this._cancelInlineLabelEdit());

    this.cy.on('cxttap', 'node,edge', (evt) => {
      evt.preventDefault();
      this._showContextMenu(evt.originalEvent.clientX, evt.originalEvent.clientY, evt.target);
    });

    this.cy.on('cxttap', (evt) => {
      if (evt.target === this.cy) {
        evt.preventDefault();
        this._ctxPosition = evt.position;
        this._showBackgroundContextMenu(evt.originalEvent.clientX, evt.originalEvent.clientY);
      }
    });

    this.cy.on('tap', () => this._hideContextMenu());
  }

  /**
   * Add a node to the graph
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

    const currentData = element.data();
    const newData = { ...data };

    if (style !== null) {
      newData._style = { ...currentData._style, ...style };
    } else if (currentData._style) {
      newData._style = currentData._style;
    }

    element.data(newData);

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
   * Run a layout algorithm.
   */
  runLayout(layoutOptions) {
    this._pushUndo();
    if (typeof layoutOptions === 'string') layoutOptions = { name: layoutOptions };
    const { name, ...rest } = layoutOptions;
    this._lastLayout = { name, options: { ...rest } };

    // When nodes are selected, apply the layout only to those nodes
    // (plus the edges between them so the algorithm has topology to work with).
    const selectedNodes = this.cy.nodes(':selected');
    const target = selectedNodes.length > 0
      ? selectedNodes.add(selectedNodes.edgesWith(selectedNodes))
      : this.cy;

    // Stop any previously running layout so it doesn't overwrite restored positions
    // if the user undoes while an animated layout is still in progress.
    this._stopRunningLayout();

    const layout = target.layout(layoutOptions);
    this._runningLayout = layout;
    layout.one('layoutstop', () => { this._runningLayout = null; });
    layout.run();
    this._emit('layoutRun', { options: layoutOptions });
  }

  /** Stop the currently running async layout, if any. */
  _stopRunningLayout() {
    if (this._runningLayout) {
      try { this._runningLayout.stop(); } catch (_) { /* ignore */ }
      this._runningLayout = null;
    }
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
   * Get available layout algorithms
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
    const elements = this.cy.json().elements || {};
    return {
      nodes: elements.nodes || [],
      edges: elements.edges || []
    };
  }

  /**
   * Load elements into the graph, replacing any existing elements
   */
  loadElements(elements) {
    const nodes = elements.nodes || (Array.isArray(elements) ? elements.filter(e => e.group === 'nodes') : []);
    const edges = elements.edges || (Array.isArray(elements) ? elements.filter(e => e.group === 'edges') : []);

    this.cy.elements().remove();

    // Pass nodes and edges together in a single cy.add() call.
    // Cytoscape's internal restore() always processes nodes before edges, so
    // source/target references are resolved correctly.  Avoiding cy.batch()
    // here is intentional: batch() defers the renderer's 'add' notification
    // until after batchStyleEles.updateStyle() has already fired a 'style'
    // event, which means the canvas renderer never receives the 'add' signal
    // it needs to register newly loaded edges in its z-sorted element cache.
    // Without the batch the 'add' notification fires immediately, edges are
    // registered with the renderer, and they render and are selectable as
    // expected.
    const all = [...nodes, ...edges];
    if (all.length) this.cy.add(all);

    this._updateStylesheet();
    this._emit('elementsLoaded', { elements });
  }

  /**
   * Export graph data including elements, user stylesheet, and last layout.
   */
  exportGraph() {
    const els = this.cy.json().elements;
    // Strip edgehandles transient classes from snapshot to avoid polluting undo history
    const cleanEl = (el) => {
      if (!el.classes) return el;
      const classes = el.classes.split(' ').filter(c => !c.startsWith('eh-')).join(' ');
      return classes !== el.classes ? { ...el, classes } : el;
    };
    // Exclude edgehandles ghost/preview elements (they are temporary)
    const isEhGhost = (el) => {
      const cls = el.classes || '';
      return cls.includes('eh-ghost') || cls.includes('eh-preview');
    };
    return {
      elements: {
        nodes: (els.nodes || []).filter(el => !isEhGhost(el)).map(cleanEl),
        edges: (els.edges || []).filter(el => !isEhGhost(el)).map(cleanEl)
      },
      userStylesheet: this.userStylesheet.map(rule => ({
        selector: rule.selector,
        style: { ...rule.style }
      })),
      lastLayout: this.getLastLayout(),
      context: { ...this.context },
      version: '1.0.0'
    };
  }

  /**
   * Import graph data.
   */
  importGraph(graphData) {
    if (graphData.elements) {
      this.loadElements(graphData.elements);
    }
    const incoming = graphData.userStylesheet || graphData.stylesheet;
    if (incoming) {
      this.userStylesheet = incoming.map(rule => ({
        selector: rule.selector,
        style: { ...rule.style }
      }));
      this._updateStylesheet();
      this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    }
    if (graphData.lastLayout) {
      this._lastLayout = {
        name: graphData.lastLayout.name || 'dagre',
        options: { ...(graphData.lastLayout.options || {}) }
      };
      if (this._layoutPanel) this._layoutPanelSync();
    }
    if (this._nodesNeedLayout()) {
      const { name, options } = this._lastLayout;
      this.runLayout({ name, ...options });
    }
    this._emit('graphImported', { graphData });
    if (this._stylesheetRulesEl) this._refreshStylesheet();
    if (graphData.context) {
      this.context = { ...graphData.context };
      this._renderContextPane();
    }
    this.cy.fit(undefined, 30);
    this.cy.style().update();
  }

  /** Return true if loaded nodes have no real position data */
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
    if (this._stylesheetRulesEl) this._refreshStylesheet();
  }

  /** Append a new rule */
  addStyleRule(selector, style = {}) {
    this._pushUndo();
    this.userStylesheet.push({ selector, style: { ...style } });
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    if (this._stylesheetRulesEl) this._refreshStylesheet();
    return this.userStylesheet.length - 1;
  }

  /** Update rule at index */
  updateStyleRule(index, selector, style) {
    this._pushUndo();
    if (index < 0 || index >= this.userStylesheet.length) return false;
    this.userStylesheet[index] = { selector, style: { ...style } };
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    if (this._stylesheetRulesEl) this._refreshStylesheet();
    return true;
  }

  /** Remove rule at index */
  removeStyleRule(index) {
    this._pushUndo();
    if (index < 0 || index >= this.userStylesheet.length) return false;
    this.userStylesheet.splice(index, 1);
    this._updateStylesheet();
    this._emit('stylesheetChanged', { stylesheet: this.userStylesheet });
    if (this._stylesheetRulesEl) this._refreshStylesheet();
    return true;
  }

  /**
   * Get selected elements as Cytoscape element objects
   */
  getSelected() {
    return this.cy.$(':selected').toArray().map(el => el.json());
  }

  /**
   * Remove all currently selected elements in one undo step.
   */
  removeSelected() {
    const selected = this.cy.$(':selected');
    if (!selected.length) return 0;
    this._pushUndo();
    selected.forEach(el => {
      const json = el.json();
      this.cy.remove(el);
      this._emit('elementRemoved', { element: json });
    });
    this._updateStylesheet();
    return selected.length;
  }

  // ─── Clipboard ───────────────────────────────────────────────────────────

  /**
   * Copy selected nodes (and edges between them) to the internal clipboard.
   * Returns true if anything was copied.
   */
  copy() {
    const selectedNodes = this.cy.$('node:selected');
    if (!selectedNodes.length) return false;

    const selectedNodeIds = new Set(selectedNodes.map(n => n.id()));
    // Only include edges that are explicitly selected AND have both endpoints selected.
    const edges = this.cy.$('edge:selected').filter(e =>
      selectedNodeIds.has(e.data('source')) && selectedNodeIds.has(e.data('target'))
    );

    this._clipboard = {
      nodes: selectedNodes.map(n => n.json()),
      edges: edges.map(e => e.json())
    };
    this._pasteOffset = 0;
    this._emit('clipboardChange', { hasClipboard: true });
    return true;
  }

  /**
   * Cut selected elements (copy then delete).
   * Returns true if anything was cut.
   */
  cut() {
    if (!this.copy()) return false;
    this.removeSelected();
    return true;
  }

  /**
   * Paste the clipboard contents into the graph.
   * Each paste cascades by 20px. Returns the newly added elements or false.
   */
  paste() {
    if (!this._clipboard) return false;
    this._pushUndo();

    this._pasteOffset += 20;
    const offset = this._pasteOffset;

    // Map old node IDs → new node IDs
    const idMap = {};
    const newNodes = [];
    const newEdges = [];

    this._clipboard.nodes.forEach(nodeJson => {
      const newId = 'node-' + Math.random().toString(36).slice(2, 9);
      idMap[nodeJson.data.id] = newId;

      const newData = { ...nodeJson.data, id: newId };
      const newPos = nodeJson.position
        ? { x: nodeJson.position.x + offset, y: nodeJson.position.y + offset }
        : undefined;

      const entry = { group: 'nodes', data: newData };
      if (newPos) entry.position = newPos;
      newNodes.push(entry);
    });

    this._clipboard.edges.forEach(edgeJson => {
      const newSrc = idMap[edgeJson.data.source];
      const newTgt = idMap[edgeJson.data.target];
      if (!newSrc || !newTgt) return; // skip if endpoints weren't in clipboard
      const newId = 'edge-' + Math.random().toString(36).slice(2, 9);
      newEdges.push({
        group: 'edges',
        data: { ...edgeJson.data, id: newId, source: newSrc, target: newTgt }
      });
    });

    // Add to graph and select the new elements
    this.cy.$(':selected').unselect();
    const added = this.cy.add([...newNodes, ...newEdges]);
    added.select();

    this._updateStylesheet();
    this._emit('paste', { nodes: newNodes, edges: newEdges });
    return added;
  }

  /** Returns true if there is something in the clipboard to paste. */
  canPaste() { return !!this._clipboard; }



  _pushUndo() {
    if (this._restoringState) return;
    const snap = this.exportGraph();
    console.debug('[Boxes] pushUndo: snapshot has', snap.elements.nodes?.length, 'nodes,', snap.elements.edges?.length, 'edges');
    this._undoStack.push(snap);
    if (this._undoStack.length > 50) this._undoStack.shift();
    this._redoStack.length = 0;
    this._emitHistoryChange();
  }

  _emitHistoryChange() {
    this._emit('historyChange', { canUndo: this.canUndo(), canRedo: this.canRedo() });
    this._updateHistoryButtons();
  }

  _restoreSnapshot(snapshot) {
    this._restoringState = true;
    try {
      this.loadElements(snapshot.elements || {});
      // Layouts (e.g. Dagre) call cy.fit() when they run, shifting the viewport.
      // After restoring pre-layout positions the nodes may be off-screen, so
      // re-fit whenever there are nodes to show.
      if (this.cy.nodes().length) this.cy.fit(undefined, 30);
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
    if (this._stylesheetRulesEl) this._refreshStylesheet();
    if (this._selectedElement) {
      const el = this.cy.getElementById(this._selectedElement.id());
      if (el.length) this._refreshProperties(el);
      else this._clearProperties();
    }
  }

  /** Undo the last action. */
  undo() {
    if (!this._undoStack.length) return false;
    // Stop any async layout that is still animating — if left running it would
    // overwrite the positions we're about to restore.
    this._stopRunningLayout();
    // Clear any pending drag state so a stale 'free' event can't corrupt redo stack
    this._preGrabSnapshot = null;
    this._preGrabPos = null;
    this._redoStack.push(this.exportGraph());
    const snapshot = this._undoStack.pop();
    console.debug('[Boxes] undo: restoring snapshot with', snapshot.elements.nodes?.length, 'nodes,', snapshot.elements.edges?.length, 'edges');
    this._restoreSnapshot(snapshot);
    this._emitHistoryChange();
    return true;
  }

  /** Redo the last undone action. */
  redo() {
    if (!this._redoStack.length) return false;
    // Stop any async layout that is still animating.
    this._stopRunningLayout();
    // Clear any pending drag state so a stale 'free' event can't corrupt undo stack
    this._preGrabSnapshot = null;
    this._preGrabPos = null;
    this._undoStack.push(this.exportGraph());
    const snapshot = this._redoStack.pop();
    console.debug('[Boxes] redo: restoring snapshot with', snapshot.elements.nodes?.length, 'nodes,', snapshot.elements.edges?.length, 'edges');
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
   * Export the graph as a PDF blob.
   * cytoscape-pdf-export is loaded lazily on first call so it does not inflate
   * the main bundle for consumers who never use PDF export.
   *
   * @param {object} [options]
   * @param {boolean} [options.full=true]           Export entire graph, not just viewport
   * @param {string}  [options.paperSize='LETTER']  LETTER, LEGAL, A4, A3, A2, A1, A0, TABLOID, CUSTOM
   * @param {string}  [options.orientation='LANDSCAPE'] PORTRAIT or LANDSCAPE
   * @param {number}  [options.margin=52]           Margin in PostScript points (72 pt = 1 in)
   * @param {string|false} [options.bg=false]       Background colour or false for transparent
   * @returns {Promise<Blob>}
   */
  async exportPdf(options = {}) {
    if (!_pdfPluginRegistered) {
      const mod = await import('cytoscape-pdf-export');
      const plugin = mod?.default ?? mod;
      cytoscape.use(plugin);
      _pdfPluginRegistered = true;
    }
    return this.cy.pdf({
      full:        options.full        ?? true,
      paperSize:   options.paperSize   ?? 'LETTER',
      orientation: options.orientation ?? 'LANDSCAPE',
      margin:      options.margin      ?? 52,
      bg:          options.bg          ?? false,
    });
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
    if (this._ctxMenu) {
      this._ctxMenu.parentNode?.removeChild(this._ctxMenu);
      this._ctxMenu = null;
    }
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container.style.cssText = '';
    }
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
   */
  addNodeOfType(typeId, position = null) {
    const type = this._nodeTypes.find(t => t.id === typeId);
    if (!type) return null;
    const nodeData = { id: _uniqueId('n'), label: type.label, ...type.data };
    if (!position) {
      const pan = this.cy.pan(), zoom = this.cy.zoom();
      const offset = this.cy.nodes().length * 15;
      const canvasEl = this._canvasDiv || this.container;
      position = {
        x: (canvasEl.offsetWidth  / 2 - pan.x) / zoom + (offset % 150) - 75,
        y: (canvasEl.offsetHeight / 2 - pan.y) / zoom + Math.floor(offset / 150) * 80
      };
    }
    return this.addNode(nodeData, position);
  }

  /**
   * Set the current edge type used by the built-in edge handle.
   */
  setEdgeType(typeId) {
    const type = this._edgeTypes.find(t => t.id === typeId) || null;
    this.currentEdgeType = type;
    this._emit('edgeTypeChanged', { edgeType: this.currentEdgeType });
    if (this._edgePaletteEl) {
      this._edgePaletteEl.querySelectorAll('.bxe-palette-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.typeId === typeId);
      });
    }
  }

  /** Return the currently active edge type */
  getEdgeType() {
    return this.currentEdgeType ? { ...this.currentEdgeType } : null;
  }

  // ─── Panzoom Controls ─────────────────────────────────────────────────────

  _initPanzoomControls() {
    const controls = document.createElement('div');
    controls.className = 'bxe-panzoom';
    // Zoom-in, fit, zoom-out, zoom level display
    controls.innerHTML = `
      <button class="bxe-pz-btn" data-pz="zoom-in"  title="Zoom in">+</button>
      <button class="bxe-pz-btn" data-pz="fit"       title="Fit graph">⊡</button>
      <button class="bxe-pz-btn" data-pz="zoom-out"  title="Zoom out">−</button>
    `;
    this._canvasWrap.appendChild(controls);

    controls.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pz]');
      if (!btn) return;
      const cy = this.cy;
      switch (btn.dataset.pz) {
        case 'zoom-in':  cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); break;
        case 'zoom-out': cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); break;
        case 'fit':      cy.fit(undefined, 30); break;
      }
    });
  }

  // ─── Edge Handle ──────────────────────────────────────────────────────────

  _initEdgeHandle() {
    this._eh = this.cy.edgehandles({
      canConnect: () => true,
      hoverDelay: 0,
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

    this._ehHandleDiv = null;
    this._ehHandleNode = null;
    this._ehDrawing = false;
    this._ehSourceNode = null;   // source node saved across the draw gesture
    this._ehDidComplete = false; // set true when ehcomplete fires

    // Returns the ring width in screen pixels: 2× the node's border-width,
    // scaled by the current zoom, with a minimum so it's always grabbable.
    const getRingWidth = (node) => {
      const borderPx = parseFloat(node.style('border-width')) || 2;
      return Math.max(10, borderPx * 2 * this.cy.zoom());
    };

    // True when (clientX, clientY) falls within the ring band (outside the
    // node body, inside the ring's outer edge).  Uses an ellipse test so it
    // matches both circular and ellipse-shaped nodes.
    const isInRing = (clientX, clientY, div, nodeW, nodeH) => {
      const rect = div.getBoundingClientRect();
      const cx   = rect.left  + rect.width  / 2;
      const cy   = rect.top   + rect.height / 2;
      const outerHW = rect.width  / 2;
      const outerHH = rect.height / 2;
      const innerHW = nodeW / 2;
      const innerHH = nodeH / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const outsideInner = innerHW <= 0 || innerHH <= 0 ||
        (dx / innerHW) ** 2 + (dy / innerHH) ** 2 >= 1;
      const insideOuter =
        (dx / outerHW) ** 2 + (dy / outerHH) ** 2 <= 1;
      return insideOuter && outsideInner;
    };

    const positionHandle = (node, div) => {
      const bb          = node.renderedBoundingBox({ includeLabels: false });
      const rw          = Math.round(getRingWidth(node));
      const zoom        = this.cy.zoom();
      const nodeBorder  = Math.round((parseFloat(node.style('border-width')) || 0) * zoom);
      const nodeW       = Math.round(bb.x2 - bb.x1);
      const nodeH       = Math.round(bb.y2 - bb.y1);
      const containerRect = this.cy.container().getBoundingClientRect();

      // The ring's inner edge sits at the node's inner border edge — overlap,
      // never a gap.
      const holeW = Math.max(0, nodeW - 2 * nodeBorder);
      const holeH = Math.max(0, nodeH - 2 * nodeBorder);
      const outerW = holeW + 2 * rw;
      const outerH = holeH + 2 * rw;

      // Position outer capture div.
      div.style.left   = `${Math.round(containerRect.left + bb.x1) + nodeBorder - rw}px`;
      div.style.top    = `${Math.round(containerRect.top  + bb.y1) + nodeBorder - rw}px`;
      div.style.width  = `${outerW}px`;
      div.style.height = `${outerH}px`;

      // Compute border-radius that matches the node's rendered shape exactly.
      const shape = node.style('shape') || 'ellipse';
      let radius;
      if (shape === 'ellipse' || shape === 'circle') {
        radius = '50%';
      } else if (shape === 'round-rectangle' || shape === 'round-octagon') {
        // Cytoscape uses corner-radius style (px in graph space) if set,
        // otherwise defaults to min(w, h) / 4.
        const crRaw = parseFloat(node.style('corner-radius'));
        const cr = crRaw > 0
          ? Math.round(crRaw * zoom)
          : Math.round(Math.min(parseFloat(node.style('width')) || nodeW / zoom,
                                parseFloat(node.style('height')) || nodeH / zoom) / 4 * zoom);
        radius = `${cr}px`;
      } else {
        radius = '0';
      }

      // Size and style the inner visual ring div.
      // box-shadow extends outward from the inner div's edge, following border-radius
      // exactly — 50% opaque at the inner edge, fading to 0 at distance rw.
      const ring = div._ring;
      ring.style.left         = `${rw}px`;
      ring.style.top          = `${rw}px`;
      ring.style.width        = `${holeW}px`;
      ring.style.height       = `${holeH}px`;
      ring.style.borderRadius = radius;
      ring.style.boxShadow    = `0 0 ${rw}px 0 rgba(52,152,219,0.5)`;

      div._nodeW = holeW;
      div._nodeH = holeH;
    };

    const removeHandle = () => {
      if (this._ehHandleDiv) {
        const div = this._ehHandleDiv;
        div.removeEventListener('mousedown', this._ehStartDrawing);
        div.removeEventListener('mousemove', div._moveHandler);
        if (this._ehContainerMoveHandler) {
          this.cy.container().removeEventListener('mousemove', this._ehContainerMoveHandler);
          this._ehContainerMoveHandler = null;
        }
        div.parentNode?.removeChild(div);
        this._ehHandleDiv = null;
      }
      this._ehHandleNode = null;
    };

    const setHandleOn = (node) => {
      if (this._ehDrawing) return;
      removeHandle();
      this._ehHandleNode = node;

      // Outer div: transparent, covers the full ring+hole area, handles pointer events.
      const div = document.createElement('div');
      div.className = 'boxes-eh-handle';
      div.style.cssText = [
        'position:fixed',
        'background:transparent',
        'overflow:visible',
        'cursor:crosshair',
        'z-index:9999',
        'pointer-events:none',
      ].join(';');

      // Inner div: sized to the node interior, carries the box-shadow ring.
      // box-shadow follows border-radius exactly, so the ring matches every shape.
      const ring = document.createElement('div');
      ring.style.cssText = 'position:absolute;background:transparent;pointer-events:none;';
      div.appendChild(ring);
      div._ring = ring;

      // Dynamically enable/disable pointer events based on whether the cursor
      // is in the ring vs the node body.  When pointer-events is 'none' the
      // Cytoscape canvas receives the event normally, so dragging still works.
      const updatePointerEvents = (clientX, clientY) => {
        if (!this._ehHandleDiv) return;
        const inRing = isInRing(clientX, clientY, div, div._nodeW, div._nodeH);
        div.style.pointerEvents = inRing ? 'auto' : 'none';
        div.style.cursor = inRing ? 'crosshair' : 'default';
      };

      // When the ring has pointer-events:auto the container stops receiving
      // mousemove, so we listen on the div too.
      div._moveHandler = (e) => updatePointerEvents(e.clientX, e.clientY);
      div.addEventListener('mousemove', div._moveHandler);

      // When pointer-events:none, the container canvas receives mousemove.
      this._ehContainerMoveHandler = (e) => updatePointerEvents(e.clientX, e.clientY);
      this.cy.container().addEventListener('mousemove', this._ehContainerMoveHandler);

      div.addEventListener('mousedown', this._ehStartDrawing);

      // Any wheel event that lands on the ring div (when pointer-events:auto)
      // must be forwarded to the Cytoscape container so zoom/pan works normally.
      // preventDefault stops the browser from treating it as a page scroll or
      // pinch-zoom; re-dispatching to the canvas lets Cytoscape handle it.
      div.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.cy.container().dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true,
          clientX: e.clientX, clientY: e.clientY,
          deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ,
          deltaMode: e.deltaMode,
          ctrlKey: e.ctrlKey, shiftKey: e.shiftKey,
          altKey: e.altKey, metaKey: e.metaKey,
        }));
      }, { passive: false });

      // Remove the ring only when the cursor has actually left the outer
      // boundary of the div.  When pointer-events toggles auto→none (cursor
      // moving into the node center), Chrome fires a spurious mouseleave; the
      // bounds check below prevents that from dismissing the ring prematurely.
      div.addEventListener('mouseleave', (e) => {
        if (this._ehDrawing) return;
        const rect = div.getBoundingClientRect();
        const outside = e.clientX < rect.left || e.clientX > rect.right ||
                        e.clientY < rect.top  || e.clientY > rect.bottom;
        if (outside) removeHandle();
      });

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
    this._ehWindowMouseup = (e) => {
      this._ehDidComplete = false;
      const sourceNode = this._ehSourceNode;
      this._eh.stop(); // synchronously fires ehcomplete if a valid target was previewed

      // Self-loop fallback: edgehandles never fires ehcomplete when source ===
      // target because tapdragover doesn't re-fire if the cursor never left the
      // source node (Cytoscape only fires it when near != last).  If the draw
      // was not completed but the cursor is still over the source node (or its
      // ring, which sits outside the node's own bounding box), create the
      // self-loop manually (undo was already pushed by ehstart).
      if (!this._ehDidComplete && sourceNode) {
        const cr = this.cy.container().getBoundingClientRect();
        const bb = sourceNode.renderedBoundingBox({ includeLabels: false });
        const rw = getRingWidth(sourceNode);
        const overNodeOrRing =
          e.clientX >= cr.left + bb.x1 - rw && e.clientX <= cr.left + bb.x2 + rw &&
          e.clientY >= cr.top  + bb.y1 - rw && e.clientY <= cr.top  + bb.y2 + rw;
        if (overNodeOrRing) {
          const edge = this.cy.add({
            group: 'edges',
            data: {
              source: sourceNode.id(),
              target: sourceNode.id(),
              label: this.currentEdgeType?.label || '',
              ...(this.currentEdgeType?.data || {})
            }
          });
          this._updateStylesheet();
          this._emit('edgeAdded', { edge: edge.json() });
          this._emit('edgeHandleComplete', {
            sourceId: sourceNode.id(),
            targetId: sourceNode.id(),
            edgeType: this.currentEdgeType
          });
        }
      }
      this._ehSourceNode = null;
    };

    this.cy.on('mouseover', 'node', this._ehMouseoverHandler);
    // When the cursor exits through the node body (pointer-events:none on ring),
    // Cytoscape fires mouseout — use that to dismiss the ring.
    this.cy.on('mouseout', 'node', (e) => { if (!this._ehDrawing) removeHandle(); });
    this.cy.on('grab', 'node', this._ehRemoveHandler);
    this.cy.on('tap', (e) => { if (e.target === this.cy) removeHandle(); });
    this.cy.on('zoom pan', this._ehRemoveHandler);
    window.addEventListener('mouseup', this._ehWindowMouseup);

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

    this.cy.on('ehstart', () => {
      this._ehSourceNode = this._ehHandleNode; // save before removeHandle() clears it
      this._pushUndo();
      this._ehDrawing = true;
      removeHandle();
    });
    this.cy.on('ehstop', () => { this._ehDrawing = false; });
    this.cy.on('ehcomplete', (event, sourceNode, targetNode, addedEdges) => {
      this._ehDidComplete = true;
      this._ehCompleteHandler(event, sourceNode, targetNode, addedEdges);
    });

    // ── Edge endpoint reconnect handles ────────────────────────────────────
    // Show a small glow dot at each end of an edge on hover.  Dragging a dot
    // reconnects that end to a different node via edge.move().

    this._erDivs = [];       // [{div, edge, end}]
    this._erEdge  = null;    // edge whose handles are currently shown
    this._erActive = false;  // true while a reconnect drag is in progress

    const EP_SIZE = 20; // diameter of the endpoint glow dot, in screen px

    const removeEdgeHandles = () => {
      this._erDivs.forEach(({ div }) => div.parentNode?.removeChild(div));
      this._erDivs = [];
      this._erEdge = null;
    };

    // Return the Cytoscape node whose bounding box contains the given client
    // coordinates, or null.  Excludes internal drag-proxy nodes.
    const nodeAtClient = (clientX, clientY) => {
      const cr   = this.cy.container().getBoundingClientRect();
      const pan  = this.cy.pan();
      const zoom = this.cy.zoom();
      const gx   = (clientX - cr.left  - pan.x) / zoom;
      const gy   = (clientY - cr.top   - pan.y) / zoom;
      let hit = null;
      this.cy.nodes().forEach(n => {
        if (n.hasClass('boxes-drag-proxy')) return;
        const bb = n.boundingBox({ includeLabels: false });
        if (gx >= bb.x1 && gx <= bb.x2 && gy >= bb.y1 && gy <= bb.y2) hit = n;
      });
      return hit;
    };

    // Create one glow-dot div for a single endpoint.
    const makeEndpointDiv = (edge, end) => {
      const div = document.createElement('div');
      div.className = 'boxes-er-handle';

      const inner = document.createElement('div');
      inner.style.cssText = [
        'position:absolute',
        `width:${EP_SIZE}px`,
        `height:${EP_SIZE}px`,
        'border-radius:50%',
        'background:rgba(52,152,219,0.5)',
        `box-shadow:0 0 ${EP_SIZE / 2}px ${EP_SIZE / 4}px rgba(52,152,219,0.6)`,
        'pointer-events:none',
      ].join(';');
      div.appendChild(inner);

      div.style.cssText = [
        'position:fixed',
        `width:${EP_SIZE}px`,
        `height:${EP_SIZE}px`,
        'background:rgba(0,0,0,0.001)',  // near-invisible but ensures pointer-events hit-test
        'cursor:grab',
        'z-index:9998',
      ].join(';');

      div.addEventListener('mousedown', (e) => {
        if (this._ehDrawing) return;
        e.preventDefault();
        e.stopPropagation();
        beginReconnect(edge, end, e);
      });

      // Dismiss on leave only when not starting a drag.
      div.addEventListener('mouseleave', () => {
        if (!this._erActive) removeEdgeHandles();
      });

      return div;
    };

    const positionEndpointDivs = (edge) => {
      const cr = this.cy.container().getBoundingClientRect();
      const ends = { source: edge.renderedSourceEndpoint(),
                     target: edge.renderedTargetEndpoint() };
      this._erDivs.forEach(({ div, end: endKey }) => {
        const pt = ends[endKey];
        div.style.left = `${cr.left + pt.x - EP_SIZE / 2}px`;
        div.style.top  = `${cr.top  + pt.y - EP_SIZE / 2}px`;
      });
    };

    const showEdgeHandles = (edge) => {
      if (this._erActive || this._ehDrawing) return;
      if (this._erEdge && this._erEdge.same(edge)) return;
      removeEdgeHandles();
      this._erEdge = edge;

      for (const end of ['source', 'target']) {
        const div = makeEndpointDiv(edge, end);
        document.body.appendChild(div);
        this._erDivs.push({ div, end });
      }
      positionEndpointDivs(edge);
    };

    const beginReconnect = (edge, end, startEvent) => {
      this._erActive = true;
      removeEdgeHandles();

      const originalNodeId = end === 'source' ? edge.data('source') : edge.data('target');

      // Convert client coords to graph space.
      const toGraph = (clientX, clientY) => {
        const cr  = this.cy.container().getBoundingClientRect();
        const pan = this.cy.pan(), zoom = this.cy.zoom();
        return { x: (clientX - cr.left - pan.x) / zoom,
                 y: (clientY - cr.top  - pan.y) / zoom };
      };

      // Add an invisible 1×1 proxy node that follows the cursor.
      // Moving the edge to point at it gives us real-time Cytoscape rendering.
      const proxyId = `__boxes_drag_${Date.now()}__`;
      const proxyNode = this.cy.add({
        group: 'nodes',
        classes: 'boxes-drag-proxy',
        data: { id: proxyId },
        position: toGraph(startEvent.clientX, startEvent.clientY),
      });
      proxyNode.style({ opacity: 0, width: 1, height: 1, events: 'no' });

      // Redirect the dragged end to the proxy — edge renders in real-time.
      edge.move(end === 'source' ? { source: proxyId } : { target: proxyId });

      let currentTarget = null;

      const updateTarget = (node) => {
        if (currentTarget && (!node || !currentTarget.same(node))) {
          currentTarget.removeClass('eh-reconnect-target');
        }
        currentTarget = node || null;
        if (currentTarget) currentTarget.addClass('eh-reconnect-target');
      };

      const onMove = (e) => {
        const node = nodeAtClient(e.clientX, e.clientY);
        updateTarget(node);
        // Snap proxy to hovered node center, otherwise follow cursor exactly.
        proxyNode.position(node
          ? node.position()
          : toGraph(e.clientX, e.clientY));
      };

      const onUp = (e) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);

        const node = nodeAtClient(e.clientX, e.clientY);
        updateTarget(null);
        this._erActive = false;

        const finalNodeId = (node && !node.removed()) ? node.id() : originalNodeId;
        const moved = finalNodeId !== originalNodeId;

        if (moved) this._pushUndo();
        edge.move(end === 'source' ? { source: finalNodeId } : { target: finalNodeId });
        this.cy.remove(proxyNode);
        this._updateStylesheet();
        if (moved) {
          this._emit('edgeMoved', { edge: edge.json(), end, nodeId: finalNodeId });
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    this._erMouseoverEdge = (e) => showEdgeHandles(e.target);
    this._erMouseoutEdge  = (e) => {
      if (this._erActive) return;
      // Don't remove handles if the cursor is moving onto one of the handle divs.
      const related = e.originalEvent?.relatedTarget;
      const movingToHandle = related && this._erDivs.some(
        ({ div }) => div === related || div.contains(related)
      );
      if (!movingToHandle) removeEdgeHandles();
    };
    this._erRemoveOnZoom  = () => { if (!this._erActive) removeEdgeHandles(); };
    this._erRemoveEdgeHandles = removeEdgeHandles;

    this.cy.on('mouseover', 'edge', this._erMouseoverEdge);
    this.cy.on('mouseout',  'edge', this._erMouseoutEdge);
    this.cy.on('zoom pan',         this._erRemoveOnZoom);
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
    if (this._ehHandleDiv) {
      const div = this._ehHandleDiv;
      div.removeEventListener('mousedown', this._ehStartDrawing);
      if (div._moveHandler) div.removeEventListener('mousemove', div._moveHandler);
      div.parentNode?.removeChild(div);
      this._ehHandleDiv = null;
    }
    if (this._ehContainerMoveHandler) {
      this.cy.container()?.removeEventListener('mousemove', this._ehContainerMoveHandler);
      this._ehContainerMoveHandler = null;
    }
    // Edge reconnect handles
    if (this._erRemoveEdgeHandles) {
      this._erRemoveEdgeHandles();
      this._erRemoveEdgeHandles = null;
    }
    if (this._erMouseoverEdge) {
      this.cy.off('mouseover', 'edge', this._erMouseoverEdge);
      this._erMouseoverEdge = null;
    }
    if (this._erMouseoutEdge) {
      this.cy.off('mouseout', 'edge', this._erMouseoutEdge);
      this._erMouseoutEdge = null;
    }
    if (this._erRemoveOnZoom) {
      this.cy.off('zoom pan', this._erRemoveOnZoom);
      this._erRemoveOnZoom = null;
    }
    if (this._eh) {
      this._eh.destroy();
      this._eh = null;
    }
  }

  // ─── Context Pane ─────────────────────────────────────────────────────────

  _renderContextPane() {
    const el = this._contextEntriesEl;
    if (!el) return;
    const entries = Object.entries(this.context);

    const rowsHtml = entries.map(([key, val]) => {
      const isObj = typeof val === 'object' && val !== null;
      const keyEsc = this._esc(key);
      const valEl = isObj
        ? `<textarea class="bxe-ctx-val bxe-cell-input bxe-ctx-obj-val" rows="2" data-role="val" data-type="object">${this._esc(JSON.stringify(val, null, 2))}</textarea>`
        : `<input class="bxe-ctx-val bxe-cell-input" type="text" value="${this._esc(String(val))}" placeholder="namespace URI" data-role="val" data-type="string" />`;
      return `
        <div class="bxe-ctx-row" data-key="${keyEsc}">
          <input class="bxe-ctx-key bxe-cell-input" type="text" value="${keyEsc}" placeholder="key" data-role="key" />
          <span class="bxe-ctx-colon">:</span>
          ${valEl}
          <button class="bxe-btn-del" data-role="del" title="Remove">×</button>
        </div>`;
    }).join('');

    // Always show a blank row at the bottom for adding new entries.
    const blankRow = `
      <div class="bxe-ctx-row bxe-ctx-row-blank" data-key="">
        <input class="bxe-ctx-key bxe-cell-input" type="text" value="" placeholder="key" data-role="key" />
        <span class="bxe-ctx-colon">:</span>
        <input class="bxe-ctx-val bxe-cell-input" type="text" value="" placeholder="value or { JSON object }" data-role="val" data-type="auto" />
      </div>`;

    el.innerHTML = rowsHtml + blankRow;
  }

  _handleContextEvent(e) {
    const row = e.target.closest('.bxe-ctx-row');
    if (!row) return;
    const oldKey = row.dataset.key;
    const role = e.target.dataset.role;
    const valType = e.target.dataset.type;

    // ── Blank row commit (focusout when focus leaves the row entirely) ───────
    if (e.type === 'focusout' && oldKey === '') {
      if (e.relatedTarget && row.contains(e.relatedTarget)) return;
      const keyInput = row.querySelector('[data-role="key"]');
      const valInput = row.querySelector('[data-role="val"]');
      const newKey = keyInput?.value.trim();
      if (!newKey) return;
      const rawVal = valInput?.value || '';
      let val = rawVal;
      if (rawVal.trim().startsWith('{')) {
        try { val = JSON.parse(rawVal); } catch { /* keep as string */ }
      }
      this.context[newKey] = val;
      this._renderContextPane();
      this._emit('contextChanged', { context: { ...this.context } });
      return;
    }

    if (role === 'del') {
      delete this.context[oldKey];
      this._renderContextPane();
      this._emit('contextChanged', { context: { ...this.context } });

    } else if (role === 'key' && e.type === 'change') {
      const newKey = e.target.value.trim();
      if (!newKey || newKey === oldKey || !oldKey) { e.target.value = oldKey; return; }
      const rebuilt = {};
      for (const [k, v] of Object.entries(this.context)) rebuilt[k === oldKey ? newKey : k] = v;
      this.context = rebuilt;
      row.dataset.key = newKey;
      this._emit('contextChanged', { context: { ...this.context } });

    } else if (role === 'val' && e.type === 'change' && oldKey) {
      if (valType === 'object') {
        try {
          const parsed = JSON.parse(e.target.value);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Must be a JSON object');
          e.target.classList.remove('bxe-ctx-invalid');
          this.context[oldKey] = parsed;
          this._emit('contextChanged', { context: { ...this.context } });
        } catch {
          e.target.classList.add('bxe-ctx-invalid');
        }
      } else {
        this.context[oldKey] = e.target.value;
        this._emit('contextChanged', { context: { ...this.context } });
      }
    }
  }

  // ─── Layout Panel ─────────────────────────────────────────────────────────

  /**
   * Render the layout configuration UI into `targetEl`.
   */
  createLayoutPanel(targetEl) {
    if (!targetEl) return;
    this._destroyLayoutPanel();

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
.blp-row label { flex:0 0 auto;width:48%;font-size:12px;color:#555; }
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

    const paramsDiv = document.createElement('div');
    paramsDiv.className = 'blp-params';
    wrap.appendChild(paramsDiv);

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

    this._layoutPanelAlgoSel = algoSel;
    this._layoutPanelParamsDiv = paramsDiv;
  }

  /** Sync the panel UI to reflect the current _lastLayout */
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
