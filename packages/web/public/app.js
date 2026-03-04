import { BoxesEditor, defaultTemplates } from '/core/boxes-core.js';

let editor = null;
let currentFileName = 'graph.json';
let selectedElement = null;
let currentTemplate = null;
let currentTemplateId = 'blank';

// ─── Templates ───────────────────────────────────────────────────────────────

function loadTemplates() {
  const grid = document.getElementById('template-grid');
  grid.innerHTML = '';
  Object.keys(defaultTemplates).forEach(key => {
    const t = defaultTemplates[key];
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `<h3>${t.name}</h3><p>${t.description}</p>`;
    card.addEventListener('click', () => startWithTemplate(key));
    grid.appendChild(card);
  });
}

function startWithTemplate(templateId) {
  currentTemplateId = templateId;
  currentTemplate = defaultTemplates[templateId] || defaultTemplates['blank'];

  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('editor-container').classList.remove('hidden');
  document.getElementById('toolbar').classList.remove('hidden');
  document.getElementById('right-panel').classList.remove('hidden');

  const container = document.getElementById('editor-container');
  editor = new BoxesEditor(container, {
    elements: currentTemplate.elements,
    style: currentTemplate.style,
    nodeTypes: currentTemplate.nodeTypes || [],
    edgeTypes: currentTemplate.edgeTypes || [],
    layout: { name: 'preset' }
  });

  editor.createLayoutPanel(document.getElementById('pane-layout'));
  setupEditorEvents();
  renderStylesheet();
  renderPalette();
  renderEdgeTypes();
}

