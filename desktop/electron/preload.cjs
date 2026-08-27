const { contextBridge, ipcRenderer } = require('electron')

// contextIsolation queda activo por seguridad estándar de Electron -- solo
// se expone esta API mínima de actualización, nada de Node al renderer.
contextBridge.exposeInMainWorld('electronAPI', {
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
})
