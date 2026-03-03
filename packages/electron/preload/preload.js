const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuNew: (callback) => ipcRenderer.on('menu-new', callback),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
  onRequestGraphData: (callback) => ipcRenderer.on('request-graph-data', callback),
  onFileSaved: (callback) => ipcRenderer.on('file-saved', callback),
  sendGraphData: (data) => ipcRenderer.send('graph-data', data),
  notifyGraphChanged: () => ipcRenderer.send('graph-changed'),
  getTemplates: () => ipcRenderer.invoke('get-templates')
});
