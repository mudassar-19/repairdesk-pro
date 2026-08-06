import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { formatCurrency } from '@shared/lib/currency'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import type { Udhaar } from '../../../../main/db/repositories/udhaarRepository'
import type { NewUdhaarSettlementInput } from '../../../../main/db/repositories/udhaarSettlementRepository'

const settlementFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0, 'Enter a valid amount'),
  settlementDate: z.string().trim().min(1, 'Settlement date is required'),
  notes: z.string().trim().optional()
})

type SettlementFormValues = z.infer<typeof settlementFormSchema>

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

const todayDateString = (): string => formatLocalDate(new Date())
const defaultValues: SettlementFormValues = { amount: '', settlementDate: todayDateString(), notes: '' }

export interface RecordSettlementModalProps {
  entry: Udhaar | null
  open: boolean
  onClose: () => void
  onRecorded: () => void
}

export function RecordSettlementModal({ entry, open, onClose, onRecorded }: RecordSettlementModalProps) {
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pendingOverpayment, setPendingOverpayment] = useState<NewUdhaarSettlementInput | null>(null)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<SettlementFormValues>({ resolver: zodResolver(settlementFormSchema), defaultValues })

  const resetForm = () => {
    reset(defaultValues)
    setPendingOverpayment(null)
    setSubmitError(null)
  }

  const performSave = async (input: NewUdhaarSettlementInput) => {
    setSaving(true)
    setSubmitError(null)
    try {
      const result = await window.api.udhaar.recordSettlement(input)
      logActivity({
        actionType: 'udhaar_settlement_recorded',
        entityType: 'udhaar',
        entityId: result.udhaar.id,
        description: `Udhaar settlement of ${input.amount.toFixed(2)} recorded for ${entry?.personName ?? 'entry'}`,
        metadata: { settlementId: result.settlement.id, amount: input.amount }
      })
      resetForm()
      onRecorded()
    } catch {
      setSubmitError('Could not record settlement. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!entry) return
    const input: NewUdhaarSettlementInput = {
      udhaarId: entry.id,
      amount: Number(values.amount),
      settlementDate: values.settlementDate,
      notes: values.notes?.trim() || null
    }

    if (input.amount > entry.remainingBalance) {
      setPendingOverpayment(input)
      return
    }
    await performSave(input)
  })

  const handleClose = () => {
    if (saving) return
    resetForm()
    onClose()
  }

  if (!open || !entry) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-lg" onClick={handleClose}>
      <div className="w-full max-w-md rounded-lg bg-surface p-xl shadow-raised" onClick={(event) => event.stopPropagation()}>
        {pendingOverpayment ? (
          <>
            <BilingualText text={dictionary.payments.overpaymentTitle} as="div" size="lg" className="mb-sm" />
            <BilingualText text={dictionary.payments.overpaymentBody} size="sm" className="mb-lg text-ink-muted" />
            <div className="mb-lg grid grid-cols-2 gap-md rounded-md bg-surface-raised p-md">
              <div>
                <BilingualText text={dictionary.udhaar.settlementAmount} size="sm" className="text-ink-muted" />
                <p className="mt-0.5 text-sm font-medium text-ink">{formatCurrency(pendingOverpayment.amount, currency)}</p>
              </div>
              <div>
                <BilingualText text={dictionary.udhaar.remainingBalance} size="sm" className="text-ink-muted" />
                <p className="mt-0.5 text-sm font-medium text-ink">{formatCurrency(entry.remainingBalance, currency)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-sm">
              <Button variant="ghost" onClick={() => setPendingOverpayment(null)}>
                <BilingualText text={dictionary.payments.cancel} size="sm" align="center" />
              </Button>
              <Button variant="warning" onClick={() => performSave(pendingOverpayment)} disabled={saving}>
                <BilingualText text={dictionary.payments.recordAnyway} size="sm" align="center" />
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md">
            <div>
              <BilingualText text={dictionary.udhaar.recordSettlement} as="div" size="lg" />
              <p className="mt-1 text-sm text-ink-muted">
                {entry.personName} — {dictionary.udhaar.remainingBalance.en}: {formatCurrency(entry.remainingBalance, currency)}
              </p>
            </div>

            {submitError && (
              <p role="alert" className="rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">
                {submitError}
              </p>
            )}

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.udhaar.settlementAmount} size="sm" className="text-ink-muted" />
              <input type="text" inputMode="decimal" autoFocus className={inputClass} {...register('amount')} />
              {errors.amount && <span className="text-xs text-danger">{errors.amount.message}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.udhaar.settlementDate} size="sm" className="text-ink-muted" />
              <input type="date" className={inputClass} {...register('settlementDate')} />
              {errors.settlementDate && <span className="text-xs text-danger">{errors.settlementDate.message}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.udhaar.notes} size="sm" className="text-ink-muted" />
              <textarea rows={2} className={inputClass} {...register('notes')} />
            </label>

            <div className="mt-sm flex justify-end gap-sm">
              <Button type="button" variant="ghost" onClick={handleClose}>
                <BilingualText text={dictionary.udhaar.cancel} size="sm" align="center" />
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || saving}>
                <BilingualText text={dictionary.udhaar.save} size="sm" align="center" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
