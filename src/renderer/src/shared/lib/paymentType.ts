import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'

/** Mirrors schema.ts's paymentTypeValues — see repairStatus.ts for why this is duplicated rather than imported. */
export const paymentTypeValues = ['advance', 'partial', 'full'] as const
export type PaymentType = (typeof paymentTypeValues)[number]

export const paymentTypeLabel: Record<PaymentType, BilingualString> = {
  advance: dictionary.payments.typeAdvance,
  partial: dictionary.payments.typePartial,
  full: dictionary.payments.typeFull
}
