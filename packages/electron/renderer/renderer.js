// Cytoscape is loaded as a global via the script tag in index.html.
// We import BoxesEditor from the built core package (resolved by electron's file loader).
import { BoxesEditor, defaultTemplates } from '../../core/dist/boxes-core.js';

let editor = null;
let selectedElement = null;
let currentTemplate = null;
let currentTemplateId = 'blank';

// ─── Templates ───────────────────────────────────────────────────────────────

async function loadTemplates() {
  const customTemplates = await window.electronAPI.getTemplates().catch(() => []);

  const builtIn = Object.keys(defaultTemplates).map(key => ({
    id: key,
    name: defaultTemplates[key].name,
    description: defaultTemplates[key].description,
    isBuiltIn: true
  }));

  const all = [...builtIn, ...customTemplates];

  const grid = document.getElementById('template-grid');
  grid.innerHTML = '';
  all.forEach(t => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `<h3>${t.name}</h3><p>${t.description || ''}</p>`;
    card.addEventListener('click', () => startWithTemplate(t.id, t.isBuiltIn ? null : t));
    grid.appendChild(card);
  });
}

function startWithTemplate(templateId, customTemplate = null) {
  currentTemplateId = templateId;
  currentTemplate = customTemplate || defaultTemplates[templateId] || defaultTemplates['blank'];

  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('editor-container').classList.remove('hidden');
  document.getElementById('toolbar').classList.remove('hidden');
  document.getElementById('right-panel').classList.add('show');
  document.getElementById('left-panel').classList.add('show');

  const container = document.getElementById('editor-container');
  editor = new BoxesEditor(container, {
    elements: currentTemplate.elements || { nodes: [], edges: [] },
    style: currentTemplate.style || [],
    nodeTypes: currentTemplate.nodeTypes || [],
    edgeTypes: currentTemplate.edgeTypes || [],
    layout: { name: 'preset' }
  });

  setupEditorEvents();
  renderStylesheet();
  renderPalette();
  renderEdgeTypes();
}

// ─── Editor Events ────────────────────────────────────────────────────────────

function setupEditorEvents() {
  editor.on('change', () => window.electronAPI.notifyGraphChanged());
  editor.on('nodeAdded', () => window.electronAPI.notifyGraphChanged());
  editor.on('edgeAdded', () => window.electronAPI.notifyGraphChanged());
  editor.on('elementRemoved', () => window.electronAPI.notifyGraphChanged());
  editor.on('elementUpdated', () => window.electronAPI.notifyGraphChanged());

  editor.on('select', (evt) => {
    selectedElement = evt.target;
    showPropertyPanel(evt.target);
    switchTab('properties');
  });

  editor.on('stylesheetChanged', () => renderStylesheet());

  editor.on('unselect', () => {
    if (!editor.getSelected().length) {
      selectedElement = null;
      hidePropertyPanel();
    }
  });

  editor.cy.on('cxttap', 'node,edge', (evt) => {
    evt.preventDefault();
    showContextMenu(evt.originalEvent.clientX, evt.originalEvent.clientY, evt.target);
  });

  editor.cy.on('cxttap', (evt) => {
    if (evt.target === editor.cy) {
      evt.preventDefault();
      showBackgroundContextMenu(evt.originalEvent.clientX, evt.originalEvent.clientY, evt.position);
    }
  });

  editor.cy.on('tap', () => hideContextMenu());
}

// ─── Property Panel ───────────────────────────────────────────────────────────

function showPropertyPanel(element) {
  const panel = document.getElementById('pane-properties');
  const isNode = element.isNode();
  const data = element.data();

  panel.innerHTML = `
    <h3>${isNode ? '🔵 Node' : '🔗 Edge'} Properties</h3>

    <div class="property-group">
      <label>ID</label>
      <input type="text" id="prop-id" value="${data.id || ''}" readonly>
    </div>

    <div class="property-group">
      <label>Label</label>
      <input type="text" id="prop-label" value="${data.label || ''}" placeholder="Enter label">
    </div>

    ${!isNode ? `
      <div class="property-group">
        <label>Source → Target</label>
        <input type="text" value="${data.source} → ${data.target}" readonly>
      </div>
    ` : ''}

    <div class="property-group">
      <label>Custom Properties</label>
      <div class="property-table-wrap">
        <table class="property-table">
          <colgroup><col class="col-key"><col class="col-val"><col class="col-del"></colgroup>
          <tbody id="custom-props">${renderCustomProperties(data)}</tbody>
        </table>
      </div>
      <button class="btn-add-property" onclick="addCustomProperty()">+ Add Property</button>
    </div>

    <div class="property-actions">
      <button class="btn-danger" onclick="deleteElement()">Delete</button>
    </div>
  `;

  panel.classList.add('show');

  document.getElementById('prop-label').addEventListener('input', () => {
    if (!selectedElement) return;
    editor.updateElement(selectedElement.id(), { label: document.getElementById('prop-label').value });
  });
}

