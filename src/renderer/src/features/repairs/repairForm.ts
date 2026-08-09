import { z } from 'zod'
import { repairPriorityValues } from '@shared/lib/repairStatus'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { MAX_NOTES, MAX_ISSUE, MAX_SHORT_TEXT, TOO_LONG } from '@shared/lib/textLimits'
import type { NewRepairInput } from '../../../../main/db/repositories/repairRepository'

/**
 * The single source of truth for repair-order form validation + payload
 * shaping, shared by the full Repair form (RepairFormPage) and POS Mode
 * (features/pos/PosPage) so the two can never drift on what a valid order is.
 */
const moneyField = z
  .string()
  .trim()
  .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), 'Enter a valid amount')

const toNum = (value: string): number => (value ? Number(value) : 0)

export const repairFormSchema = z.object({
  deviceBrand: z.string().trim().min(1, 'Device brand is required').max(MAX_SHORT_TEXT, TOO_LONG(MAX_SHORT_TEXT)),
  deviceModel: z.string().trim().min(1, 'Device model is required').max(MAX_SHORT_TEXT, TOO_LONG(MAX_SHORT_TEXT)),
  issue: z.string().trim().min(1, 'Issue description is required').max(MAX_ISSUE, TOO_LONG(MAX_ISSUE)),
  accessories: z.string().trim().max(MAX_SHORT_TEXT, TOO_LONG(MAX_SHORT_TEXT)).optional(),
  // IMEI is optional, but when present it must be exactly 15 digits (GSM standard).
  imei: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{15}$/.test(value), 'IMEI must be exactly 15 digits'),
  estimatedDeliveryDate: z.string().trim().optional(),
  deliveryTime: z.string().trim().optional(),
  costPrice: moneyField,
  repairPrice: moneyField,
  advanceAmount: moneyField,
  priority: z.enum(repairPriorityValues),
  notes: z.string().trim().max(MAX_NOTES, TOO_LONG(MAX_NOTES)).optional()
})

export type RepairFormValues = z.infer<typeof repairFormSchema>

/**
 * Extra rules that apply ONLY when creating a NEW order (RepairFormPage in
 * add-mode and POS New Order) — never on edit, so they can't retroactively
 * break existing repairs:
 *   • Advance must not exceed the Total Price (a negative remaining balance
 *     breaks the money model). Hard block, not a warning.
 *   • Estimated Delivery Date, if set, must be today or later — a brand-new
 *     order can't logically be born already overdue. (The overdue-reminder
 *     logic still deals in past dates as orders age; that's the data layer,
 *     which stays permissive — this guard is creation-time only.)
 */
export const newRepairFormSchema = repairFormSchema
  .superRefine((values, ctx) => {
    if (toNum(values.advanceAmount) > toNum(values.repairPrice)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['advanceAmount'],
        message: 'Advance cannot exceed the Total Price.'
      })
    }
    const date = values.estimatedDeliveryDate?.trim()
    if (date) {
      const today = formatLocalDate(new Date())
      if (date < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estimatedDeliveryDate'],
          message: 'Delivery date cannot be in the past for a new order.'
        })
      }
      // Sensible upper bound: a repair promised more than a year out is almost
      // certainly a typo (e.g. wrong year). Generous, not fussy.
      const oneYearOut = formatLocalDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
      if (date > oneYearOut) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estimatedDeliveryDate'],
          message: 'Delivery date is too far in the future (over a year).'
        })
      }
    }
  })

export const repairFormDefaults: RepairFormValues = {
  deviceBrand: '',
  deviceModel: '',
  issue: '',
  accessories: '',
  imei: '',
  estimatedDeliveryDate: '',
  deliveryTime: '',
  costPrice: '',
  repairPrice: '',
  advanceAmount: '',
  priority: 'normal',
  notes: ''
}

export const toNumber = (value: string): number => (value ? Number(value) : 0)

/** Turns validated form values + a chosen customer into the create/update payload. */
export function buildRepairPayload(values: RepairFormValues, customerId: string): NewRepairInput {
  return {
    customerId,
    deviceBrand: values.deviceBrand.trim(),
    deviceModel: values.deviceModel.trim(),
    issue: values.issue.trim(),
    accessories: values.accessories?.trim() || null,
    imei: values.imei?.trim() || null,
    estimatedDeliveryDate: values.estimatedDeliveryDate?.trim() || null,
    deliveryTime: values.deliveryTime?.trim() || null,
    costPrice: toNumber(values.costPrice),
    repairPrice: toNumber(values.repairPrice),
    advanceAmount: toNumber(values.advanceAmount),
    priority: values.priority,
    notes: values.notes?.trim() || null
  }
}
