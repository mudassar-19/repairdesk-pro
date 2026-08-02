import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** Shared by every table that will eventually sync to Firestore (Phase 14). */
export const syncStatusValues = ['pending', 'synced', 'error'] as const
export type SyncStatus = (typeof syncStatusValues)[number]

/**
 * Phase 1 has no business schema. This table exists solely to prove the
 * Drizzle + better-sqlite3 connection works end-to-end (create, insert, read).
 */
export const healthCheck = sqliteTable('health_check', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checkedAt: text('checked_at').notNull()
})

/**
 * Local-only event log, never synced. `metadata` is a JSON string so new
 * event shapes (any future actionType/entityType pair) never need a schema
 * migration — the Phase 13 Activity Timeline module just needs agreement on
 * those string values, not a fixed column set.
 */
export const activityLog = sqliteTable('activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actionType: text('action_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  description: text('description').notNull(),
  performedAt: text('performed_at').notNull(),
  metadata: text('metadata')
})

/**
 * Key-value config store — see Phase 3 write-up for why this beats a wide
 * structured table for white-label flexibility. `key` is namespaced by
 * domain (e.g. 'branding.shopName', 'receipt.footerText'); `value` is a JSON
 * string. SettingsRepository wraps this in typed, Zod-validated helpers.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending')
})

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    address: text('address'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending'),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
  },
  (table) => ({
    phoneIdx: uniqueIndex('customers_phone_idx').on(table.phone)
  })
)

export const repairStatusValues = [
  'pending',
  'waiting_for_parts',
  'in_progress',
  'ready_for_pickup',
  'completed',
  'cancelled'
] as const
export type RepairStatus = (typeof repairStatusValues)[number]

export const repairPriorityValues = ['low', 'normal', 'high'] as const
export type RepairPriority = (typeof repairPriorityValues)[number]

export const repairs = sqliteTable(
  'repairs',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    deviceBrand: text('device_brand').notNull(),
    deviceModel: text('device_model').notNull(),
    issue: text('issue').notNull(),
    accessories: text('accessories'),
    imei: text('imei'),
    status: text('status').$type<RepairStatus>().notNull().default('pending'),
    costPrice: real('cost_price').notNull().default(0),
    repairPrice: real('repair_price').notNull().default(0),
    advanceAmount: real('advance_amount').notNull().default(0),
    // Stored, not a SQL-computed column — kept in sync by RepairRepository
    // on create/update. See Phase 3 write-up: cross-repository recalculation
    // when payments are added belongs to a later service-layer phase.
    remainingBalance: real('remaining_balance').notNull().default(0),
    priority: text('priority').$type<RepairPriority>().notNull().default('normal'),
    estimatedDeliveryDate: text('estimated_delivery_date'),
    deliveryTime: text('delivery_time'),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending'),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
  },
  (table) => ({
    statusIdx: index('repairs_status_idx').on(table.status),
    customerIdIdx: index('repairs_customer_id_idx').on(table.customerId)
  })
)

export const paymentTypeValues = ['advance', 'partial', 'full'] as const
export type PaymentType = (typeof paymentTypeValues)[number]

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    repairId: text('repair_id')
      .notNull()
      .references(() => repairs.id),
    amount: real('amount').notNull(),
    type: text('type').$type<PaymentType>().notNull(),
    paymentDate: text('payment_date').notNull(),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending'),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
  },
  (table) => ({
    repairIdIdx: index('payments_repair_id_idx').on(table.repairId)
  })
)

/**
 * Known categories for UI dropdowns; the column itself is free-text so a
 * custom category (anything not in this list) is stored the same way —
 * no separate "other" column or lookup table needed.
 */
export const expenseCategoryValues = [
  'rent',
  'electricity',
  'supplies',
  'salary',
  'maintenance',
  'other'
] as const
export type ExpenseCategory = (typeof expenseCategoryValues)[number]

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  amount: real('amount').notNull(),
  description: text('description'),
  expenseDate: text('expense_date').notNull(),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  recurringMonth: text('recurring_month'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
})

export const syncActionValues = ['create', 'update', 'delete'] as const
export type SyncAction = (typeof syncActionValues)[number]

/** Schema only — the queueing/retry/upload logic is built in Phase 14. */
export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').$type<SyncAction>().notNull(),
  payload: text('payload').notNull(),
  retryCount: integer('retry_count').notNull().default(0),
  syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull()
})
