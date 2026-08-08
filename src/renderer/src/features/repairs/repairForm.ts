import { z } from 'zod'
import { repairPriorityValues } from '@shared/lib/repairStatus'
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

export const repairFormSchema = z.object({
  deviceBrand: z.string().trim().min(1, 'Device brand is required'),
  deviceModel: z.string().trim().min(1, 'Device model is required'),
  issue: z.string().trim().min(1, 'Issue description is required'),
  accessories: z.string().trim().optional(),
  imei: z.string().trim().optional(),
  estimatedDeliveryDate: z.string().trim().optional(),
  deliveryTime: z.string().trim().optional(),
  costPrice: moneyField,
  repairPrice: moneyField,
  advanceAmount: moneyField,
  priority: z.enum(repairPriorityValues),
  notes: z.string().trim().optional()
})

export type RepairFormValues = z.infer<typeof repairFormSchema>

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
