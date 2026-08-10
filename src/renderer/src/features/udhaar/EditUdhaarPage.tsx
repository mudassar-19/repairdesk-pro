import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { isValidMobilePhone, sanitizePhoneInput, PHONE_HELP } from '@shared/lib/phone'
import { MAX_NOTES, MAX_SHORT_TEXT, TOO_LONG } from '@shared/lib/textLimits'
import type { Udhaar } from '../../../../main/db/repositories/udhaarRepository'

const editUdhaarFormSchema = z.object({
  personName: z.string().trim().max(MAX_SHORT_TEXT, TOO_LONG(MAX_SHORT_TEXT)).optional(),
  personPhone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isValidMobilePhone(value), PHONE_HELP),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0, 'Enter a valid amount'),
  dueDate: z.string().trim().optional(),
  notes: z.string().trim().max(MAX_NOTES, TOO_LONG(MAX_NOTES)).optional()
})

type EditUdhaarFormValues = z.infer<typeof editUdhaarFormSchema>

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'
const lockedClass = 'cursor-not-allowed bg-surface-raised text-ink-muted'

/**
 * Editing an existing Udhaar entry. Direction is intentionally immutable (it's
 * omitted from UpdateUdhaarInput on the backend). Two safety locks, enforced
 * here for UX and again in the udhaar:update IPC handler so they can't be
 * bypassed:
 *   • LINKED entries (repairId set — created via Deliver on Credit): amount and
 *     person are fixed, because the amount mirrors the repair's unpaid balance
 *     and its settlement→mirror-payment accounting; only due date + notes edit.
 *   • Person is also locked when the entry is tied to a saved customer
 *     (customerId set) — the name/phone belong to that customer record.
 *   • Amount can never be set below what's already been settled.
 */
export function EditUdhaarPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [entry, setEntry] = useState<Udhaar | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<EditUdhaarFormValues>({
    resolver: zodResolver(editUdhaarFormSchema),
    defaultValues: { personName: '', personPhone: '', amount: '', dueDate: '', notes: '' }
  })

  useEffect(() => {
    if (!id) return
    window.api.udhaar.getById(id).then((row) => {
      if (!row) {
        setLoadError(true)
        setLoading(false)
        return
      }
      setEntry(row)
      reset({
        personName: row.personName,
        personPhone: row.personPhone ?? '',
        amount: String(row.totalAmount),
        dueDate: row.dueDate ?? '',
        notes: row.notes ?? ''
      })
      setLoading(false)
    })
  }, [id, reset])

  const isLinked = Boolean(entry?.repairId)
  const personLocked = isLinked || Boolean(entry?.customerId)
  const amountLocked = isLinked

  const onSubmit = handleSubmit(async (values) => {
    if (!entry || !id) return
    setSubmitError(null)

    const amount = Number(values.amount)
    if (!amountLocked && amount < entry.amountSettled) {
      setSubmitError(dictionary.udhaar.amountBelowSettled.en)
      return
    }

    // Only send fields the user is actually allowed to change for this entry.
    const patch: Record<string, unknown> = {
      dueDate: values.dueDate?.trim() || null,
      notes: values.notes?.trim() || null
    }
    if (!amountLocked) patch.totalAmount = amount
    if (!personLocked) {
      patch.personName = values.personName?.trim()
      patch.personPhone = values.personPhone?.trim() || null
    }

    try {
      const updated = await window.api.udhaar.update(id, patch)
      if (!updated) {
        setSubmitError('Could not save this Udhaar entry. Please try again.')
        return
      }
      logActivity({
        actionType: 'update',
        entityType: 'udhaar',
        entityId: updated.id,
        description: `Udhaar (${updated.direction}) for ${updated.personName} updated — amount ${updated.totalAmount.toFixed(2)}`,
        metadata: { direction: updated.direction, totalAmount: updated.totalAmount, linked: isLinked }
      })
      navigate('/udhaar', { replace: true })
    } catch {
      setSubmitError('Could not save this Udhaar entry. Please try again.')
    }
  })

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <BilingualText text={dictionary.common.loading} size="sm" className="items-center text-ink-muted" />
      </div>
    )
  }

  if (loadError || !entry) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-sm text-center">
        <BilingualText text={dictionary.udhaar.notFound} as="div" size="lg" align="center" />
        <Button variant="ghost" onClick={() => navigate('/udhaar')}>
          <BilingualText text={dictionary.repairs.backToList} size="sm" align="center" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex max-w-3xl flex-1 flex-col">
      <BilingualText text={dictionary.udhaar.editUdhaar} as="div" size="xl" className="mb-xl" />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md rounded-lg border border-border/60 bg-surface p-xl shadow-card">
        {submitError && (
          <p role="alert" className="rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">
            {submitError}
          </p>
        )}

        {isLinked && (
          <p data-testid="linked-udhaar-hint" className="rounded-md bg-warning/10 px-sm py-sm text-xs text-warning">
            <BilingualText text={dictionary.udhaar.linkedAmountLockedHint} size="xs" />
          </p>
        )}

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.udhaar.personName} size="sm" className="text-ink-muted" />
            <input
              type="text"
              maxLength={MAX_SHORT_TEXT}
              readOnly={personLocked}
              className={`${inputClass} ${personLocked ? lockedClass : ''}`}
              {...register('personName')}
            />
            {!isLinked && personLocked && (
              <BilingualText text={dictionary.udhaar.personLockedHint} size="xs" className="text-ink-muted" />
            )}
          </label>
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.udhaar.personPhone} size="sm" className="text-ink-muted" />
            <input
              type="tel"
              inputMode="numeric"
              readOnly={personLocked}
              className={`${inputClass} ${personLocked ? lockedClass : ''}`}
              {...register('personPhone')}
              onChange={(event) => {
                event.target.value = sanitizePhoneInput(event.target.value)
                register('personPhone').onChange(event)
              }}
            />
            {errors.personPhone && <span className="text-xs text-danger">{errors.personPhone.message}</span>}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.udhaar.amount} size="sm" className="text-ink-muted" />
            <input
              type="text"
              inputMode="decimal"
              readOnly={amountLocked}
              className={`${inputClass} ${amountLocked ? lockedClass : ''}`}
              {...register('amount')}
            />
            {errors.amount && <span className="text-xs text-danger">{errors.amount.message}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.udhaar.dueDateOptionalField} size="sm" className="text-ink-muted" />
            <input type="date" className={inputClass} {...register('dueDate')} />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.udhaar.notes} size="sm" className="text-ink-muted" />
          <textarea rows={2} maxLength={MAX_NOTES} className={inputClass} {...register('notes')} />
        </label>

        <div className="mt-sm flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            <BilingualText text={dictionary.udhaar.cancel} size="sm" align="center" />
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            <BilingualText text={dictionary.udhaar.save} size="sm" align="center" />
          </Button>
        </div>
      </form>
    </div>
  )
}
