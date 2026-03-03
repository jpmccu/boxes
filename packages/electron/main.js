const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;
let currentFilePath = null;
let hasUnsavedChanges = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('renderer/index.html');

  // Create menu
  createMenu();

  mainWindow.on('close', (e) => {
    if (hasUnsavedChanges) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Save', 'Don\'t Save', 'Cancel'],
        title: 'Unsaved Changes',
        message: 'Do you want to save the changes to your graph?'
      });

      if (choice === 0) { // Save
        e.preventDefault();
        saveFile().then(() => {
          hasUnsavedChanges = false;
          mainWindow.close();
        });
      } else if (choice === 2) { // Cancel
        e.preventDefault();
      }
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new');
          }
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: openFile
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: saveFile
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: saveFileAs
        },
        { type: 'separator' },
        {
          label: 'Exit',
          role: 'quit'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Boxes Files', extensions: ['boxes', 'json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const graphData = JSON.parse(content);
      
      currentFilePath = filePath;
      hasUnsavedChanges = false;
      
      mainWindow.webContents.send('file-opened', graphData);
      mainWindow.setTitle(`Boxes - ${path.basename(filePath)}`);
    } catch (error) {
      dialog.showErrorBox('Error Opening File', error.message);
    }
  }
}

async function saveFile() {
  if (!currentFilePath) {
    return saveFileAs();
  }

  try {
    const graphData = await new Promise((resolve) => {
      mainWindow.webContents.send('request-graph-data');
      ipcMain.once('graph-data', (event, data) => {
        resolve(data);
      });
    });

    await fs.writeFile(currentFilePath, JSON.stringify(graphData, null, 2));
    hasUnsavedChanges = false;
    mainWindow.webContents.send('file-saved');
  } catch (error) {
    dialog.showErrorBox('Error Saving File', error.message);
  }
}

async function saveFileAs() {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Boxes Files', extensions: ['boxes'] },
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    currentFilePath = result.filePath;
    await saveFile();
    mainWindow.setTitle(`Boxes - ${path.basename(currentFilePath)}`);
  }
}

// IPC handlers
ipcMain.on('graph-changed', () => {
  hasUnsavedChanges = true;
  const title = currentFilePath 
    ? `Boxes - ${path.basename(currentFilePath)} •`
    : 'Boxes - Untitled •';
  mainWindow.setTitle(title);
});

ipcMain.handle('get-templates', async () => {
  const templatesPath = path.join(__dirname, 'templates');
  try {
    const files = await fs.readdir(templatesPath);
    const templates = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(templatesPath, file), 'utf-8');
        const template = JSON.parse(content);
        templates.push({
          id: path.basename(file, '.json'),
          ...template
        });
      }
    }
    
    return templates;
  } catch (error) {
    console.error('Error loading templates:', error);
    return [];
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
