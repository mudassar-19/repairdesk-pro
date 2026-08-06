import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
export const activityLog = sqliteTable(
  'activity_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actionType: text('action_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    description: text('description').notNull(),
    performedAt: text('performed_at').notNull(),
    metadata: text('metadata')
  },
  (table) => ({
    // Phase 13 Activity Timeline filters/sorts on these; id is already the
    // primary key and doubles as the pagination cursor (see
    // ActivityLogRepository.findPage) since it's set in the same insert call
    // as performedAt and is therefore an equally monotonic, gap-free ordering.
    entityTypeIdx: index('activity_log_entity_type_idx').on(table.entityType),
    actionTypeIdx: index('activity_log_action_type_idx').on(table.actionType),
    performedAtIdx: index('activity_log_performed_at_idx').on(table.performedAt)
  })
)

/**
 * Key-value config store — see Phase 3 write-up for why this beats a wide
 * structured table for white-label flexibility. `key` is namespaced by
 * domain (e.g. 'branding.shopName', 'receipt.footerText'); `value` is a JSON
 * string. SettingsRepository wraps this in typed, Zod-validated helpers.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
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
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
  },
  (table) => ({
    phoneIdx: uniqueIndex('customers_phone_idx').on(table.phone)
  })
)

/**
 * Linear 4-state workflow (replacing the earlier 6-state one): pending is
 * the automatic default; completed and delivered are two distinct steps
 * (work finished vs. handed back to the customer) rather than one; delivered
 * and cancelled are final, locked states enforced by
 * RepairRepository.update() itself, not just the UI. See migration
 * 0003 for how existing data moves onto this model.
 */
export const repairStatusValues = ['pending', 'completed', 'delivered', 'cancelled'] as const
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
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
  },
  (table) => ({
    statusIdx: index('repairs_status_idx').on(table.status),
    customerIdIdx: index('repairs_customer_id_idx').on(table.customerId),
    // Powers the Overdue Delivery Reminder's "estimatedDeliveryDate < today"
    // scan — without this it's a full table scan every Dashboard load.
    estimatedDeliveryDateIdx: index('repairs_estimated_delivery_date_idx').on(table.estimatedDeliveryDate)
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
  'personal_withdrawal',
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
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
})

/**
 * Udhaar (credit/lending) — tracks money owed either direction: 'receivable'
 * (a customer owes the shop, e.g. took a repaired device without paying in
 * full) or 'payable' (the shop owes someone else, e.g. a borrowed amount).
 * Deliberately its own ledger, not a repurposing of repairs.remainingBalance
 * or the payments table — a payable entry has no repair at all, and even a
 * receivable entry tied to a repair must stay independently trackable (see
 * repairId below) without mutating that repair's own payment history.
 */
export const udhaarDirectionValues = ['receivable', 'payable'] as const
export type UdhaarDirection = (typeof udhaarDirectionValues)[number]

export const udhaarStatusValues = ['pending', 'partially_settled', 'settled'] as const
export type UdhaarStatus = (typeof udhaarStatusValues)[number]

export const udhaar = sqliteTable(
  'udhaar',
  {
    id: text('id').primaryKey(),
    // Free-text, not a strict FK-only reference — the whole point is to
    // also support someone who isn't a customer in the system at all.
    personName: text('person_name').notNull(),
    personPhone: text('person_phone'),
    // Set only when the person was picked via the existing CustomerPicker
    // (an actual customer record); null for a free-text non-customer entry.
    customerId: text('customer_id').references(() => customers.id),
    direction: text('direction').$type<UdhaarDirection>().notNull(),
    totalAmount: real('total_amount').notNull(),
    amountSettled: real('amount_settled').notNull().default(0),
    // Stored, not computed — recomputed from totalAmount/sum-of-settlements
    // on every update(), exactly like repairs.remainingBalance.
    remainingBalance: real('remaining_balance').notNull(),
    status: text('status').$type<UdhaarStatus>().notNull().default('pending'),
    dueDate: text('due_date'),
    // Set only when this entry originated from a repair's unpaid balance at
    // delivery time (see RepairStatusActions) — nullable, since most payable
    // entries and many receivable entries (a walk-in loan, not a repair)
    // have no associated repair at all.
    repairId: text('repair_id').references(() => repairs.id),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
  },
  (table) => ({
    directionIdx: index('udhaar_direction_idx').on(table.direction),
    statusIdx: index('udhaar_status_idx').on(table.status),
    // Powers the overdue-udhaar-due-date reminder scan (same reasoning as
    // repairs_estimated_delivery_date_idx for the Overdue Delivery Reminder).
    dueDateIdx: index('udhaar_due_date_idx').on(table.dueDate)
  })
)

/**
 * One row per settlement (partial or full), mirroring the repairs/payments
 * relationship exactly — a single running total on udhaar itself would lose
 * the ability to show a settlement history, and would make "how much was
 * this settled by on which date" unrecoverable.
 */
export const udhaarSettlements = sqliteTable(
  'udhaar_settlements',
  {
    id: text('id').primaryKey(),
    udhaarId: text('udhaar_id')
      .notNull()
      .references(() => udhaar.id),
    amount: real('amount').notNull(),
    settlementDate: text('settlement_date').notNull(),
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false)
  },
  (table) => ({
    udhaarIdIdx: index('udhaar_settlements_udhaar_id_idx').on(table.udhaarId)
  })
)