function hidePropertyPanel() {
  const panel = document.getElementById('pane-properties');
  panel.innerHTML = '<div class="empty-state"><p>Select a node or edge to edit its properties</p></div>';
}

function renderCustomProperties(data) {
  const exclude = new Set(['id', 'label', 'source', 'target', '_style']);
  const props = Object.keys(data).filter(k => !exclude.has(k));
  if (!props.length) return '<tr class="no-props"><td colspan="3" style="color:#95a5a6;font-size:12px;padding:4px 2px;">No custom properties</td></tr>';
  return props.map(key => `
    <tr class="property-item" data-key="${key}">
      <td><input type="text" value="${key}" placeholder="key" onblur="commitPropertyKey(this)"></td>
      <td><textarea placeholder="value" oninput="updatePropertyValue(this)" rows="1">${String(data[key] ?? '')}</textarea></td>
      <td><button onclick="removePropertyRow(this)" title="Remove">×</button></td>
    </tr>
  `).join('');
}

window.addCustomProperty = function () {
  if (!selectedElement) return;
  const tbody = document.getElementById('custom-props');
  if (!tbody) return;
  const noProps = tbody.querySelector('.no-props');
  if (noProps) noProps.remove();
  const tr = document.createElement('tr');
  tr.className = 'property-item';
  tr.dataset.key = '';
  tr.innerHTML = `
    <td><input type="text" value="" placeholder="key" onblur="commitPropertyKey(this)"></td>
    <td><textarea placeholder="value" oninput="updatePropertyValue(this)" rows="1"></textarea></td>
    <td><button onclick="removePropertyRow(this)" title="Remove">×</button></td>
  `;
  tbody.appendChild(tr);
  tr.querySelector('input').focus();
};

window.commitPropertyKey = function (input) {
  if (!selectedElement) return;
  const tr = input.closest('tr');
  const oldKey = tr.dataset.key;
  const newKey = input.value.trim();
  if (!newKey) return;
  const textarea = tr.querySelector('textarea');
  const value = textarea ? textarea.value : '';
  if (oldKey && oldKey !== newKey) {
    editor.updateElement(selectedElement.id(), { [oldKey]: undefined, [newKey]: value });
  } else if (!oldKey) {
    editor.updateElement(selectedElement.id(), { [newKey]: value });
  }
  tr.dataset.key = newKey;
};

window.updatePropertyValue = function (textarea) {
  if (!selectedElement) return;
  const key = textarea.closest('tr')?.dataset.key;
  if (!key) return;
  editor.updateElement(selectedElement.id(), { [key]: textarea.value });
};

window.removePropertyRow = function (button) {
  if (!selectedElement) return;
  const tr = button.closest('tr');
  const key = tr.dataset.key;
  if (key) editor.updateElement(selectedElement.id(), { [key]: undefined });
  tr.remove();
  const tbody = document.getElementById('custom-props');
  if (tbody && !tbody.querySelector('.property-item')) {
    tbody.innerHTML = '<tr class="no-props"><td colspan="3" style="color:#95a5a6;font-size:12px;padding:4px 2px;">No custom properties</td></tr>';
  }
};

window.deleteElement = function () {
  if (!selectedElement) return;
  if (confirm('Delete this element?')) {
    editor.removeElement(selectedElement.id());
    selectedElement = null;
    hidePropertyPanel();
  }
};

// ─── Node Palette ─────────────────────────────────────────────────────────────

function renderPalette() {
  const container = document.getElementById('palette-items');
  const types = editor?.getNodeTypes() || [];
  if (!types.length) {
    container.innerHTML = '<div style="padding:8px;font-size:11px;color:#95a5a6">No types</div>';
    return;
  }
  container.innerHTML = types.map(type => {
    const radius = type.shape === 'ellipse' ? '50%' : type.shape === 'roundrectangle' ? '5px' : '2px';
    return `<div class="palette-item" onclick="addNodeOfType('${escHtml(type.id)}')" title="Add ${escHtml(type.label)}">
      <div class="palette-swatch" style="background:${type.color};border-color:${type.borderColor};border-radius:${radius}"></div>
      <span class="palette-label">${escHtml(type.label)}</span>
    </div>`;
  }).join('');
}

