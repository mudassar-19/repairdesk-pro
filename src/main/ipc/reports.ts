import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import { ReportRepository, type ReportData, type ReportDateBounds } from '../db/repositories/reportRepository'

export function registerReportsIpc(): void {
  ipcMain.handle(
    'reports:generate',
    (_event, bounds: ReportDateBounds): ReportData => new ReportRepository(getDatabase()).generate(bounds)
  )
}
