import { ipcMain } from 'electron'
import { getDatabase } from '../db/client'
import {
  AnalyticsRepository,
  type TimeSeriesGranularity,
  type TimeSeriesPoint,
  type RepairVolumePoint,
  type RepeatCustomerStats,
  type TopCustomer
} from '../db/repositories/analyticsRepository'

export function registerAnalyticsIpc(): void {
  const repo = () => new AnalyticsRepository(getDatabase())

  ipcMain.handle(
    'analytics:revenueTrend',
    (_event, granularity: TimeSeriesGranularity): TimeSeriesPoint[] => repo().revenueTrend(granularity)
  )

  ipcMain.handle(
    'analytics:profitTrend',
    (_event, granularity: TimeSeriesGranularity): TimeSeriesPoint[] => repo().profitTrend(granularity)
  )

  ipcMain.handle(
    'analytics:repairVolumeTrend',
    (_event, granularity: TimeSeriesGranularity): RepairVolumePoint[] => repo().repairVolumeTrend(granularity)
  )

  ipcMain.handle(
    'analytics:newCustomersTrend',
    (_event, granularity: TimeSeriesGranularity): TimeSeriesPoint[] => repo().newCustomersTrend(granularity)
  )

  ipcMain.handle('analytics:repeatCustomerRate', (): RepeatCustomerStats => repo().repeatCustomerRate())

  ipcMain.handle(
    'analytics:topCustomersBySpend',
    (_event, limit: number): TopCustomer[] => repo().topCustomersBySpend(limit)
  )

  ipcMain.handle(
    'analytics:brandBreakdown',
    (_event, limit: number): { brand: string; count: number }[] => repo().brandBreakdown(limit)
  )
}
