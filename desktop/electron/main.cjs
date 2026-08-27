const { app, BrowserWindow, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('node:path')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'Cloe - Financiación propia',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devServerUrl = process.env.ELECTRON_START_URL

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Actualización manual disparada desde un botón en el perfil de admin (no
// chequeo automático al abrir) -- así el negocio controla cuándo se aplica
// un cambio, en vez de que la app se actualice sola a mitad de una venta.
function sendUpdateStatus(status, payload) {
  mainWindow?.webContents.send('update-status', { status, ...payload })
}

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = false

autoUpdater.on('update-available', (info) => sendUpdateStatus('available', { version: info.version }))
autoUpdater.on('update-not-available', () => sendUpdateStatus('not-available'))
autoUpdater.on('download-progress', (progress) => sendUpdateStatus('downloading', { percent: progress.percent }))
autoUpdater.on('update-downloaded', () => sendUpdateStatus('downloaded'))
autoUpdater.on('error', (err) => sendUpdateStatus('error', { message: err?.message || String(err) }))

ipcMain.handle('check-for-update', async () => {
  if (!app.isPackaged) {
    sendUpdateStatus('error', { message: 'La búsqueda de actualizaciones solo funciona en la app instalada, no en modo desarrollo.' })
    return
  }
  sendUpdateStatus('checking')
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    sendUpdateStatus('error', { message: err?.message || String(err) })
  }
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})
