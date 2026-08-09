import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { dictionary } from '@shared/i18n'
import { useDuplicatePhoneCheck } from '@shared/hooks/useDuplicatePhoneCheck'
import { normalizePhone, isValidMobilePhone, sanitizePhoneInput, PHONE_HELP, hasLetter, NAME_HELP } from '@shared/lib/phone'
import { logActivity } from '@shared/lib/activityLog'
import { advanceOnEnter } from '@shared/lib/formKeyboardFlow'
import { MAX_NOTES, MAX_SHORT_TEXT, TOO_LONG } from '@shared/lib/textLimits'

const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(MAX_SHORT_TEXT, TOO_LONG(MAX_SHORT_TEXT)).refine(hasLetter, NAME_HELP),
  phone: z.string().trim().min(1, 'Phone is required').refine(isValidMobilePhone, PHONE_HELP),
  address: z.string().trim().max(MAX_SHORT_TEXT, TOO_LONG(MAX_SHORT_TEXT)).optional(),
  notes: z.string().trim().max(MAX_NOTES, TOO_LONG(MAX_NOTES)).optional()
})

type CustomerFormValues = z.infer<typeof customerFormSchema>

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function CustomerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { name: '', phone: '', address: '', notes: '' }
  })

  useEffect(() => {
    if (!id) return
    window.api.customers.getById(id).then((customer) => {
      if (!customer) {
        setLoadError(true)
        setLoading(false)
        return
      }
      reset({
        name: customer.name,
        phone: customer.phone,
        address: customer.address ?? '',
        notes: customer.notes ?? ''
      })
      setLoading(false)
    })
  }, [id, reset])

  const phoneValue = watch('phone')
  const duplicate = useDuplicatePhoneCheck(phoneValue, id)

  const onSubmit = handleSubmit(async (values) => {
    if (duplicate) return
    setSubmitError(null)

    const payload = {
      name: values.name.trim(),
      phone: normalizePhone(values.phone),
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null
    }

    try {
      if (isEdit && id) {
        const updated = await window.api.customers.update(id, payload)
        if (!updated) {
          setSubmitError('Could not save customer. Please try again.')
          return
        }
        logActivity({
          actionType: 'update',
          entityType: 'customer',
          entityId: updated.id,
          description: `Customer "${updated.name}" updated`
        })
        navigate(`/customers/${updated.id}`, { replace: true })
      } else {
        const created = await window.api.customers.create(payload)
        logActivity({
          actionType: 'create',
          entityType: 'customer',
          entityId: created.id,
          description: `Customer "${created.name}" created`
        })
        navigate(`/customers/${created.id}`, { replace: true })
      }
    } catch {
      setSubmitError('Could not save customer. Please try again.')
    }
  })

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <BilingualText text={dictionary.common.loading} size="sm" className="items-center text-ink-muted" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-sm text-center">
        <BilingualText text={dictionary.customers.notFound} as="div" size="lg" align="center" />
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <BilingualText text={dictionary.customers.backToList} size="sm" align="center" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex max-w-lg flex-1 flex-col">
      <BilingualText
        text={isEdit ? dictionary.customers.editCustomer : dictionary.customers.addNew}
        as="div"
        size="xl"
        className="mb-xl"
      />

      <form
        onSubmit={onSubmit}
        onKeyDown={advanceOnEnter}
        noValidate
        className="flex flex-col gap-md rounded-lg border border-border/60 bg-surface p-xl shadow-card"
      >
        {submitError && (
          <p role="alert" className="rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">
            {submitError}
          </p>
        )}

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.customers.name} size="sm" className="text-ink-muted" />
          <input type="text" autoFocus maxLength={MAX_SHORT_TEXT} className={inputClass} {...register('name')} />
          {errors.name && <span className="text-xs text-danger">{errors.name.message}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.customers.phone} size="sm" className="text-ink-muted" />
          <input
            type="tel"
            inputMode="numeric"
            className={inputClass}
            {...register('phone')}
            onChange={(event) => {
              event.target.value = sanitizePhoneInput(event.target.value)
              register('phone').onChange(event)
            }}
          />
          {errors.phone && <span className="text-xs text-danger">{errors.phone.message}</span>}
        </label>

        {duplicate && (
          <div className="rounded-md bg-warning/10 p-sm text-warning">
            <BilingualText text={dictionary.customers.duplicateTitle} as="div" size="sm" className="font-medium" />
            <BilingualText text={dictionary.customers.duplicateBody} size="sm" className="mt-1" />
            <p className="mt-0.5 text-sm font-medium">
              {duplicate.name} ({duplicate.phone})
            </p>
            {!duplicate.isDeleted ? (
              // Not <Button> — inherits the warning-tinted text color from
              // this callout via currentColor; ghost's own explicit muted
              // text color would override that inherited tone.
              <button
                type="button"
                onClick={() => navigate(`/customers/${duplicate.id}`)}
                className="mt-2 underline"
              >
                <BilingualText text={dictionary.customers.openProfile} size="sm" />
              </button>
            ) : (
              <div className="mt-1">
                <BilingualText text={dictionary.customers.duplicateArchived} size="sm" />
              </div>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.customers.address} size="sm" className="text-ink-muted" />
          <input type="text" maxLength={MAX_SHORT_TEXT} className={inputClass} {...register('address')} />
        </label>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.customers.notes} size="sm" className="text-ink-muted" />
          <textarea rows={3} maxLength={MAX_NOTES} className={inputClass} {...register('notes')} />
        </label>

        <div className="mt-sm flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            <BilingualText text={dictionary.customers.cancel} size="sm" align="center" />
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || Boolean(duplicate)}>
            <BilingualText text={dictionary.customers.save} size="sm" align="center" />
          </Button>
        </div>
      </form>
    </div>
  )
}
