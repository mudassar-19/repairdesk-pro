import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { CustomerPicker } from '@shared/components/CustomerPicker'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { isValidMobilePhone, sanitizePhoneInput, PHONE_HELP } from '@shared/lib/phone'
import { MAX_NOTES, MAX_SHORT_TEXT, TOO_LONG } from '@shared/lib/textLimits'
import type { Customer } from '../../../../main/db/repositories/customerRepository'
import type { UdhaarDirection } from '../../../../main/db/schema'

const udhaarFormSchema = z.object({
  personName: z.string().trim().max(MAX_SHORT_TEXT, TOO_LONG(MAX_SHORT_TEXT)).optional(),
  // Optional, but if a phone is typed for a "Someone Else" entry it must be valid.
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

type UdhaarFormValues = z.infer<typeof udhaarFormSchema>

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function AddUdhaarPage() {
  const navigate = useNavigate()
  const [direction, setDirection] = useState<UdhaarDirection>('receivable')
  const [personMode, setPersonMode] = useState<'customer' | 'other'>('customer')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [personError, setPersonError] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<UdhaarFormValues>({
    resolver: zodResolver(udhaarFormSchema),
    defaultValues: { personName: '', personPhone: '', amount: '', dueDate: '', notes: '' }
  })

  const onSubmit = handleSubmit(async (values) => {
    const personName = personMode === 'customer' ? selectedCustomer?.name : values.personName?.trim()
    const personPhone = personMode === 'customer' ? selectedCustomer?.phone : values.personPhone?.trim() || null

    if (!personName) {
      setPersonError(true)
      return
    }
    setPersonError(false)
    setSubmitError(null)

    try {
      const created = await window.api.udhaar.create({
        personName,
        personPhone: personPhone ?? null,
        customerId: personMode === 'customer' ? selectedCustomer?.id ?? null : null,
        direction,
        totalAmount: Number(values.amount),
        dueDate: values.dueDate?.trim() || null,
        notes: values.notes?.trim() || null
      })
      logActivity({
        actionType: 'create',
        entityType: 'udhaar',
        entityId: created.id,
        description: `Udhaar (${direction}) of ${created.totalAmount.toFixed(2)} recorded for ${personName}`,
        metadata: { direction, totalAmount: created.totalAmount }
      })
      navigate('/udhaar', { replace: true })
    } catch {
      setSubmitError('Could not save this Udhaar entry. Please try again.')
    }
  })

  return (
    <div className="flex max-w-3xl flex-1 flex-col">
      <BilingualText text={dictionary.udhaar.addNew} as="div" size="xl" className="mb-xl" />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md rounded-lg border border-border/60 bg-surface p-xl shadow-card">
        {submitError && (
          <p role="alert" className="rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">
            {submitError}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <BilingualText text={dictionary.udhaar.direction} size="sm" className="text-ink-muted" />
          <div className="flex gap-sm">
            <Button
              type="button"
              variant={direction === 'receivable' ? 'primary' : 'secondary'}
              onClick={() => setDirection('receivable')}
              className="flex-1"
            >
              <BilingualText text={dictionary.udhaar.directionReceivable} size="xs" align="center" />
            </Button>
            <Button
              type="button"
              variant={direction === 'payable' ? 'primary' : 'secondary'}
              onClick={() => setDirection('payable')}
              className="flex-1"
            >
              <BilingualText text={dictionary.udhaar.directionPayable} size="xs" align="center" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <BilingualText text={dictionary.udhaar.person} size="sm" className="text-ink-muted" />
          <div className="mb-1 flex gap-sm">
            <Button
              type="button"
              variant={personMode === 'customer' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setPersonMode('customer')
                setPersonError(false)
              }}
            >
              <BilingualText text={dictionary.udhaar.existingCustomer} size="xs" align="center" />
            </Button>
            <Button
              type="button"
              variant={personMode === 'other' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setPersonMode('other')
                setPersonError(false)
              }}
            >
              <BilingualText text={dictionary.udhaar.someoneElse} size="xs" align="center" />
            </Button>
          </div>

          {personMode === 'customer' ? (
            <CustomerPicker
              value={selectedCustomer}
              onSelect={(customer) => {
                setSelectedCustomer(customer)
                setPersonError(false)
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <BilingualText text={dictionary.udhaar.personName} size="sm" className="text-ink-muted" />
                <input type="text" maxLength={MAX_SHORT_TEXT} className={inputClass} {...register('personName')} />
              </label>
              <label className="flex flex-col gap-1">
                <BilingualText text={dictionary.udhaar.personPhone} size="sm" className="text-ink-muted" />
                <input
                  type="tel"
                  inputMode="numeric"
                  className={inputClass}
                  {...register('personPhone')}
                  onChange={(event) => {
                    event.target.value = sanitizePhoneInput(event.target.value)
                    register('personPhone').onChange(event)
                  }}
                />
                {errors.personPhone && <span className="text-xs text-danger">{errors.personPhone.message}</span>}
              </label>
            </div>
          )}
          {personError && <span className="text-xs text-danger">Select a customer or enter a name.</span>}
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.udhaar.amount} size="sm" className="text-ink-muted" />
            <input type="text" inputMode="decimal" className={inputClass} {...register('amount')} />
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
