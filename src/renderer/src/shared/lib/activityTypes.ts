import type { ComponentType, SVGProps } from 'react'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import {
  CustomersIcon,
  RepairsIcon,
  ExpensesIcon,
  UdhaarIcon,
  AuthIcon,
  BackupIcon,
  InboxIcon
} from '@shared/components/icons'

/**
 * The known entityType/actionType strings actually logged across the app
 * (grepped from every logActivity/ActivityLogRepository.create call site as
 * of Phase 13) — a curated finite list, same pattern as repairStatusValues/
 * expenseCategoryValues, not a dynamic DISTINCT query, since these are a
 * small, stable set the UI needs stable labels/icons for.
 */
export const activityEntityTypeValues = ['customer', 'repair', 'expense', 'udhaar', 'auth', 'backup', 'system'] as const
export type ActivityEntityType = (typeof activityEntityTypeValues)[number]

export const activityActionTypeValues = [
  'create',
  'update',
  'delete',
  'status_change',
  'delivery_date_extended',
  'payment_recorded',
  'udhaar_settlement_recorded',
  'udhaar_due_date_extended',
  'receipt_printed',
  'receipt_exported',
  'login',
  'logout',
  'backup_created',
  'backup_failed',
  'safety_backup_created',
  'restore_initiated'
] as const
export type ActivityActionType = (typeof activityActionTypeValues)[number]

const entityTypeLabel: Record<ActivityEntityType, BilingualString> = {
  customer: dictionary.activity.entityCustomer,
  repair: dictionary.activity.entityRepair,
  expense: dictionary.activity.entityExpense,
  udhaar: dictionary.activity.entityUdhaar,
  auth: dictionary.activity.entityAuth,
  backup: dictionary.activity.entityBackup,
  system: dictionary.activity.entitySystem
}

const actionTypeLabel: Record<ActivityActionType, BilingualString> = {
  create: dictionary.activity.actionCreate,
  update: dictionary.activity.actionUpdate,
  delete: dictionary.activity.actionDelete,
  status_change: dictionary.activity.actionStatusChange,
  delivery_date_extended: dictionary.activity.actionDeliveryDateExtended,
  payment_recorded: dictionary.activity.actionPaymentRecorded,
  udhaar_settlement_recorded: dictionary.activity.actionUdhaarSettlementRecorded,
  udhaar_due_date_extended: dictionary.activity.actionUdhaarDueDateExtended,
  receipt_printed: dictionary.activity.actionReceiptPrinted,
  receipt_exported: dictionary.activity.actionReceiptExported,
  login: dictionary.activity.actionLogin,
  logout: dictionary.activity.actionLogout,
  backup_created: dictionary.activity.actionBackupCreated,
  backup_failed: dictionary.activity.actionBackupFailed,
  safety_backup_created: dictionary.activity.actionSafetyBackupCreated,
  restore_initiated: dictionary.activity.actionRestoreInitiated
}

/** Unrecognized values (e.g. dev-only 'selftest') fall back to the raw string rather than crashing. */
export function entityTypeDisplayLabel(entityType: string): string {
  return (entityTypeLabel as Record<string, BilingualString>)[entityType]?.en ?? entityType
}

export function actionTypeDisplayLabel(actionType: string): string {
  return (actionTypeLabel as Record<string, BilingualString>)[actionType]?.en ?? actionType
}

export function getActivityIcon(entityType: string): ComponentType<SVGProps<SVGSVGElement>> {
  if (entityType === 'customer') return CustomersIcon
  if (entityType === 'repair') return RepairsIcon
  if (entityType === 'expense') return ExpensesIcon
  if (entityType === 'udhaar') return UdhaarIcon
  if (entityType === 'auth') return AuthIcon
  if (entityType === 'backup') return BackupIcon
  return InboxIcon
}

/**
 * Only customer/repair entries have a real detail route to link to — payment,
 * status-change, and receipt activity are all logged under entityType
 * 'repair' already, so they resolve here too. Expense has no detail route
 * (only a list + new-form), and auth/backup/system aren't tied to a specific
 * navigable record, so those stay plain, non-clickable rows.
 */
export function resolveActivityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null
  if (entityType === 'customer') return `/customers/${entityId}`
  if (entityType === 'repair') return `/repairs/${entityId}`
  return null
}
