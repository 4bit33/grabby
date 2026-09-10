const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  close: () => ipcRenderer.send('close'),
  // Accepts string (legacy) or { bin, args } (preferred). Optional requestId as 2nd arg.
  runCommand: (payload, requestId) => ipcRenderer.invoke('run-command', payload, requestId),
  cancelCommand: (requestId) => ipcRenderer.invoke('cancel-command', requestId),
  getDownloadsDir: () => ipcRenderer.invoke('get-downloads-dir'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  checkYtDlp: () => ipcRenderer.invoke('check-ytdlp'),
  updateYtDlp: () => ipcRenderer.invoke('update-ytdlp'),
  checkAppUpdate: () => ipcRenderer.invoke('check-app-update'),
  readFileAsDataURL: (filePath) => ipcRenderer.invoke('read-file-as-dataurl', filePath),
  // Returns unsubscribe function for a specific listener (Phase 1 C4).
  onDownloadProgress: (callback) => {
    const wrapped = (event, data) => callback(data);
    ipcRenderer.on('download-progress', wrapped);
    return () => {
      ipcRenderer.removeListener('download-progress', wrapped);
    };
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  }
});
