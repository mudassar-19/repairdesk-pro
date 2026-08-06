import { ipcMain, dialog, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getDatabase } from '../db/client'
import {
  SettingsRepository,
  type BrandingSettings,
  type ReceiptSettings,
  type BackupSettings
} from '../db/repositories/settingsRepository'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

function getBrandingDir(): string {
  const dir = path.join(app.getPath('userData'), 'branding')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export interface PickLogoResult {
  success: boolean
  logoPath?: string
  error?: string
}

export function registerSettingsIpc(): void {
  const repo = () => new SettingsRepository(getDatabase())

  ipcMain.handle('settings:getBranding', (): BrandingSettings => repo().getBranding())
  ipcMain.handle(
    'settings:setBranding',
    (_event, patch: Partial<BrandingSettings>): BrandingSettings => repo().setBranding(patch)
  )

  ipcMain.handle('settings:getReceiptSettings', (): ReceiptSettings => repo().getReceiptSettings())
  ipcMain.handle(
    'settings:setReceiptSettings',
    (_event, patch: Partial<ReceiptSettings>): ReceiptSettings => repo().setReceiptSettings(patch)
  )

  ipcMain.handle('settings:getBackupSettings', (): BackupSettings => repo().getBackupSettings())
  ipcMain.handle(
    'settings:setBackupSettings',
    (_event, patch: Partial<BackupSettings>): BackupSettings => repo().setBackupSettings(patch)
  )

  /**
   * Copies the chosen image into a stable app-owned location (userData/branding)
   * rather than referencing the original file in place — the original could be
   * moved, renamed, or on removable media, which would silently break the
   * logo everywhere it's used (receipts, reports) without this.
   */
  ipcMain.handle('settings:pickLogo', async (): Promise<PickLogoResult> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choose Shop Logo',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (canceled || !filePaths[0]) return { success: false }

    try {
      const sourcePath = filePaths[0]
      const ext = path.extname(sourcePath).toLowerCase()
      if (!MIME_BY_EXT[ext]) return { success: false, error: 'Unsupported image format' }

      const destPath = path.join(getBrandingDir(), `logo${ext}`)
      fs.copyFileSync(sourcePath, destPath)
      repo().setBranding({ logoPath: destPath })
      return { success: true, logoPath: destPath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save logo' }
    }
  })

  ipcMain.handle('settings:getLogoDataUrl', (): string | null => {
    const { logoPath } = repo().getBranding()
    if (!logoPath || !fs.existsSync(logoPath)) return null

    const ext = path.extname(logoPath).toLowerCase()
    const mime = MIME_BY_EXT[ext]
    if (!mime) return null

    const bytes = fs.readFileSync(logoPath)
    return `data:${mime};base64,${bytes.toString('base64')}`
  })

  ipcMain.handle('settings:removeLogo', (): void => {
    const { logoPath } = repo().getBranding()
    if (logoPath && fs.existsSync(logoPath)) {
      fs.rmSync(logoPath, { force: true })
    }
    repo().setBranding({ logoPath: null })
  })
}