window.addNodeOfType = function(typeId) {
  editor?.addNodeOfType(typeId);
};

function renderEdgeTypes() {
  const select = document.getElementById('link-type-select');
  if (!select) return;
  const types = editor?.getEdgeTypes() || [{ id: 'default', label: 'edge' }];
  select.innerHTML = types.map(t => `<option value="${escHtml(t.id)}">${escHtml(t.label)}</option>`).join('');
  const cur = editor?.getEdgeType();
  if (cur) select.value = cur.id;
}

// ─── Panel Tabs & Stylesheet Editor ──────────────────────────────────────────

window.switchTab = function(tabName) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.panel-pane').forEach(p => p.classList.toggle('active', p.id === `pane-${tabName}`));
};

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderStylesheet() {
  if (!editor) return;
  const rules = editor.getStylesheet();
  const container = document.getElementById('stylesheet-rules');
  if (!rules.length) {
    container.innerHTML = '<div class="empty-state"><p>No style rules yet.<br>Add one below.</p></div>';
    return;
  }
  container.innerHTML = rules.map((rule, ruleIdx) => {
    const propsHtml = Object.entries(rule.style).map(([prop, val]) => `
      <div class="style-prop-row">
        <input type="text" value="${escHtml(prop)}" placeholder="property"
          data-rule="${ruleIdx}" data-prop="${escHtml(prop)}" data-field="key"
          onchange="updateStylePropKey(this)">
        <input type="text" value="${escHtml(val)}" placeholder="value"
          data-rule="${ruleIdx}" data-prop="${escHtml(prop)}" data-field="val"
          onchange="updateStylePropVal(this)">
        <button class="btn-icon danger" onclick="removeStyleProp(${ruleIdx}, '${escHtml(prop)}')">×</button>
      </div>
    `).join('');
    return `
      <div class="style-rule-card">
        <div class="style-rule-header">
          <input class="style-rule-selector" type="text" value="${escHtml(rule.selector)}"
            placeholder="selector (e.g. node, edge)" data-rule="${ruleIdx}"
            onchange="updateStyleSelector(this)">
          <button class="btn-icon danger" onclick="removeStyleRule(${ruleIdx})">🗑</button>
        </div>
        <div class="style-rule-props">
          ${propsHtml}
          <button class="btn-add-prop" onclick="addStyleProp(${ruleIdx})">+ property</button>
        </div>
      </div>
    `;
  }).join('');
}

window.addStyleRule = function() {
  if (!editor) return;
  editor.addStyleRule('node', {});
  switchTab('stylesheet');
};

window.removeStyleRule = function(index) {
  if (editor) editor.removeStyleRule(index);
};

window.updateStyleSelector = function(input) {
  if (!editor) return;
  const idx = parseInt(input.dataset.rule);
  const rules = editor.getStylesheet();
  editor.updateStyleRule(idx, input.value, rules[idx].style);
};

window.addStyleProp = function(ruleIdx) {
  if (!editor) return;
  const key = prompt('CSS property name (e.g. background-color):');
  if (!key) return;
  const val = prompt(`Value for "${key}":`) ?? '';
  const rules = editor.getStylesheet();
  editor.updateStyleRule(ruleIdx, rules[ruleIdx].selector, { ...rules[ruleIdx].style, [key]: val });
};

window.updateStylePropKey = function(input) {
  if (!editor) return;
  const idx = parseInt(input.dataset.rule);
  const oldKey = input.dataset.prop, newKey = input.value.trim();
  if (!newKey || newKey === oldKey) return;
  const rules = editor.getStylesheet();
  const style = { ...rules[idx].style };
  const val = style[oldKey]; delete style[oldKey]; style[newKey] = val;
  editor.updateStyleRule(idx, rules[idx].selector, style);
};

window.updateStylePropVal = function(input) {
  if (!editor) return;
  const idx = parseInt(input.dataset.rule);
  const rules = editor.getStylesheet();
  editor.updateStyleRule(idx, rules[idx].selector, { ...rules[idx].style, [input.dataset.prop]: input.value });
};

window.removeStyleProp = function(ruleIdx, prop) {
  if (!editor) return;
  const rules = editor.getStylesheet();
  const style = { ...rules[ruleIdx].style }; delete style[prop];
  editor.updateStyleRule(ruleIdx, rules[ruleIdx].selector, style);
};