function setupEditorEvents() {
  editor.on('select', (evt) => {
    selectedElement = evt.target;
    showPropertyPanel(evt.target);
    switchTab('properties');
  });

  editor.on('unselect', () => {
    if (!editor.getSelected().length) {
      selectedElement = null;
      clearPropertyPanel();
    }
  });

  editor.on('stylesheetChanged', () => renderStylesheet());
  editor.on('historyChange', updateUndoRedoButtons);

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

// ─── Node Palette ─────────────────────────────────────────────────────────────

function renderPalette() {
  const container = document.getElementById('palette-items');
  const types = editor?.getNodeTypes() || [];
  if (!types.length) {
    container.innerHTML = '<div style="padding:10px;font-size:12px;color:#95a5a6">No types defined</div>';
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

// ─── Panel Tabs ───────────────────────────────────────────────────────────────

window.switchTab = function(tabName) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.panel-pane').forEach(p => p.classList.toggle('active', p.id === `pane-${tabName}`));
};

// ─── Element Property Panel ───────────────────────────────────────────────────

function showPropertyPanel(element) {
  const pane = document.getElementById('pane-properties');
  const isNode = element.isNode();
  const data = element.data();

  pane.innerHTML = `
    <h3>${isNode ? '🔵 Node' : '🔗 Edge'} Properties</h3>

    <div class="property-group">
      <label>ID</label>
      <input type="text" id="prop-id" value="${escHtml(data.id || '')}" readonly>
    </div>

    <div class="property-group">
      <label>Label</label>
      <input type="text" id="prop-label" value="${escHtml(data.label || '')}" placeholder="Enter label">
    </div>

    ${!isNode ? `
      <div class="property-group">
        <label>Source → Target</label>
        <input type="text" value="${escHtml(data.source)} → ${escHtml(data.target)}" readonly>
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

  document.getElementById('prop-label').addEventListener('input', () => {
    if (!selectedElement) return;
    editor.updateElement(selectedElement.id(), { label: document.getElementById('prop-label').value });
  });
}

function clearPropertyPanel() {
  document.getElementById('pane-properties').innerHTML =
    '<div class="empty-state"><p>Select a node or edge to edit its properties</p></div>';
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderCustomProperties(data) {
  const exclude = new Set(['id', 'label', 'source', 'target', '_style']);
  const props = Object.keys(data).filter(k => !exclude.has(k));
  if (!props.length) return '<tr class="no-props"><td colspan="3" style="color:#95a5a6;font-size:12px;padding:4px 2px;">No custom properties</td></tr>';
  return props.map(key => `
    <tr class="property-item" data-key="${escHtml(key)}">
      <td><input type="text" value="${escHtml(key)}" placeholder="key" onblur="commitPropertyKey(this)"></td>
      <td><textarea placeholder="value" oninput="updatePropertyValue(this)" rows="1">${escHtml(String(data[key] ?? ''))}</textarea></td>
      <td><button onclick="removePropertyRow(this)" title="Remove">×</button></td>
    </tr>
  `).join('');
}

window.addCustomProperty = function() {
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

window.commitPropertyKey = function(input) {
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

window.updatePropertyValue = function(textarea) {
  if (!selectedElement) return;
  const key = textarea.closest('tr')?.dataset.key;
  if (!key) return;
  editor.updateElement(selectedElement.id(), { [key]: textarea.value });
};

window.removePropertyRow = function(button) {
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

window.deleteElement = function() {
  if (!editor) return;
  const numSelected = editor.getSelected().length;
  if (numSelected > 0) {
    editor.removeSelected();
    selectedElement = null;
    clearPropertyPanel();
  } else if (selectedElement) {
    editor.removeElement(selectedElement.id());
    selectedElement = null;
    clearPropertyPanel();
  }
};

// ─── Stylesheet Editor ────────────────────────────────────────────────────────

function renderStylesheet() {
  if (!editor) return;
  const rules = editor.getStylesheet();
  const container = document.getElementById('stylesheet-rules');
  if (!rules.length) {
    container.innerHTML = '<div class="empty-state"><p>No style rules yet.<br>Add one below.</p></div>';
    return;
  }
  container.innerHTML = rules.map((rule, ruleIdx) => {
    const props = Object.entries(rule.style);
    const propsHtml = props.map(([prop, val]) => `
      <div class="style-prop-row">
        <input type="text" value="${escHtml(prop)}" placeholder="property"
          data-rule="${ruleIdx}" data-prop="${escHtml(prop)}" data-field="key"
          onchange="updateStylePropKey(this)">
        <input type="text" value="${escHtml(val)}" placeholder="value"
          data-rule="${ruleIdx}" data-prop="${escHtml(prop)}" data-field="val"
          onchange="updateStylePropVal(this)">
        <button class="btn-icon danger" title="Remove property"
          onclick="removeStyleProp(${ruleIdx}, '${escHtml(prop)}')">×</button>
      </div>
    `).join('');

    return `
      <div class="style-rule-card" data-rule="${ruleIdx}">
        <div class="style-rule-header">
          <input class="style-rule-selector" type="text" value="${escHtml(rule.selector)}"
            placeholder="selector (e.g. node, edge, node[label])"
            data-rule="${ruleIdx}" onchange="updateStyleSelector(this)">
          <button class="btn-icon danger" title="Delete rule"
            onclick="removeStyleRule(${ruleIdx})">🗑</button>
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
  if (!editor) return;
  editor.removeStyleRule(index);
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
  const rule = rules[ruleIdx];
  editor.updateStyleRule(ruleIdx, rule.selector, { ...rule.style, [key]: val });
};

window.updateStylePropKey = function(input) {
  if (!editor) return;
  const idx = parseInt(input.dataset.rule);
  const oldKey = input.dataset.prop;
  const newKey = input.value.trim();
  if (!newKey || newKey === oldKey) return;
  const rules = editor.getStylesheet();
  const style = { ...rules[idx].style };
  const val = style[oldKey];
  delete style[oldKey];
  style[newKey] = val;
  editor.updateStyleRule(idx, rules[idx].selector, style);
};

window.updateStylePropVal = function(input) {
  if (!editor) return;
  const idx = parseInt(input.dataset.rule);
  const prop = input.dataset.prop;
  const rules = editor.getStylesheet();
  const style = { ...rules[idx].style, [prop]: input.value };
  editor.updateStyleRule(idx, rules[idx].selector, style);
};

window.removeStyleProp = function(ruleIdx, prop) {
  if (!editor) return;
  const rules = editor.getStylesheet();
  const style = { ...rules[ruleIdx].style };
  delete style[prop];
  editor.updateStyleRule(ruleIdx, rules[ruleIdx].selector, style);
};

// ─── Context Menu ─────────────────────────────────────────────────────────────

function showContextMenu(x, y, element) {
  const menu = document.getElementById('context-menu');
  const isNode = element.isNode();
  menu.innerHTML = `
    <div class="context-menu-item" onclick="editElement()">Edit Properties</div>
    ${isNode ? `
      <div class="context-menu-item" onclick="addEdgeFromNode()">Add Edge From Here</div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" onclick="duplicateNode()">Duplicate</div>
    ` : ''}
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

window.editElement = function() {
  if (selectedElement) { showPropertyPanel(selectedElement); switchTab('properties'); }
  hideContextMenu();
};

window.addEdgeFromNode = function() {
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

window.duplicateNode = function() {
  if (!selectedElement?.isNode()) return;
  const data = { ...selectedElement.data() };
  delete data.id;
  data.id = `n${Date.now()}`;
  data.label = (data.label || 'Node') + ' (copy)';
  const pos = selectedElement.position();
  editor.addNode(data, { x: pos.x + 50, y: pos.y + 50 });
  hideContextMenu();
};

window.addNodeAt = function(x, y) {
  editor.addNode({ id: `n${Date.now()}`, label: 'New Node' }, { x, y });
  hideContextMenu();
};

// ─── File Operations ──────────────────────────────────────────────────────────

function saveToFile() {
  if (!editor) { alert('No graph to save'); return; }
  const graphData = editor.exportGraph();
  graphData.templateId = currentTemplateId;
  const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFileName;
  a.click();
  URL.revokeObjectURL(url);
}

function loadFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const graphData = JSON.parse(e.target.result);
      const templateId = graphData.templateId || 'blank';
      // Always (re)create editor with the correct template so palette and types are restored
      if (editor) { editor.destroy(); editor = null; }
      startWithTemplate(templateId);
      editor.importGraph(graphData);
      currentFileName = file.name;
      renderStylesheet();
      renderPalette();
      renderEdgeTypes();
    } catch (err) {
      alert('Failed to load file: Invalid JSON');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

document.getElementById('new-btn').addEventListener('click', () => {
  if (confirm('Create a new graph? Current graph will be cleared.')) {
    if (editor) editor.destroy();
    editor = null; selectedElement = null; currentFileName = 'graph.json'; currentTemplate = null;
    document.getElementById('welcome-screen').classList.remove('hidden');
    document.getElementById('editor-container').classList.add('hidden');
    document.getElementById('toolbar').classList.add('hidden');
    document.getElementById('right-panel').classList.add('hidden');
    updateUndoRedoButtons();
  }
});

document.getElementById('open-btn').addEventListener('click', () => document.getElementById('file-input').click());

document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) loadFromFile(e.target.files[0]);
  e.target.value = '';
});

document.getElementById('save-btn').addEventListener('click', saveToFile);

document.getElementById('add-node-btn').addEventListener('click', () => {
  if (!editor) return;
  const pan = editor.cy.pan(), zoom = editor.cy.zoom();
  editor.addNode({ id: `n${Date.now()}`, label: 'New Node' }, {
    x: (-pan.x + window.innerWidth / 2) / zoom,
    y: (-pan.y + window.innerHeight / 2) / zoom
  });
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

document.getElementById('export-btn').addEventListener('click', saveToFile);

// Sync link-type selector → core edge type
document.getElementById('link-type-select').addEventListener('change', (e) => {
  editor?.setEdgeType(e.target.value);
});

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (!undoBtn || !redoBtn) return;
  undoBtn.disabled = !editor?.canUndo();
  redoBtn.disabled = !editor?.canRedo();
}

document.getElementById('undo-btn')?.addEventListener('click', () => {
  editor?.undo();
});
document.getElementById('redo-btn')?.addEventListener('click', () => {
  editor?.redo();
});

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToFile(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); document.getElementById('file-input').click(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); document.getElementById('new-btn').click(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); editor?.undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); editor?.redo(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && editor) {
    // Only fire if not typing in an input/textarea
    const tag = document.activeElement?.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      window.deleteElement();
    }
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
loadTemplates();
