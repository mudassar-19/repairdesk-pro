import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import { StatusBadge } from '@shared/components/StatusBadge'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import {
  repairStatusValues,
  repairStatusLabel,
  repairStatusBadgeClass,
  repairPriorityLabel,
  type RepairStatus
} from '@shared/lib/repairStatus'
import type { Repair } from '../../../../main/db/repositories/repairRepository'
import type { Customer } from '../../../../main/db/repositories/customerRepository'

const placeholderButtonClass =
  'cursor-not-allowed rounded-md border border-border px-md py-sm text-ink-muted opacity-60'

export function RepairDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [repair, setRepair] = useState<Repair | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  useEffect(() => {
    if (!id) return
    window.api.repairs.getById(id).then(async (result) => {
      setRepair(result)
      if (result) setCustomer(await window.api.customers.getById(result.customerId))
      setLoading(false)
    })
  }, [id])

  const handleStatusChange = async (newStatus: RepairStatus) => {
    if (!repair || newStatus === repair.status || statusUpdating) return
    setStatusUpdating(true)
    const previousStatus = repair.status
    const updated = await window.api.repairs.update(repair.id, { status: newStatus })
    setStatusUpdating(false)
    if (updated) {
      setRepair(updated)
      logActivity({
        actionType: 'status_change',
        entityType: 'repair',
        entityId: updated.id,
        description: `Status changed from ${repairStatusLabel[previousStatus].en} to ${repairStatusLabel[newStatus].en}`,
        metadata: { fromStatus: previousStatus, toStatus: newStatus }
      })
    }
  }

  const handleDelete = async () => {
    if (!repair) return
    const deleted = await window.api.repairs.softDelete(repair.id)
    setConfirmOpen(false)
    if (deleted) {
      logActivity({
        actionType: 'delete',
        entityType: 'repair',
        entityId: deleted.id,
        description: `Repair order for ${customer?.name ?? 'customer'} deleted`
      })
      navigate('/repairs', { replace: true })
    }
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
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-md bg-danger/10 px-md py-sm text-danger transition-colors hover:bg-danger/20"
          >
            <BilingualText text={dictionary.repairs.delete} size="sm" />
          </button>
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

      <div className="mb-lg rounded-lg border border-border/60 bg-surface p-lg shadow-card">
        <BilingualText text={dictionary.repairs.changeStatus} as="div" size="sm" className="mb-sm text-ink-muted" />
        <div className="flex flex-wrap gap-sm">
          {repairStatusValues.map((value) => (
            <button
              key={value}
              type="button"
              disabled={statusUpdating}
              onClick={() => handleStatusChange(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                repair.status === value
                  ? `${repairStatusBadgeClass[value]} ring-1 ring-inset ring-current`
                  : 'bg-surface-raised text-ink-muted hover:bg-border/60'
              }`}
            >
              {repairStatusLabel[value].en}
            </button>
          ))}
        </div>
      </div>

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

      <div className="flex gap-sm">
        {/* Phase 11 replaces this with the real receipt template + print flow. */}
        <button type="button" disabled className={placeholderButtonClass}>
          <BilingualText text={dictionary.repairs.printReceipt} size="sm" />
        </button>
        {/* Phase 7 replaces this with the real payment-recording flow. */}
        <button type="button" disabled className={placeholderButtonClass}>
          <BilingualText text={dictionary.repairs.recordPayment} size="sm" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={dictionary.repairs.deleteConfirmTitle}
        body={dictionary.repairs.deleteConfirmBody}
        confirmLabel={dictionary.repairs.delete}
        cancelLabel={dictionary.repairs.cancel}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
