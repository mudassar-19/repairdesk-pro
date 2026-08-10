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
  newRepairFormSchema,
  repairFormDefaults,
  buildRepairPayload,
  toNumber,
  type RepairFormValues
} from '@features/repairs/repairForm'
import { ReceiptModal } from '@features/repairs/ReceiptModal'
import { DeliverOnCreditModal } from '@features/repairs/DeliverOnCreditModal'
import { commonIssues, isIssueChipSelected, toggleIssueChip } from '@shared/lib/commonIssues'
import { advanceOnEnter } from '@shared/lib/formKeyboardFlow'
import { MAX_ISSUE } from '@shared/lib/textLimits'
import type { Customer } from '../../../../main/db/repositories/customerRepository'
import type { Repair, NewRepairInput } from '../../../../main/db/repositories/repairRepository'

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

  const [creditOpen, setCreditOpen] = useState(false)
  // The order captured when the credit-split modal opens. NOTHING is written to
  // the database at this point — the repair, payment, and udhaar are all created
  // together, atomically, only when the modal is confirmed (see handleCreditConfirm).
  // Cancelling the modal just clears this, leaving no record behind.
  const [pendingCredit, setPendingCredit] = useState<{ payload: NewRepairInput; customer: Customer } | null>(null)
  const [receiptRepair, setReceiptRepair] = useState<Repair | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm<RepairFormValues>({ resolver: zodResolver(newRepairFormSchema), defaultValues: repairFormDefaults })

  const totalPrice = toNumber(watch('repairPrice'))
  const advance = toNumber(watch('advanceAmount'))
  const remaining = Math.max(totalPrice - advance, 0)
  const brand = watch('deviceBrand')
  const model = watch('deviceModel')
  const costPrice = toNumber(watch('costPrice'))
  const costExceedsPrice = costPrice > 0 && totalPrice > 0 && costPrice > totalPrice
  const issueValue = watch('issue') ?? ''

  const resetAll = () => {
    reset(repairFormDefaults)
    setSelectedCustomer(null)
    setMode('pending')
    setSubmitError(null)
    setPendingCredit(null)
    setReceiptRepair(null)
    setCreditOpen(false)
  }

  const openReceipt = (repair: Repair) => {
    setReceiptRepair(repair)
  }

  const logCreated = (repair: Repair, customer: Customer) => {
    logActivity({
      actionType: 'create',
      entityType: 'repair',
      entityId: repair.id,
      description: `Repair order created (POS) for ${customer.name} (${repair.deviceBrand} ${repair.deviceModel})`
    })
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedCustomer) {
      setCustomerError(true)
      return
    }
    setSubmitError(null)
    setSavedMessage(false)
    const payload = buildRepairPayload(values, selectedCustomer.id)

    if (mode === 'credit') {
      // ATOMIC: create NOTHING yet. Stash the order and open the split modal —
      // the repair + payment + linked udhaar are created together in one
      // transaction only when the modal is confirmed (handleCreditConfirm).
      // If the modal is cancelled, nothing is ever written.
      setPendingCredit({ payload, customer: selectedCustomer })
      setCreditOpen(true)
      return
    }

    setSaving(true)
    try {
      if (mode === 'delivered') {
        // Atomic: create + full payment + delivered in a single transaction.
        const result = await window.api.repairs.createDeliveredPaid(payload)
        logCreated(result.repair, selectedCustomer)
        logActivity({
          actionType: 'status_change',
          entityType: 'repair',
          entityId: result.repair.id,
          description: `Delivered (paid in full${result.payment ? ` ${result.payment.amount.toFixed(2)}` : ''}) via POS`,
          metadata: { toStatus: 'delivered', paymentId: result.payment?.id ?? null }
        })
        openReceipt(result.repair)
      } else {
        const repair = await window.api.repairs.create(payload)
        logCreated(repair, selectedCustomer)
        openReceipt(repair)
      }
    } catch {
      setSubmitError('Could not save this order. Please try again.')
    } finally {
      setSaving(false)
    }
  })

  /**
   * Confirm of the credit-split modal: the FIRST and only write for a
   * take-now-on-credit order. createOnCredit builds the repair, records the
   * paid portion, creates the linked udhaar, and marks it delivered — all in one
   * transaction. Throwing here keeps the modal open (nothing written); resolving
   * opens the receipt.
   */
  const handleCreditConfirm = async ({ udhaarAmount, dueDate }: { udhaarAmount: number; dueDate: string | null }) => {
    if (!pendingCredit) return
    const result = await window.api.repairs.createOnCredit({ repair: pendingCredit.payload, udhaarAmount, dueDate })
    logCreated(result.repair, pendingCredit.customer)
    logActivity({
      actionType: 'status_change',
      entityType: 'repair',
      entityId: result.repair.id,
      description: `Delivered on credit via POS${result.payment ? ` — paid ${result.payment.amount.toFixed(2)}` : ''}${result.udhaar ? `, ${result.udhaar.totalAmount.toFixed(2)} on udhaar` : ''}`,
      metadata: { toStatus: 'delivered', paymentId: result.payment?.id ?? null, udhaarId: result.udhaar?.id ?? null }
    })
    setCreditOpen(false)
    setPendingCredit(null)
    openReceipt(result.repair)
  }

  const handleReceiptClose = () => {
    resetAll()
    setSavedMessage(true)
  }

  const selectMode = (value: CompletionMode) => {
    setMode(value)
    // The date/priority fields are hidden for take-now orders — clear them so a
    // stale value (e.g. a date typed before switching) can't linger or block submit.
    if (value !== 'pending') {
      setValue('estimatedDeliveryDate', '')
      setValue('priority', 'normal')
    }
  }

  const modeOption = (value: CompletionMode, label: BilingualString) => (
    <button
      type="button"
      onClick={() => selectMode(value)}
      className={`flex-1 rounded-md border px-sm py-sm text-sm transition-colors ${
        mode === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink-muted hover:bg-surface-raised'
      }`}
    >
      <BilingualText text={label} size="xs" align="center" />
    </button>
  )

  return (
    <>
      {/*
        Exporting/printing the receipt rasterizes the whole renderer, not just
        the ReceiptModal overlay — .no-print only hides the Sidebar/TopBar
        chrome, so this POS form (still mounted behind the fixed-position modal)
        would otherwise leak into the PDF above the actual receipt. Marking it
        no-print whenever the receipt modal is open guarantees ONLY the
        receipt's print-modal-overlay content reaches the output, on every
        platform. Same fix RepairDetailPage already applies for its own page. */}
      <div className={`flex flex-1 gap-lg overflow-y-auto p-xl${receiptRepair ? ' no-print' : ''}`}>
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
                <textarea rows={2} maxLength={MAX_ISSUE} className={inputClass} {...register('issue')} />
                {errors.issue && <span className="text-xs text-danger">{errors.issue.message}</span>}
                {/* J14: bilingual common-issue quick-chips, MULTI-select — same as
                    the main form: toggles the chip in/out of the Issue field. */}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {commonIssues.map((chip) => {
                    const selected = isIssueChipSelected(issueValue, chip.en)
                    return (
                      <button
                        key={chip.en}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setValue('issue', toggleIssueChip(issueValue, chip.en), { shouldValidate: true })}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-ink-muted hover:border-primary hover:bg-primary/5 hover:text-primary'
                        }`}
                      >
                        <BilingualText text={chip} size="xs" align="center" />
                      </button>
                    )
                  })}
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
                  {errors.advanceAmount && <span className="text-xs text-danger">{errors.advanceAmount.message}</span>}
                </label>
              </div>

              {costExceedsPrice && (
                <div data-testid="cost-exceeds-price-warning">
                  <BilingualText text={dictionary.repairs.costExceedsPriceHint} size="xs" className="text-warning" />
                </div>
              )}

              {/* Estimated Delivery Date + Priority only make sense for an order
                  that's staying in the shop for repair. When the customer is
                  taking the device now (paid or on credit), these are hidden. */}
              {mode === 'pending' && (
                <div className="grid grid-cols-2 gap-md">
                  <label className="flex flex-col gap-1">
                    <BilingualText text={dictionary.repairs.estimatedDeliveryDate} size="sm" className="text-ink-muted" />
                    <input type="date" className={inputClass} {...register('estimatedDeliveryDate')} />
                    {errors.estimatedDeliveryDate && (
                      <span className="text-xs text-danger">{errors.estimatedDeliveryDate.message}</span>
                    )}
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
              )}
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

      {/* Credit split (only for the "taking now — on credit" path). Nothing is
          created until this is confirmed — cancelling writes no repair/payment/
          udhaar and simply returns to the still-filled form. */}
      <DeliverOnCreditModal
        open={creditOpen}
        remaining={remaining}
        onClose={() => {
          setCreditOpen(false)
          setPendingCredit(null)
        }}
        onConfirm={handleCreditConfirm}
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
