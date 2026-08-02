import { contextBridge, ipcRenderer } from 'electron'
import type { SystemHealth } from '../main/ipc/system'
import type { LocalSession } from '../main/ipc/auth'
import type { ActivityLogEvent } from '../main/ipc/activity'
import type {
  Customer,
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
  customers: {
    list: (filters?: CustomerFilters): Promise<Customer[]> => ipcRenderer.invoke('customers:list', filters),
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
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
