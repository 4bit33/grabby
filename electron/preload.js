const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  close: () => ipcRenderer.send('close'),
  runCommand: (cmd) => ipcRenderer.invoke('run-command', cmd),
  checkYtDlp: () => ipcRenderer.invoke('check-ytdlp'),
});
