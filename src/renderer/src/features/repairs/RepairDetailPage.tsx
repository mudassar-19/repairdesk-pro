import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import { StatusBadge } from '@shared/components/StatusBadge'
import { RepairStatusActions } from '@shared/components/RepairStatusActions'
import { dictionary } from '@shared/i18n'
import { cancelRepairWithLog } from '@shared/lib/cancelRepair'
import { paymentTypeLabel } from '@shared/lib/paymentType'
import { isRepairStatusLocked, repairPriorityLabel } from '@shared/lib/repairStatus'
import { useDataSubscription } from '@shared/lib/dataBus'
import { RecordPaymentModal } from './RecordPaymentModal'
import { ReceiptModal } from './ReceiptModal'
import type { Repair } from '../../../../main/db/repositories/repairRepository'
import type { Customer } from '../../../../main/db/repositories/customerRepository'
import type { Payment } from '../../../../main/db/repositories/paymentRepository'

export function RepairDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [repair, setRepair] = useState<Repair | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    window.api.repairs.getById(id).then(async (result) => {
      setRepair(result)
      if (result) {
        setCustomer(await window.api.customers.getById(result.customerId))
        setPaymentHistory(await window.api.payments.findByRepairId(result.id))
      }
      setLoading(false)
    })
  }, [id])

  // Delivery now records payments (full-pay or credit split), so refresh the
  // Payment History alongside the repair whenever its status/balance changes.
  const handleRepairChanged = (updated: Repair) => {
    setRepair(updated)
    window.api.payments.findByRepairId(updated.id).then(setPaymentHistory)
  }

  // Part E: if this repair's money changes elsewhere (e.g. its linked udhaar
  // is settled on the Udhaar page), reflect it here live.
  useDataSubscription(['repairs', 'payments'], () => {
    if (!id) return
    window.api.repairs.getById(id).then((r) => r && setRepair(r))
    window.api.payments.findByRepairId(id).then(setPaymentHistory)
  })

  // Repairs are never deleted — Cancel Order is the only removal path. It moves
  // the repair to the terminal 'cancelled' state and reverses its revenue/profit
  // impact (see cancelRepair); the audit-trail entry is written inside
  // cancelRepairWithLog. We stay on the page so the reversed status is visible.
  const handleCancel = async () => {
    if (!repair) return
    const { repair: updated } = await cancelRepairWithLog(repair.id)
    setCancelOpen(false)
    handleRepairChanged(updated)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <BilingualText text={dictionary.common.loading} size="sm" className="items-center text-ink-muted" />
      </div>
    )
  }

  if (!repair) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-sm text-center">
        <BilingualText text={dictionary.repairs.notFound} as="div" size="lg" className="items-center" />
        <button type="button" onClick={() => navigate('/repairs')} className="text-primary hover:underline">
          <BilingualText text={dictionary.repairs.backToList} size="sm" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/*
        Printing/exporting the receipt captures the whole window, not just
        the ReceiptModal — .no-print only ever hid the Sidebar/TopBar chrome,
        so this page's own content (still mounted behind the modal overlay)
        used to print/export alongside the receipt. Hiding it here whenever
        the receipt modal is open ensures ONLY ReceiptModal's own
        print-modal-overlay/content ends up in the output.
      */}
      <div className={receiptModalOpen ? 'no-print flex flex-1 flex-col' : 'flex flex-1 flex-col'}>
        <div className="mb-lg flex items-start justify-between gap-md">
          <div>
            <p className="text-xl font-medium leading-tight text-ink">
              {repair.deviceBrand} {repair.deviceModel}
            </p>
            <p className="mt-1 text-sm text-ink-muted">{repair.issue}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-sm">
            <StatusBadge status={repair.status} />
            <button
              type="button"
              onClick={() => navigate(`/repairs/${repair.id}/edit`)}
              className="rounded-md border border-border px-md py-sm transition-colors hover:bg-surface-raised"
            >
              <BilingualText text={dictionary.repairs.edit} size="sm" />
            </button>
            {/* Cancel Order — first-class, prominent action (replaces the removed
                Delete button). Only shown while the repair is still active; a
                delivered/cancelled repair is locked. Reverses revenue/profit. */}
            {!isRepairStatusLocked(repair.status) && (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="rounded-md bg-danger/10 px-md py-sm text-danger transition-colors hover:bg-danger/20"
              >
                <BilingualText text={dictionary.repairs.cancelOrder} size="sm" />
              </button>
            )}
          </div>
        </div>

        <div className="mb-lg flex items-center justify-between rounded-lg border border-border/60 bg-surface p-lg shadow-card">
          <div>
            <BilingualText text={dictionary.repairs.customer} size="sm" className="text-ink-muted" />
            <p className="mt-0.5 text-base font-medium text-ink">{customer?.name}</p>
            <p className="text-sm text-ink-muted">{customer?.phone}</p>
          </div>
          {customer && (
            <button
              type="button"
              onClick={() => navigate(`/customers/${customer.id}`)}
              className="text-primary hover:underline"
            >
              <BilingualText text={dictionary.repairs.viewCustomerProfile} size="sm" />
            </button>
          )}
        </div>

        {!isRepairStatusLocked(repair.status) && (
          <div className="mb-lg rounded-lg border border-border/60 bg-surface p-lg shadow-card">
            <BilingualText text={dictionary.repairs.changeStatus} as="div" size="sm" className="mb-sm text-ink-muted" />
            <RepairStatusActions repair={repair} onChanged={handleRepairChanged} showCancel={false} />
          </div>
        )}

        <div className="mb-lg grid grid-cols-4 gap-lg">
          <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
            <BilingualText text={dictionary.repairs.costPrice} size="sm" className="text-ink-muted" />
            <p className="mt-1 text-xl font-medium text-ink">{repair.costPrice.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
            <BilingualText text={dictionary.repairs.repairPrice} size="sm" className="text-ink-muted" />
            <p className="mt-1 text-xl font-medium text-ink">{repair.repairPrice.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
            <BilingualText text={dictionary.repairs.advanceAmount} size="sm" className="text-ink-muted" />
            <p className="mt-1 text-xl font-medium text-ink">{repair.advanceAmount.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
            <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
            <p className="mt-1 text-xl font-medium text-ink">{repair.remainingBalance.toFixed(2)}</p>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-2 gap-x-lg gap-y-sm rounded-lg border border-border/60 bg-surface p-lg shadow-card sm:grid-cols-3">
          <div>
            <BilingualText text={dictionary.repairs.priority} size="sm" className="text-ink-muted" />
            <p className="mt-0.5 text-sm text-ink">{repairPriorityLabel[repair.priority].en}</p>
          </div>
          {repair.accessories && (
            <div>
              <BilingualText text={dictionary.repairs.accessories} size="sm" className="text-ink-muted" />
              <p className="mt-0.5 text-sm text-ink">{repair.accessories}</p>
            </div>
          )}
          {repair.imei && (
            <div>
              <BilingualText text={dictionary.repairs.imei} size="sm" className="text-ink-muted" />
              <p className="mt-0.5 text-sm text-ink">{repair.imei}</p>
            </div>
          )}
          {repair.estimatedDeliveryDate && (
            <div>
              <BilingualText text={dictionary.repairs.estimatedDeliveryDate} size="sm" className="text-ink-muted" />
              <p className="mt-0.5 text-sm text-ink">{repair.estimatedDeliveryDate}</p>
            </div>
          )}
          {repair.deliveryTime && (
            <div>
              <BilingualText text={dictionary.repairs.deliveryTime} size="sm" className="text-ink-muted" />
              <p className="mt-0.5 text-sm text-ink">{repair.deliveryTime}</p>
            </div>
          )}
          {repair.notes && (
            <div className="sm:col-span-3">
              <BilingualText text={dictionary.repairs.notes} size="sm" className="text-ink-muted" />
              <p className="mt-0.5 text-sm text-ink">{repair.notes}</p>
            </div>
          )}
        </div>

        <div className="mb-lg rounded-lg border border-border/60 bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-border px-lg py-md">
            <BilingualText text={dictionary.payments.paymentHistory} as="div" size="lg" />
            {/* D3: manual Record Payment is for interim (pre-delivery) paydowns
                only. Once delivered/cancelled the repair is locked; further
                money on a credit delivery is collected via Udhaar settlement. */}
            {!isRepairStatusLocked(repair.status) && (
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="rounded-md bg-primary px-md py-sm text-primary-ink transition-colors hover:bg-primary-hover"
              >
                <BilingualText text={dictionary.payments.recordPayment} size="sm" />
              </button>
            )}
          </div>
          {paymentHistory.length === 0 ? (
            <div className="p-lg text-center">
              <BilingualText
                text={dictionary.payments.noPaymentsYet}
                size="sm"
                className="items-center text-ink-muted"
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paymentHistory.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between px-lg py-md">
                  <div>
                    <p className="text-sm font-medium text-ink">{payment.amount.toFixed(2)}</p>
                    <p className="text-xs text-ink-muted">
                      {payment.paymentDate} · {paymentTypeLabel[payment.type].en}
                    </p>
                    {payment.notes && <p className="mt-0.5 text-xs text-ink-muted">{payment.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-sm">
          <button
            type="button"
            onClick={() => setReceiptModalOpen(true)}
            className="rounded-md border border-border px-md py-sm transition-colors hover:bg-surface-raised"
          >
            <BilingualText text={dictionary.repairs.printReceipt} size="sm" />
          </button>
        </div>
      </div>

      <ReceiptModal
        repair={repair}
        customer={customer}
        open={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
      />

      <RecordPaymentModal
        repair={repair}
        hasExistingPayments={paymentHistory.length > 0}
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onRecorded={(result) => {
          setRepair(result.repair)
          // Re-sort rather than prepend — a backdated payment date wouldn't belong at the top.
          setPaymentHistory((current) =>
            [result.payment, ...current].sort(
              (a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.createdAt.localeCompare(a.createdAt)
            )
          )
          setPaymentModalOpen(false)
        }}
      />

      <ConfirmDialog
        open={cancelOpen}
        title={dictionary.repairs.cancelOrderConfirmTitle}
        body={dictionary.repairs.cancelOrderConfirmBody}
        confirmLabel={dictionary.repairs.cancelOrder}
        cancelLabel={dictionary.repairs.keepOrder}
        danger
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  )
}
