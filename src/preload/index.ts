import { contextBridge, ipcRenderer } from 'electron'
import type { SystemHealth } from '../main/ipc/system'
import type { LocalSession } from '../main/ipc/auth'
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
import type { GoogleDriveStatus, CloudBackupResult } from '../main/ipc/googleDrive'
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
const api = {
  getSystemHealth: (): Promise<SystemHealth> => ipcRenderer.invoke('system:getHealth'),
  auth: {
    getLocalSession: (): Promise<LocalSession | null> => ipcRenderer.invoke('auth:getLocalSession'),
    saveLocalSession: (session: LocalSession): Promise<void> =>
      ipcRenderer.invoke('auth:saveLocalSession', session),
    clearLocalSession: (): Promise<void> => ipcRenderer.invoke('auth:clearLocalSession'),
    getDeviceId: (): Promise<string> => ipcRenderer.invoke('auth:getDeviceId')
  },
  logActivity: (event: ActivityLogEvent): Promise<void> => ipcRenderer.invoke('activity:log', event),
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
    create: (input: NewCustomerInput): Promise<Customer> => ipcRenderer.invoke('customers:create', input),
    update: (id: string, patch: UpdateCustomerInput): Promise<Customer | null> =>
      ipcRenderer.invoke('customers:update', id, patch),
    softDelete: (id: string): Promise<Customer | null> => ipcRenderer.invoke('customers:softDelete', id)
  },
  repairs: {
    list: (filters?: RepairFilters): Promise<Repair[]> => ipcRenderer.invoke('repairs:list', filters),
    listWithCustomer: (filters?: RepairFilters & { search?: string }): Promise<RepairWithCustomer[]> =>
      ipcRenderer.invoke('repairs:listWithCustomer', filters),
    getById: (id: string): Promise<Repair | null> => ipcRenderer.invoke('repairs:getById', id),
    listBrands: (): Promise<string[]> => ipcRenderer.invoke('repairs:listBrands'),
    create: (input: NewRepairInput): Promise<Repair> => ipcRenderer.invoke('repairs:create', input),
    update: (id: string, patch: UpdateRepairInput): Promise<Repair | null> =>
      ipcRenderer.invoke('repairs:update', id, patch),
    softDelete: (id: string): Promise<Repair | null> => ipcRenderer.invoke('repairs:softDelete', id)
  },
  dashboard: {
    getSummary: (): Promise<DashboardSummary> => ipcRenderer.invoke('dashboard:getSummary'),
    getTodaysDeliveries: (): Promise<RepairWithCustomer[]> =>
      ipcRenderer.invoke('dashboard:getTodaysDeliveries'),
    getOverdueDeliveries: (): Promise<RepairWithCustomer[]> =>
      ipcRenderer.invoke('dashboard:getOverdueDeliveries'),
    getRecentRepairs: (limit: number): Promise<RepairWithCustomer[]> =>
      ipcRenderer.invoke('dashboard:getRecentRepairs', limit)
  },
  payments: {
    findByRepairId: (repairId: string): Promise<Payment[]> =>
      ipcRenderer.invoke('payments:findByRepairId', repairId),
    listWithContext: (filters?: PaymentListFilters): Promise<PaymentWithContext[]> =>
      ipcRenderer.invoke('payments:listWithContext', filters),
    sumByCustomer: (customerId: string): Promise<number> =>
      ipcRenderer.invoke('payments:sumByCustomer', customerId),
    record: (input: NewPaymentInput): Promise<RecordPaymentResult> =>
      ipcRenderer.invoke('payments:record', input)
  },
  udhaar: {
    create: (input: NewUdhaarInput): Promise<Udhaar> => ipcRenderer.invoke('udhaar:create', input),
    getById: (id: string): Promise<Udhaar | null> => ipcRenderer.invoke('udhaar:getById', id),
    list: (filters?: UdhaarFilters): Promise<Udhaar[]> => ipcRenderer.invoke('udhaar:list', filters),
    findByRepairId: (repairId: string): Promise<Udhaar[]> => ipcRenderer.invoke('udhaar:findByRepairId', repairId),
    update: (id: string, patch: UpdateUdhaarInput): Promise<Udhaar | null> =>
      ipcRenderer.invoke('udhaar:update', id, patch),
    softDelete: (id: string): Promise<Udhaar | null> => ipcRenderer.invoke('udhaar:softDelete', id),
    findSettlements: (udhaarId: string): Promise<UdhaarSettlement[]> =>
      ipcRenderer.invoke('udhaar:findSettlements', udhaarId),
    recordSettlement: (input: RecordSettlementInput): Promise<RecordSettlementResult> =>
      ipcRenderer.invoke('udhaar:recordSettlement', input),
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
    create: (input: NewExpenseInput): Promise<Expense> => ipcRenderer.invoke('expenses:create', input),
    update: (id: string, patch: UpdateExpenseInput): Promise<Expense | null> =>
      ipcRenderer.invoke('expenses:update', id, patch),
    softDelete: (id: string): Promise<Expense | null> => ipcRenderer.invoke('expenses:softDelete', id)
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
    getCloudBackupState: (): Promise<CloudBackupState> => ipcRenderer.invoke('backup:getCloudBackupState')
  },
  googleDrive: {
    connect: (): Promise<ConnectResult> => ipcRenderer.invoke('googleDrive:connect'),
    getStatus: (): Promise<GoogleDriveStatus> => ipcRenderer.invoke('googleDrive:getStatus'),
    disconnect: (): Promise<void> => ipcRenderer.invoke('googleDrive:disconnect'),
    backupNow: (): Promise<CloudBackupResult> => ipcRenderer.invoke('googleDrive:backupNow'),
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
