import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { CustomerPicker } from '@shared/components/CustomerPicker'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { formatCurrency } from '@shared/lib/currency'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import { repairPriorityValues, repairPriorityLabel } from '@shared/lib/repairStatus'
import {
  repairFormSchema,
  repairFormDefaults,
  buildRepairPayload,
  toNumber,
  type RepairFormValues
} from '@features/repairs/repairForm'
import { ReceiptModal } from '@features/repairs/ReceiptModal'
import { DeliverOnCreditModal } from '@features/repairs/DeliverOnCreditModal'
import { commonIssues } from '@shared/lib/commonIssues'
import { advanceOnEnter } from '@shared/lib/formKeyboardFlow'
import type { Customer } from '../../../../main/db/repositories/customerRepository'
import type { Repair } from '../../../../main/db/repositories/repairRepository'
import type { DeliverOnCreditResult } from '../../../../main/db/services/deliveryService'

const inputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-base text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

type CompletionMode = 'pending' | 'delivered' | 'credit'

/**
 * POS "New Order" tab — the original POS fast-order flow, unchanged: pick/create
 * a customer, capture the repair, choose how the order leaves (pending / paid in
 * full / on credit), then Save & Print in one action and reset for the next
 * customer. Reuses the shared CustomerPicker, repairForm schema, Part A delivery
 * services, and the existing ReceiptModal.
 */
