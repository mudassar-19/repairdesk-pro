import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from './db/client'
import { seedDevData } from './db/seed'
import { runRepositorySelfTest } from './db/devSelfTest'
import { registerSystemIpc } from './ipc/system'
import { registerAuthIpc } from './ipc/auth'
import { registerActivityIpc } from './ipc/activity'
import { registerCustomersIpc } from './ipc/customers'

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Keep external links out of the app window.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const db = initDatabase()
  registerSystemIpc()
  registerAuthIpc()
  registerActivityIpc()
  registerCustomersIpc()

  if (is.dev) {
    seedDevData(db)
    runRepositorySelfTest(db)
  }

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