// ─── Context Menu ─────────────────────────────────────────────────────────────

function showContextMenu(x, y, element) {
  const menu = document.getElementById('context-menu');
  const isNode = element.isNode();
  menu.innerHTML = `
    <div class="context-menu-item" onclick="editElement()">Edit Properties</div>
    ${isNode ? `<div class="context-menu-item" onclick="startEdgeFrom()">Add Edge From Here</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" onclick="duplicateNode()">Duplicate</div>` : ''}
    <div class="context-menu-separator"></div>
    <div class="context-menu-item danger" onclick="deleteElement()">Delete</div>
  `;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('show');
  selectedElement = element;
  setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 100);
}

function showBackgroundContextMenu(x, y, position) {
  const menu = document.getElementById('context-menu');
  menu.innerHTML = `<div class="context-menu-item" onclick="addNodeAt(${position.x}, ${position.y})">Add Node Here</div>`;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('show');
  setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 100);
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.remove('show');
}

window.editElement = function () {
  if (selectedElement) showPropertyPanel(selectedElement);
  hideContextMenu();
};

window.startEdgeFrom = function () {
  if (!selectedElement?.isNode()) return;
  const sourceId = selectedElement.id();
  alert('Click on another node to connect with an edge');
  const handler = (evt) => {
    if (evt.target.isNode && evt.target.isNode() && evt.target.id() !== sourceId) {
      editor.addEdge(sourceId, evt.target.id(), { label: '' });
      editor.cy.off('tap', 'node', handler);
    }
  };
  editor.cy.on('tap', 'node', handler);
  hideContextMenu();
};

window.duplicateNode = function () {
  if (!selectedElement?.isNode()) return;
  const data = { ...selectedElement.data() };
  delete data.id;
  data.id = `n${Date.now()}`;
  data.label = (data.label || 'Node') + ' (copy)';
  const pos = selectedElement.position();
  editor.addNode(data, { x: pos.x + 50, y: pos.y + 50 });
  hideContextMenu();
};

window.addNodeAt = function (x, y) {
  editor.addNode({ id: `n${Date.now()}`, label: 'New Node' }, { x, y });
  hideContextMenu();
};

// ─── Toolbar ──────────────────────────────────────────────────────────────────

document.getElementById('add-node-btn').addEventListener('click', () => {
  if (!editor) return;
  const pan = editor.cy.pan();
  const zoom = editor.cy.zoom();
  const x = (-pan.x + window.innerWidth / 2) / zoom;
  const y = (-pan.y + window.innerHeight / 2) / zoom;
  editor.addNode({ id: `n${Date.now()}`, label: 'New Node' }, { x, y });
});

document.getElementById('add-edge-btn').addEventListener('click', () => {
  if (!editor) return;
  const sel = editor.getSelected().filter(el => el.isNode());
  if (sel.length === 2) {
    editor.addEdge(sel[0].id(), sel[1].id(), { label: '' });
  } else {
    alert('Select exactly 2 nodes to create an edge');
  }
});

document.getElementById('run-layout-btn').addEventListener('click', () => {
  if (!editor) return;
  editor.runLayout({ name: document.getElementById('layout-select').value });
});

// Sync link-type selector → core edge type
document.getElementById('link-type-select').addEventListener('change', (e) => {
  editor?.setEdgeType(e.target.value);
});

// ─── Delete key ───────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' && selectedElement) {
    window.deleteElement();
  }
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

window.electronAPI.onMenuNew(() => {
  if (confirm('Create a new graph? Unsaved changes will be lost.')) {
    if (editor) { editor.destroy(); editor = null; }
    selectedElement = null;
    document.getElementById('welcome-screen').style.display = '';
    document.getElementById('editor-container').classList.add('hidden');
    document.getElementById('toolbar').classList.add('hidden');
    document.getElementById('right-panel').classList.remove('show');
    hidePropertyPanel();
  }
});

window.electronAPI.onFileOpened((graphData) => {
  const templateId = graphData.templateId || 'blank';
  if (editor) { editor.destroy(); editor = null; }
  startWithTemplate(templateId);
  editor.importGraph(graphData);
  renderStylesheet();
  renderPalette();
  renderEdgeTypes();
});

window.electronAPI.onRequestGraphData(() => {
  if (editor) {
    const graphData = editor.exportGraph();
    graphData.templateId = currentTemplateId;
    window.electronAPI.sendGraphData(graphData);
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
loadTemplates();
