import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import { todayLocalDateString } from '../lib/date'
import { DashboardRepository, type DashboardSummary } from '../db/repositories/dashboardRepository'
import { RepairRepository, type RepairWithCustomer } from '../db/repositories/repairRepository'

/**
 * Three small, purpose-built reads for the Dashboard screen — kept separate
 * (rather than one giant "getEverything" call) so each stays independently
 * readable and testable; on a local SQLite file the round-trip cost of a
 * few IPC calls fired in parallel is negligible next to the 2-second budget.
 */
export function registerDashboardIpc(): void {
  ipcMain.handle('dashboard:getSummary', (): DashboardSummary => new DashboardRepository(getDatabase()).getSummary())

  ipcMain.handle('dashboard:getTodaysDeliveries', (): RepairWithCustomer[] => {
    const today = todayLocalDateString()
    return new RepairRepository(getDatabase()).findTodaysDeliveries(today)
  })

  ipcMain.handle('dashboard:getOverdueDeliveries', (): RepairWithCustomer[] => {
    const today = todayLocalDateString()
    return new RepairRepository(getDatabase()).findOverdueUnresolved(today)
  })

  ipcMain.handle(
    'dashboard:getRecentRepairs',
    (_event, limit: number): RepairWithCustomer[] => new RepairRepository(getDatabase()).findRecentWithCustomer(limit)
  )
}
