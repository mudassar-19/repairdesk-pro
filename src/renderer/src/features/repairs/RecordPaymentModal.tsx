import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { paymentTypeValues, paymentTypeLabel } from '@shared/lib/paymentType'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { todayLocalDate } from '@shared/lib/phone'
import { MAX_NOTES, TOO_LONG } from '@shared/lib/textLimits'
import type { Repair } from '../../../../main/db/repositories/repairRepository'
import type { NewPaymentInput } from '../../../../main/db/repositories/paymentRepository'
import type { RecordPaymentResult } from '../../../../main/db/services/paymentService'

const paymentFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0, 'Enter a valid amount'),
  type: z.enum(paymentTypeValues),
  // A payment is money received; it can't be dated in the future.
  paymentDate: z
    .string()
    .trim()
    .min(1, 'Payment date is required')
    .refine((value) => value <= todayLocalDate(), 'Payment date cannot be in the future'),
  notes: z.string().trim().max(MAX_NOTES, TOO_LONG(MAX_NOTES)).optional()
})

type PaymentFormValues = z.infer<typeof paymentFormSchema>

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

const todayDateString = (): string => formatLocalDate(new Date())
const defaultValues: PaymentFormValues = { amount: '', type: 'partial', paymentDate: todayDateString(), notes: '' }

export interface RecordPaymentModalProps {
  repair: Repair
  /** Drives the advance-vs-partial auto-suggestion — true once this repair already has at least one recorded payment. */
  hasExistingPayments: boolean
  open: boolean
  onClose: () => void
  onRecorded: (result: RecordPaymentResult) => void
}

export function RecordPaymentModal({
  repair,
  hasExistingPayments,
  open,
  onClose,
  onRecorded
}: RecordPaymentModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pendingOverpayment, setPendingOverpayment] = useState<NewPaymentInput | null>(null)
  const [saving, setSaving] = useState(false)
  const typeTouchedRef = useRef(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<PaymentFormValues>({ resolver: zodResolver(paymentFormSchema), defaultValues })

  const amountValue = watch('amount')
  const typeField = register('type')

  // Auto-suggests a payment type as the amount is typed; stops the moment
  // the user picks one manually (typeTouchedRef), so it never fights them.
  useEffect(() => {
    if (typeTouchedRef.current) return
    const amount = Number(amountValue)
    if (!amount) return
    const suggested =
      amount >= repair.remainingBalance
        ? 'full'
        : !hasExistingPayments && repair.advanceAmount === 0
          ? 'advance'
          : 'partial'
    setValue('type', suggested)
  }, [amountValue, repair.remainingBalance, repair.advanceAmount, hasExistingPayments, setValue])

  const resetForm = () => {
    reset(defaultValues)
    typeTouchedRef.current = false
    setPendingOverpayment(null)
    setSubmitError(null)
  }

  const performSave = async (input: NewPaymentInput) => {
    setSaving(true)
    setSubmitError(null)
    try {
      const result = await window.api.payments.record(input)
      logActivity({
        actionType: 'payment_recorded',
        entityType: 'repair',
        entityId: result.repair.id,
        description: `Payment of ${input.amount.toFixed(2)} recorded (${input.type})`,
        metadata: { paymentId: result.payment.id, amount: input.amount, type: input.type }
      })
      resetForm()
      onRecorded(result)
    } catch {
      setSubmitError('Could not record payment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const input: NewPaymentInput = {
      repairId: repair.id,
      amount: Number(values.amount),
      type: values.type,
      paymentDate: values.paymentDate,
      notes: values.notes?.trim() || null
    }

    if (input.amount > repair.remainingBalance) {
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-lg" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded-lg bg-surface p-xl shadow-raised"
        onClick={(event) => event.stopPropagation()}
      >
        {pendingOverpayment ? (
          <>
            <BilingualText text={dictionary.payments.overpaymentTitle} as="div" size="lg" className="mb-sm" />
            <BilingualText
              text={dictionary.payments.overpaymentBody}
              size="sm"
              className="mb-lg text-ink-muted"
            />
            <div className="mb-lg grid grid-cols-2 gap-md rounded-md bg-surface-raised p-md">
              <div>
                <BilingualText text={dictionary.payments.amount} size="sm" className="text-ink-muted" />
                <p className="mt-0.5 text-sm font-medium text-ink">{pendingOverpayment.amount.toFixed(2)}</p>
              </div>
              <div>
                <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
                <p className="mt-0.5 text-sm font-medium text-ink">{repair.remainingBalance.toFixed(2)}</p>
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
            <BilingualText text={dictionary.payments.recordPayment} as="div" size="lg" />

            {submitError && (
              <p role="alert" className="rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">
                {submitError}
              </p>
            )}

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.payments.amount} size="sm" className="text-ink-muted" />
              <input type="text" inputMode="decimal" autoFocus className={inputClass} {...register('amount')} />
              {errors.amount && <span className="text-xs text-danger">{errors.amount.message}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.payments.paymentType} size="sm" className="text-ink-muted" />
              <select
                {...typeField}
                onChange={(event) => {
                  typeTouchedRef.current = true
                  typeField.onChange(event)
                }}
                className={inputClass}
              >
                {paymentTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {paymentTypeLabel[value].en}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.payments.paymentDate} size="sm" className="text-ink-muted" />
              <input type="date" className={inputClass} {...register('paymentDate')} />
              {errors.paymentDate && <span className="text-xs text-danger">{errors.paymentDate.message}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <BilingualText text={dictionary.payments.notes} size="sm" className="text-ink-muted" />
              <textarea rows={2} maxLength={MAX_NOTES} className={inputClass} {...register('notes')} />
            </label>

            <div className="mt-sm flex justify-end gap-sm">
              <Button type="button" variant="ghost" onClick={handleClose}>
                <BilingualText text={dictionary.payments.cancel} size="sm" align="center" />
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || saving}>
                <BilingualText text={dictionary.payments.save} size="sm" align="center" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
