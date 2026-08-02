import { ipcMain } from 'electron'
import { verifyDatabaseConnection } from '../db/verify'

export interface SystemHealth {
  db: { ok: boolean; checkedAt: string }
}

/**
 * The only IPC surface in Phase 1: a boot self-check the renderer can show,
 * proving the SQLite/Drizzle stack initializes. The Firebase SDK is checked
 * separately, directly in the renderer (shared/lib/firebase.ts), since the
 * web SDK runs in the browser-like renderer context, not the Node main
 * process. No auth, sync, or business IPC channels exist yet.
 */
export function registerSystemIpc(): void {
  ipcMain.handle('system:getHealth', (): SystemHealth => {
    return {
      db: verifyDatabaseConnection()
    }
  })
}
