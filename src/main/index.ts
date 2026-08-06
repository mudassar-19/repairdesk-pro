import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from './db/client'
import { seedDevData } from './db/seed'
import { runRepositorySelfTest } from './db/devSelfTest'
import { runDateBoundarySelfTest } from './db/dateBoundarySelfTest'
import { registerSystemIpc } from './ipc/system'
import { registerAuthIpc } from './ipc/auth'
import { registerActivityIpc } from './ipc/activity'
import { registerCustomersIpc } from './ipc/customers'
import { registerRepairsIpc } from './ipc/repairs'
import { registerDashboardIpc } from './ipc/dashboard'
import { registerPaymentsIpc } from './ipc/payments'
import { registerExpensesIpc } from './ipc/expenses'
import { registerReportsIpc } from './ipc/reports'
import { registerPrintIpc } from './ipc/print'
import { registerAnalyticsIpc } from './ipc/analytics'
import { registerBackupIpc } from './ipc/backup'
import { registerGoogleDriveIpc } from './ipc/googleDrive'
import { maybeRunAutomaticBackup } from './db/services/backupService'
import { registerSettingsIpc } from './ipc/settings'
import { registerUdhaarIpc } from './ipc/udhaar'

/** Re-checked on this cadence while the app stays open — a startup-only check
 * would never fire again for a shop that leaves the app running for days. */
const AUTO_BACKUP_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
let autoBackupTimer: ReturnType<typeof setInterval> | null = null

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    // Window/taskbar icon while the app is running (macOS ignores this —
    // its Dock icon comes from the packaged app bundle instead, set via
    // electron-builder's mac.icon in package.json). icon.png is copied
    // next to this compiled file by copyIconPlugin (electron.vite.config.ts)
    // for both dev and packaged builds.
    icon: path.join(__dirname, 'icon.png'),
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
  registerRepairsIpc()
  registerDashboardIpc()
  registerPaymentsIpc()
  registerExpensesIpc()
  registerReportsIpc()
  registerPrintIpc()
  registerAnalyticsIpc()
  registerBackupIpc()
  registerGoogleDriveIpc()
  registerSettingsIpc()
  registerUdhaarIpc()

  if (is.dev) {
    seedDevData(db)
    runRepositorySelfTest(db)
    runDateBoundarySelfTest(db)
  }

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  // Fire-and-forget, after the window is already showing — never delay the
  // user seeing their dashboard for a backup check. The interval catches
  // long-running sessions the one-time startup check alone would miss.
  maybeRunAutomaticBackup().catch(() => {})
  autoBackupTimer = setInterval(() => {
    maybeRunAutomaticBackup().catch(() => {})
  }, AUTO_BACKUP_CHECK_INTERVAL_MS)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (autoBackupTimer) clearInterval(autoBackupTimer)
})