export function PosNewOrder() {
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerError, setCustomerError] = useState(false)
  const [mode, setMode] = useState<CompletionMode>('pending')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState(false)

  const [createdRepair, setCreatedRepair] = useState<Repair | null>(null)
  const [creditOpen, setCreditOpen] = useState(false)
  const [receiptRepair, setReceiptRepair] = useState<Repair | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm<RepairFormValues>({ resolver: zodResolver(repairFormSchema), defaultValues: repairFormDefaults })

  const totalPrice = toNumber(watch('repairPrice'))
  const advance = toNumber(watch('advanceAmount'))
  const remaining = Math.max(totalPrice - advance, 0)
  const brand = watch('deviceBrand')
  const model = watch('deviceModel')

  const resetAll = () => {
    reset(repairFormDefaults)
    setSelectedCustomer(null)
    setMode('pending')
    setSubmitError(null)
    setCreatedRepair(null)
    setReceiptRepair(null)
    setCreditOpen(false)
  }

  const openReceipt = (repair: Repair) => {
    setReceiptRepair(repair)
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedCustomer) {
      setCustomerError(true)
      return
    }
    setSaving(true)
    setSubmitError(null)
    setSavedMessage(false)
    try {
      const repair = await window.api.repairs.create(buildRepairPayload(values, selectedCustomer.id))
      logActivity({
        actionType: 'create',
        entityType: 'repair',
        entityId: repair.id,
        description: `Repair order created (POS) for ${selectedCustomer.name} (${repair.deviceBrand} ${repair.deviceModel})`
      })

      if (mode === 'delivered') {
        const result = await window.api.repairs.deliverWithFullPayment(repair.id)
        logActivity({
          actionType: 'status_change',
          entityType: 'repair',
          entityId: result.repair.id,
          description: `Delivered (paid in full${result.payment ? ` ${result.payment.amount.toFixed(2)}` : ''}) via POS`,
          metadata: { toStatus: 'delivered', paymentId: result.payment?.id ?? null }
        })
        openReceipt(result.repair)
      } else if (mode === 'credit') {
        // The split happens in the modal; the receipt opens once it's delivered.
        setCreatedRepair(repair)
        setCreditOpen(true)
      } else {
        openReceipt(repair)
      }
    } catch {
      setSubmitError('Could not save this order. Please try again.')
    } finally {
      setSaving(false)
    }
  })

  const handleCreditDelivered = (result: DeliverOnCreditResult) => {
    setCreditOpen(false)
    logActivity({
      actionType: 'status_change',
      entityType: 'repair',
      entityId: result.repair.id,
      description: `Delivered on credit via POS${result.payment ? ` — paid ${result.payment.amount.toFixed(2)}` : ''}${result.udhaar ? `, ${result.udhaar.totalAmount.toFixed(2)} on udhaar` : ''}`,
      metadata: { toStatus: 'delivered', paymentId: result.payment?.id ?? null, udhaarId: result.udhaar?.id ?? null }
    })
    openReceipt(result.repair)
  }

  const handleReceiptClose = () => {
    resetAll()
    setSavedMessage(true)
  }

  const modeOption = (value: CompletionMode, label: BilingualString) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={`flex-1 rounded-md border px-sm py-sm text-sm transition-colors ${
        mode === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink-muted hover:bg-surface-raised'
      }`}
    >
      <BilingualText text={label} size="xs" align="center" />
    </button>
  )

  return (
    <>
      <div className="flex flex-1 gap-lg overflow-y-auto p-xl">
        {/* Order entry */}
        <div className="flex-1">
          <BilingualText text={dictionary.pos.newOrder} as="div" size="xl" className="mb-lg items-start" />
          <Card className="flex flex-col gap-md">
            {submitError && (
              <p role="alert" className="rounded-md bg-danger/10 px-sm py-sm text-sm text-danger">
                {submitError}
              </p>
            )}

            <div className="flex flex-col gap-1">
              <BilingualText text={dictionary.repairs.customer} size="sm" className="text-ink-muted" />
              <CustomerPicker
                value={selectedCustomer}
                onSelect={(customer) => {
                  setSelectedCustomer(customer)
                  setCustomerError(false)
                }}
                autoFocus
              />
              {customerError && (
                <span className="text-xs text-danger">{dictionary.pos.selectCustomerFirst.en}</span>
              )}
            </div>

            {/* Device fields share the main form's keyboard flow (J15) — Enter
                advances between them (the customer picker above keeps its own
                Enter handling). */}
            <div className="flex flex-col gap-md" onKeyDown={advanceOnEnter}>
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
                {/* J14: bilingual common-issue quick-chips, same as the main form. */}
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

              <div className="grid grid-cols-3 gap-md">
                <label className="flex flex-col gap-1">
                  <BilingualText text={dictionary.repairs.costPrice} size="sm" className="text-ink-muted" />
                  <input type="text" inputMode="decimal" className={inputClass} {...register('costPrice')} />
                </label>
                <label className="flex flex-col gap-1">
                  <BilingualText text={dictionary.repairs.repairPrice} size="sm" className="text-ink-muted" />
                  <input type="text" inputMode="decimal" className={inputClass} {...register('repairPrice')} />
                </label>
                <label className="flex flex-col gap-1">
                  <BilingualText text={dictionary.repairs.advanceAmount} size="sm" className="text-ink-muted" />
                  <input type="text" inputMode="decimal" className={inputClass} {...register('advanceAmount')} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <label className="flex flex-col gap-1">
                  <BilingualText text={dictionary.repairs.estimatedDeliveryDate} size="sm" className="text-ink-muted" />
                  <input type="date" className={inputClass} {...register('estimatedDeliveryDate')} />
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
            </div>
          </Card>
        </div>

        {/* Running summary + completion + action */}
        <div className="w-[22rem] flex-shrink-0">
          <BilingualText text={dictionary.pos.orderSummary} as="div" size="xl" className="mb-lg items-start" />
          <Card className="flex flex-col gap-md">
            <div className="flex flex-col gap-sm rounded-md bg-surface-raised p-md text-sm">
              <SummaryRow label={dictionary.repairs.customer.en} value={selectedCustomer?.name ?? '—'} />
              <SummaryRow label={dictionary.repairs.deviceModel.en} value={[brand, model].filter(Boolean).join(' ') || '—'} />
              <SummaryRow label={dictionary.repairs.repairPrice.en} value={formatCurrency(totalPrice, currency)} />
              <SummaryRow label={dictionary.repairs.advanceAmount.en} value={formatCurrency(advance, currency)} />
              <div className="mt-1 border-t border-border pt-2">
                <SummaryRow label={dictionary.repairs.remainingBalance.en} value={formatCurrency(remaining, currency)} strong />
              </div>
            </div>

            <div>
              <BilingualText text={dictionary.pos.orderStatus} size="sm" className="mb-1 text-ink-muted" />
              <div className="flex flex-col gap-sm">
                {modeOption('pending', dictionary.pos.statusPending)}
                {modeOption('delivered', dictionary.pos.statusDeliveredPaid)}
                {modeOption('credit', dictionary.pos.statusDeliveredCredit)}
              </div>
            </div>

            <Button variant="primary" onClick={onSubmit} disabled={saving} className="w-full">
              <BilingualText text={saving ? dictionary.pos.saving : dictionary.pos.saveAndPrint} size="sm" align="center" />
            </Button>

            {savedMessage && (
              <BilingualText text={dictionary.pos.readyForNext} size="xs" className="items-center text-success" />
            )}
          </Card>
        </div>
      </div>

      {/* Credit split (only for the "taking now — on credit" path) */}
      <DeliverOnCreditModal
        repair={creditOpen ? createdRepair : null}
        open={creditOpen}
        onClose={() => {
          // Backing out of the split leaves the order created but still pending;
          // print its receipt and move on rather than losing the order.
          setCreditOpen(false)
          if (createdRepair) openReceipt(createdRepair)
        }}
        onDelivered={handleCreditDelivered}
      />

      {/* Receipt reuses the existing template; closing it resets for the next customer. */}
      {receiptRepair && (
        <ReceiptModal repair={receiptRepair} customer={selectedCustomer} open onClose={handleReceiptClose} />
      )}
    </>
  )
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-md">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? 'font-semibold text-ink' : 'text-ink'}>{value}</span>
    </div>
  )
}
