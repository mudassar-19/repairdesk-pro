import { contextBridge, ipcRenderer } from 'electron'
import type { SystemHealth } from '../main/ipc/system'
import type { LocalSession, SaveSessionResult, DeviceOwner } from '../main/ipc/auth'
import type { ActivityLogEvent } from '../main/ipc/activity'
import type {
  ActivityLogFilters,
  ActivityLogRow,
  ActivityPageFilters,
  ActivityPageResult
} from '../main/db/repositories/activityLogRepository'
import type { DashboardSummary } from '../main/db/repositories/dashboardRepository'
import type {
  Customer,
  CustomerWithStats,
  CustomerFilters,
  NewCustomerInput,
  UpdateCustomerInput
} from '../main/db/repositories/customerRepository'
import type {
  Repair,
  RepairWithCustomer,
  RepairFilters,
  NewRepairInput,
  UpdateRepairInput
} from '../main/db/repositories/repairRepository'
import type { Payment, PaymentWithContext, PaymentListFilters, NewPaymentInput } from '../main/db/repositories/paymentRepository'
import type { RecordPaymentResult } from '../main/db/services/paymentService'
import type { DeliverResult, DeliverOnCreditInput, DeliverOnCreditResult } from '../main/db/services/deliveryService'
import type {
  Expense,
  ExpenseFilters,
  NewExpenseInput,
  UpdateExpenseInput
} from '../main/db/repositories/expenseRepository'
import type { ReportData, ReportDateBounds } from '../main/db/repositories/reportRepository'
import type { ExportPdfResult, PdfPageSize } from '../main/ipc/print'
import type {
  TimeSeriesGranularity,
  TimeSeriesPoint,
  RepairVolumePoint,
  RepeatCustomerStats,
  TopCustomer
} from '../main/db/repositories/analyticsRepository'
import type { BackupInfo, BackupResult, RestoreResult } from '../main/db/services/backupService'
import type { BrandingSettings, ReceiptSettings, BackupSettings, CloudBackupState } from '../main/db/repositories/settingsRepository'
import type { GoogleDriveStatus, CloudBackupResult, RemoteBackupInfoResult } from '../main/ipc/googleDrive'
import type { ConnectResult } from '../main/services/googleDriveAuth'
import type { PickLogoResult } from '../main/ipc/settings'
import type { Udhaar, NewUdhaarInput, UpdateUdhaarInput, UdhaarFilters } from '../main/db/repositories/udhaarRepository'
import type { UdhaarSettlement } from '../main/db/repositories/udhaarSettlementRepository'
import type { RecordSettlementInput, RecordSettlementResult } from '../main/db/services/udhaarService'
import type { UdhaarSummary } from '../main/ipc/udhaar'

/**
 * The entire renderer-facing API surface. contextIsolation is on and
 * nodeIntegration is off, so this contextBridge call is the ONLY way the
 * renderer can reach anything privileged — no Node/Electron globals leak
 * through. Every channel here must be explicit; there is no passthrough.
 */
/** Business data domains a write can affect — the vocabulary of the real-time bus (Part E). */
export type DataEntity = 'repairs' | 'payments' | 'udhaar' | 'expenses' | 'customers' | 'settings' | 'activity'

const dataChangeListeners = new Set<(entities: DataEntity[]) => void>()
function emitDataChange(entities: DataEntity[]): void {
  for (const listener of dataChangeListeners) {
    try {
      listener(entities)
    } catch {
      // A subscriber throwing must never break the mutation that triggered it.
    }
  }
}

/**
 * Wraps a mutating IPC channel so that, after it resolves successfully, it
 * publishes the set of data entities it changed to every onDataChanged
 * subscriber (Part E — real-time updates with no manual refresh). This is the
 * one place writes announce themselves; read-only channels are never wrapped.
 * Emitting from the preload (not the renderer) is deliberate: window.api is
 * frozen by context isolation, so it cannot be monkey-patched in the renderer.
 */
