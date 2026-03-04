import { BoxesEditor, defaultTemplates } from '/core/boxes-core.js';

let editor = null;
let currentFileName = 'graph.json';
let currentTemplateId = 'blank';

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
  const currentTemplate = defaultTemplates[templateId] || defaultTemplates['blank'];

  document.getElementById('welcome-screen').classList.add('d-none');
  document.getElementById('editor-container').classList.remove('d-none');

  if (editor) { editor.destroy(); editor = null; }
  const container = document.getElementById('editor-container');
  editor = new BoxesEditor(container, {
    elements: currentTemplate.elements,
    style: currentTemplate.style,
    nodeTypes: currentTemplate.nodeTypes || [],
    edgeTypes: currentTemplate.edgeTypes || [],
    layout: { name: 'preset' }
  });
}

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
      startWithTemplate(templateId);
      editor.importGraph(graphData);
      currentFileName = file.name;
    } catch (err) {
      alert('Failed to load file: Invalid JSON');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

document.getElementById('new-btn').addEventListener('click', () => {
  if (confirm('Create a new graph? Current graph will be cleared.')) {
    if (editor) { editor.destroy(); editor = null; }
    currentFileName = 'graph.json';
    document.getElementById('editor-container').classList.add('d-none');
    document.getElementById('welcome-screen').classList.remove('d-none');
  }
});

document.getElementById('open-btn').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) loadFromFile(e.target.files[0]);
  e.target.value = '';
});
document.getElementById('save-btn').addEventListener('click', saveToFile);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToFile(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); document.getElementById('file-input').click(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); document.getElementById('new-btn').click(); }
});

loadTemplates();
