import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { CustomerPicker } from '@shared/components/CustomerPicker'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { repairPriorityValues, repairPriorityLabel } from '@shared/lib/repairStatus'
import { repairFormSchema, repairFormDefaults, toNumber, buildRepairPayload, type RepairFormValues } from './repairForm'
import { commonIssues } from '@shared/lib/commonIssues'
import { advanceOnEnter } from '@shared/lib/formKeyboardFlow'
import type { Customer } from '../../../../main/db/repositories/customerRepository'

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export function RepairFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [customerError, setCustomerError] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<RepairFormValues>({
    resolver: zodResolver(repairFormSchema),
    defaultValues: repairFormDefaults
  })

  useEffect(() => {
    if (!id) return
    window.api.repairs.getById(id).then(async (repair) => {
      if (!repair) {
        setLoadError(true)
        setLoading(false)
        return
      }
      const customer = await window.api.customers.getById(repair.customerId)
      setSelectedCustomer(customer)
      reset({
        deviceBrand: repair.deviceBrand,
        deviceModel: repair.deviceModel,
        issue: repair.issue,
        accessories: repair.accessories ?? '',
        imei: repair.imei ?? '',
        estimatedDeliveryDate: repair.estimatedDeliveryDate ?? '',
        deliveryTime: repair.deliveryTime ?? '',
        costPrice: repair.costPrice ? String(repair.costPrice) : '',
        repairPrice: repair.repairPrice ? String(repair.repairPrice) : '',
        advanceAmount: repair.advanceAmount ? String(repair.advanceAmount) : '',
        priority: repair.priority,
        notes: repair.notes ?? ''
      })
      setLoading(false)
    })
  }, [id, reset])

  const repairPrice = toNumber(watch('repairPrice'))
  const advanceAmount = toNumber(watch('advanceAmount'))
  const remainingBalance = repairPrice - advanceAmount
  const costPriceValue = watch('costPrice')
  const showCostHint = !costPriceValue || Number(costPriceValue) === 0

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedCustomer) {
      setCustomerError(true)
      return
    }
    setCustomerError(false)
    setSubmitError(null)

    const payload = buildRepairPayload(values, selectedCustomer.id)

    try {
      if (isEdit && id) {
        const updated = await window.api.repairs.update(id, payload)
        if (!updated) {
          setSubmitError('Could not save repair order. Please try again.')
          return
        }
        logActivity({
          actionType: 'update',
          entityType: 'repair',
          entityId: updated.id,
          description: `Repair order for ${selectedCustomer.name} updated`
        })
        navigate(`/repairs/${updated.id}`, { replace: true })
      } else {
        const created = await window.api.repairs.create(payload)
        logActivity({
          actionType: 'create',
          entityType: 'repair',
          entityId: created.id,
          description: `Repair order created for ${selectedCustomer.name} (${created.deviceBrand} ${created.deviceModel})`
        })
        navigate(`/repairs/${created.id}`, { replace: true })
      }
    } catch {
      setSubmitError('Could not save repair order. Please try again.')
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
        <BilingualText text={dictionary.repairs.notFound} as="div" size="lg" align="center" />
        <Button variant="ghost" onClick={() => navigate('/repairs')}>
          <BilingualText text={dictionary.repairs.backToList} size="sm" align="center" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex max-w-2xl flex-1 flex-col">
      <BilingualText
        text={isEdit ? dictionary.repairs.editRepair : dictionary.repairs.addNew}
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

        <div className="flex flex-col gap-1">
          <BilingualText text={dictionary.repairs.customer} size="sm" className="text-ink-muted" />
          {isEdit ? (
            <div className="rounded-md border border-border bg-surface-raised px-md py-sm">
              <p className="text-sm font-medium text-ink">{selectedCustomer?.name}</p>
              <p className="text-xs text-ink-muted">{selectedCustomer?.phone}</p>
            </div>
          ) : (
            <>
              <CustomerPicker
                value={selectedCustomer}
                onSelect={(customer) => {
                  setSelectedCustomer(customer)
                  setCustomerError(false)
                }}
                autoFocus
              />
              {customerError && <span className="text-xs text-danger">Select or create a customer first.</span>}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-md">
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.deviceBrand} size="sm" className="text-ink-muted" />
            <input type="text" className={inputClass} {...register('deviceBrand')} />
            {errors.deviceBrand && <span className="text-xs text-danger">{errors.deviceBrand.message}</span>}
          </label>
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.deviceModel} size="sm" className="text-ink-muted" />
            <input type="text" className={inputClass} {...register('deviceModel')} />
            {errors.deviceModel && <span className="text-xs text-danger">{errors.deviceModel.message}</span>}
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.repairs.issue} size="sm" className="text-ink-muted" />
          <textarea rows={2} className={inputClass} {...register('issue')} />
          {errors.issue && <span className="text-xs text-danger">{errors.issue.message}</span>}
          {/* J14: quick-select common issues (bilingual). Tapping fills the field; still fully editable. */}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {commonIssues.map((chip) => (
              <button
                key={chip.en}
                type="button"
                onClick={() => setValue('issue', chip.en, { shouldValidate: true })}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
              >
                <BilingualText text={chip} size="xs" align="center" />
              </button>
            ))}
          </div>
        </label>

        <div className="grid grid-cols-2 gap-md">
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.accessories} size="sm" className="text-ink-muted" />
            <input type="text" className={inputClass} {...register('accessories')} />
          </label>
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.imei} size="sm" className="text-ink-muted" />
            <input type="text" className={inputClass} {...register('imei')} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-md">
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.estimatedDeliveryDate} size="sm" className="text-ink-muted" />
            <input type="date" className={inputClass} {...register('estimatedDeliveryDate')} />
          </label>
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.deliveryTime} size="sm" className="text-ink-muted" />
            <input type="time" className={inputClass} {...register('deliveryTime')} />
          </label>
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.priority} size="sm" className="text-ink-muted" />
            <select className={inputClass} {...register('priority')}>
              {repairPriorityValues.map((value) => (
                <option key={value} value={value}>
                  {repairPriorityLabel[value].en}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-4 gap-md">
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.costPrice} size="sm" className="text-ink-muted" />
            <input type="text" inputMode="decimal" className={inputClass} {...register('costPrice')} />
            {errors.costPrice && <span className="text-xs text-danger">{errors.costPrice.message}</span>}
          </label>
          {/* J17: gentle, non-blocking reminder — never a hard validation error. */}
          {showCostHint && (
            <div className="col-span-4">
              <BilingualText text={dictionary.repairs.costPriceHint} size="xs" className="text-warning" />
            </div>
          )}
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.repairPrice} size="sm" className="text-ink-muted" />
            <input type="text" inputMode="decimal" className={inputClass} {...register('repairPrice')} />
            {errors.repairPrice && <span className="text-xs text-danger">{errors.repairPrice.message}</span>}
          </label>
          <label className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.advanceAmount} size="sm" className="text-ink-muted" />
            {/* Advance is captured (as a real Payment) at booking only. On edit
                it is read-only — changing money received afterwards goes through
                Record Payment, so the displayed advance can't drift from it. */}
            <input
              type="text"
              inputMode="decimal"
              readOnly={isEdit}
              title={isEdit ? dictionary.repairs.advanceLockedHint.en : undefined}
              className={`${inputClass} ${isEdit ? 'cursor-not-allowed bg-surface-raised text-ink-muted' : ''}`}
              {...register('advanceAmount')}
            />
            {errors.advanceAmount && <span className="text-xs text-danger">{errors.advanceAmount.message}</span>}
          </label>
          <div className="flex flex-col gap-1">
            <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
            <div className="flex items-center rounded-md border border-border bg-surface-raised px-sm py-sm text-base font-medium text-ink">
              {remainingBalance.toFixed(2)}
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <BilingualText text={dictionary.repairs.notes} size="sm" className="text-ink-muted" />
          <textarea rows={2} className={inputClass} {...register('notes')} />
        </label>

        <div className="mt-sm flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            <BilingualText text={dictionary.repairs.cancel} size="sm" align="center" />
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            <BilingualText text={dictionary.repairs.save} size="sm" align="center" />
          </Button>
        </div>
      </form>
    </div>
  )
}