function mutate<A extends unknown[], R>(channel: string, entities: DataEntity[]) {
  return async (...args: A): Promise<R> => {
    const result = (await ipcRenderer.invoke(channel, ...args)) as R
    emitDataChange(entities)
    return result
  }
}

const api = {
  getSystemHealth: (): Promise<SystemHealth> => ipcRenderer.invoke('system:getHealth'),
  /** Subscribe to post-write data-change events. Returns an unsubscribe fn. */
  onDataChanged: (listener: (entities: DataEntity[]) => void): (() => void) => {
    dataChangeListeners.add(listener)
    return () => {
      dataChangeListeners.delete(listener)
    }
  },
  auth: {
    getLocalSession: (): Promise<LocalSession | null> => ipcRenderer.invoke('auth:getLocalSession'),
    saveLocalSession: (session: LocalSession): Promise<SaveSessionResult> =>
      ipcRenderer.invoke('auth:saveLocalSession', session),
    clearLocalSession: (): Promise<void> => ipcRenderer.invoke('auth:clearLocalSession'),
    getDeviceId: (): Promise<string> => ipcRenderer.invoke('auth:getDeviceId'),
    getDeviceOwner: (): Promise<DeviceOwner | null> => ipcRenderer.invoke('auth:getDeviceOwner'),
    resetDeviceBinding: (): Promise<void> => ipcRenderer.invoke('auth:resetDeviceBinding')
  },
  logActivity: mutate<[ActivityLogEvent], void>('activity:log', ['activity']),
  listActivity: (filters?: ActivityLogFilters): Promise<ActivityLogRow[]> =>
    ipcRenderer.invoke('activity:list', filters),
  activity: {
    findPage: (filters: ActivityPageFilters): Promise<ActivityPageResult> =>
      ipcRenderer.invoke('activity:findPage', filters)
  },
  customers: {
    list: (filters?: CustomerFilters): Promise<Customer[]> => ipcRenderer.invoke('customers:list', filters),
    listWithStats: (filters?: CustomerFilters): Promise<CustomerWithStats[]> =>
      ipcRenderer.invoke('customers:listWithStats', filters),
    getById: (id: string): Promise<Customer | null> => ipcRenderer.invoke('customers:getById', id),
    findByPhone: (phone: string): Promise<Customer | null> =>
      ipcRenderer.invoke('customers:findByPhone', phone),
    create: mutate<[NewCustomerInput], Customer>('customers:create', ['customers']),
    update: mutate<[string, UpdateCustomerInput], Customer | null>('customers:update', ['customers']),
    softDelete: mutate<[string], Customer | null>('customers:softDelete', ['customers', 'repairs', 'payments'])
  },
  repairs: {
    list: (filters?: RepairFilters): Promise<Repair[]> => ipcRenderer.invoke('repairs:list', filters),
    listWithCustomer: (filters?: RepairFilters & { search?: string }): Promise<RepairWithCustomer[]> =>
      ipcRenderer.invoke('repairs:listWithCustomer', filters),
    getById: (id: string): Promise<Repair | null> => ipcRenderer.invoke('repairs:getById', id),
    listBrands: (): Promise<string[]> => ipcRenderer.invoke('repairs:listBrands'),
    create: mutate<[NewRepairInput], Repair>('repairs:create', ['repairs', 'payments', 'customers']),
    update: mutate<[string, UpdateRepairInput], Repair | null>('repairs:update', ['repairs', 'payments', 'customers']),
    softDelete: mutate<[string], Repair | null>('repairs:softDelete', ['repairs', 'payments', 'customers']),
    deliverWithFullPayment: mutate<[string], DeliverResult>('repairs:deliverWithFullPayment', ['repairs', 'payments', 'customers']),
    deliverOnCredit: mutate<[DeliverOnCreditInput], DeliverOnCreditResult>('repairs:deliverOnCredit', [
      'repairs',
      'payments',
      'udhaar',
      'customers'
    ])
  },
  dashboard: {
    getSummary: (): Promise<DashboardSummary> => ipcRenderer.invoke('dashboard:getSummary'),
    getTodaysDeliveries: (): Promise<RepairWithCustomer[]> =>
      ipcRenderer.invoke('dashboard:getTodaysDeliveries'),
    getOverdueDeliveries: (): Promise<RepairWithCustomer[]> =>
      ipcRenderer.invoke('dashboard:getOverdueDeliveries'),
    getRepairsNeedingAction: (limit: number): Promise<RepairWithCustomer[]> =>
      ipcRenderer.invoke('dashboard:getRepairsNeedingAction', limit)
  },
  payments: {
    findByRepairId: (repairId: string): Promise<Payment[]> =>
      ipcRenderer.invoke('payments:findByRepairId', repairId),
    listWithContext: (filters?: PaymentListFilters): Promise<PaymentWithContext[]> =>
      ipcRenderer.invoke('payments:listWithContext', filters),
    sumByCustomer: (customerId: string): Promise<number> =>
      ipcRenderer.invoke('payments:sumByCustomer', customerId),
    record: mutate<[NewPaymentInput], RecordPaymentResult>('payments:record', ['payments', 'repairs', 'customers'])
  },
  udhaar: {
    create: mutate<[NewUdhaarInput], Udhaar>('udhaar:create', ['udhaar']),
    getById: (id: string): Promise<Udhaar | null> => ipcRenderer.invoke('udhaar:getById', id),
    list: (filters?: UdhaarFilters): Promise<Udhaar[]> => ipcRenderer.invoke('udhaar:list', filters),
    findByRepairId: (repairId: string): Promise<Udhaar[]> => ipcRenderer.invoke('udhaar:findByRepairId', repairId),
    update: mutate<[string, UpdateUdhaarInput], Udhaar | null>('udhaar:update', ['udhaar']),
    softDelete: mutate<[string], Udhaar | null>('udhaar:softDelete', ['udhaar']),
    findSettlements: (udhaarId: string): Promise<UdhaarSettlement[]> =>
      ipcRenderer.invoke('udhaar:findSettlements', udhaarId),
    recordSettlement: mutate<[RecordSettlementInput], RecordSettlementResult>('udhaar:recordSettlement', [
      'udhaar',
      'payments',
      'repairs',
      'customers'
    ]),
    getOverdue: (): Promise<Udhaar[]> => ipcRenderer.invoke('udhaar:getOverdue'),
    getSummary: (): Promise<UdhaarSummary> => ipcRenderer.invoke('udhaar:getSummary')
  },
  expenses: {
    list: (filters?: ExpenseFilters): Promise<Expense[]> => ipcRenderer.invoke('expenses:list', filters),
    getById: (id: string): Promise<Expense | null> => ipcRenderer.invoke('expenses:getById', id),
    sumByDateRange: (dateFrom: string, dateTo: string, category?: string): Promise<number> =>
      ipcRenderer.invoke('expenses:sumByDateRange', dateFrom, dateTo, category),
    hasEntryForCurrentMonth: (category: string): Promise<boolean> =>
      ipcRenderer.invoke('expenses:hasEntryForCurrentMonth', category),
    getRecurringDrafts: (): Promise<{ category: string; amount: number }[]> =>
      ipcRenderer.invoke('expenses:getRecurringDrafts'),
    create: mutate<[NewExpenseInput], Expense>('expenses:create', ['expenses']),
    update: mutate<[string, UpdateExpenseInput], Expense | null>('expenses:update', ['expenses']),
    softDelete: mutate<[string], Expense | null>('expenses:softDelete', ['expenses'])
  },
  reports: {
    generate: (bounds: ReportDateBounds): Promise<ReportData> => ipcRenderer.invoke('reports:generate', bounds)
  },
  print: {
    exportPdf: (
      suggestedFileName: string,
      pageSize?: PdfPageSize,
      marginType?: 'default' | 'none'
    ): Promise<ExportPdfResult> => ipcRenderer.invoke('print:exportPdf', suggestedFileName, pageSize, marginType),
    direct: (): Promise<boolean> => ipcRenderer.invoke('print:direct')
  },
  analytics: {
    revenueTrend: (granularity: TimeSeriesGranularity): Promise<TimeSeriesPoint[]> =>
      ipcRenderer.invoke('analytics:revenueTrend', granularity),
    profitTrend: (granularity: TimeSeriesGranularity): Promise<TimeSeriesPoint[]> =>
      ipcRenderer.invoke('analytics:profitTrend', granularity),
    repairVolumeTrend: (granularity: TimeSeriesGranularity): Promise<RepairVolumePoint[]> =>
      ipcRenderer.invoke('analytics:repairVolumeTrend', granularity),
    newCustomersTrend: (granularity: TimeSeriesGranularity): Promise<TimeSeriesPoint[]> =>
      ipcRenderer.invoke('analytics:newCustomersTrend', granularity),
    repeatCustomerRate: (): Promise<RepeatCustomerStats> => ipcRenderer.invoke('analytics:repeatCustomerRate'),
    topCustomersBySpend: (limit: number): Promise<TopCustomer[]> =>
      ipcRenderer.invoke('analytics:topCustomersBySpend', limit),
    brandBreakdown: (limit: number): Promise<{ brand: string; count: number }[]> =>
      ipcRenderer.invoke('analytics:brandBreakdown', limit)
  },
  backup: {
    createManual: (destinationDir?: string): Promise<BackupResult> =>
      ipcRenderer.invoke('backup:createManual', destinationDir),
    list: (): Promise<BackupInfo[]> => ipcRenderer.invoke('backup:list'),
    chooseDirectory: (): Promise<string | null> => ipcRenderer.invoke('backup:chooseDirectory'),
    chooseRestoreFile: (): Promise<string | null> => ipcRenderer.invoke('backup:chooseRestoreFile'),
    restore: (filePath: string): Promise<RestoreResult> => ipcRenderer.invoke('backup:restore', filePath),
    getCloudBackupState: (): Promise<CloudBackupState> => ipcRenderer.invoke('backup:getCloudBackupState'),
    hasBusinessData: (): Promise<boolean> => ipcRenderer.invoke('backup:hasBusinessData')
  },
  googleDrive: {
    connect: (): Promise<ConnectResult> => ipcRenderer.invoke('googleDrive:connect'),
    getStatus: (): Promise<GoogleDriveStatus> => ipcRenderer.invoke('googleDrive:getStatus'),
    disconnect: (): Promise<void> => ipcRenderer.invoke('googleDrive:disconnect'),
    backupNow: (): Promise<CloudBackupResult> => ipcRenderer.invoke('googleDrive:backupNow'),
    getRemoteBackupInfo: (): Promise<RemoteBackupInfoResult> => ipcRenderer.invoke('googleDrive:getRemoteBackupInfo'),
    restoreLatest: (): Promise<RestoreResult> => ipcRenderer.invoke('googleDrive:restoreLatest')
  },
  settings: {
    getBranding: (): Promise<BrandingSettings> => ipcRenderer.invoke('settings:getBranding'),
    setBranding: (patch: Partial<BrandingSettings>): Promise<BrandingSettings> =>
      ipcRenderer.invoke('settings:setBranding', patch),
    getReceiptSettings: (): Promise<ReceiptSettings> => ipcRenderer.invoke('settings:getReceiptSettings'),
    setReceiptSettings: (patch: Partial<ReceiptSettings>): Promise<ReceiptSettings> =>
      ipcRenderer.invoke('settings:setReceiptSettings', patch),
    getBackupSettings: (): Promise<BackupSettings> => ipcRenderer.invoke('settings:getBackupSettings'),
    setBackupSettings: (patch: Partial<BackupSettings>): Promise<BackupSettings> =>
      ipcRenderer.invoke('settings:setBackupSettings', patch),
    pickLogo: (): Promise<PickLogoResult> => ipcRenderer.invoke('settings:pickLogo'),
    getLogoDataUrl: (): Promise<string | null> => ipcRenderer.invoke('settings:getLogoDataUrl'),
    removeLogo: (): Promise<void> => ipcRenderer.invoke('settings:removeLogo')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
