const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onClipboardUpdate: (callback) => ipcRenderer.on('clipboard-update', (event, data) => callback(data)),
  hideWindow: () => ipcRenderer.send('hide-window')
});