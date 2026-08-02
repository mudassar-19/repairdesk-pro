import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { EmptyState } from '@shared/components/EmptyState'
import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import { RepairsIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import type { Customer } from '../../../../main/db/repositories/customerRepository'

export function CustomerDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    window.api.customers.getById(id).then((result) => {
      setCustomer(result)
      setLoading(false)
    })
  }, [id])

  const handleDelete = async () => {
    if (!customer) return
    const deleted = await window.api.customers.softDelete(customer.id)
    setConfirmOpen(false)
    if (deleted) {
      logActivity({
        actionType: 'delete',
        entityType: 'customer',
        entityId: deleted.id,
        description: `Customer "${deleted.name}" deleted`
      })
      navigate('/customers', { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <BilingualText text={dictionary.common.loading} size="sm" className="items-center text-ink-muted" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-sm text-center">
        <BilingualText text={dictionary.customers.notFound} as="div" size="lg" className="items-center" />
        <button type="button" onClick={() => navigate('/customers')} className="text-primary hover:underline">
          <BilingualText text={dictionary.customers.backToList} size="sm" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-xl flex items-start justify-between gap-md">
        <div>
          <p className="text-xl font-medium leading-tight text-ink">{customer.name}</p>
          <p className="mt-1 text-sm text-ink-muted">{customer.phone}</p>
        </div>
        <div className="flex flex-shrink-0 gap-sm">
          <button
            type="button"
            onClick={() => navigate(`/customers/${customer.id}/edit`)}
            className="rounded-md border border-border px-md py-sm transition-colors hover:bg-surface-raised"
          >
            <BilingualText text={dictionary.customers.edit} size="sm" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-md bg-danger/10 px-md py-sm text-danger transition-colors hover:bg-danger/20"
          >
            <BilingualText text={dictionary.customers.delete} size="sm" />
          </button>
        </div>
      </div>

      {/* Repairs module (Phase 5) will replace these three placeholders with real aggregates. */}
      <div className="mb-xl grid grid-cols-3 gap-lg">
        <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
          <BilingualText text={dictionary.customers.totalRepairs} size="sm" className="text-ink-muted" />
          <p className="mt-1 text-2xl font-medium text-ink">0</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
          <BilingualText text={dictionary.customers.totalSpent} size="sm" className="text-ink-muted" />
          <p className="mt-1 text-2xl font-medium text-ink">—</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
          <BilingualText text={dictionary.customers.lastVisit} size="sm" className="text-ink-muted" />
          <p className="mt-1 text-2xl font-medium text-ink">—</p>
        </div>
      </div>

      {(customer.address || customer.notes) && (
        <div className="mb-xl flex flex-col gap-sm rounded-lg border border-border/60 bg-surface p-lg shadow-card">
          {customer.address && (
            <div>
              <BilingualText text={dictionary.customers.address} size="sm" className="text-ink-muted" />
              <p className="mt-0.5 text-sm text-ink">{customer.address}</p>
            </div>
          )}
          {customer.notes && (
            <div>
              <BilingualText text={dictionary.customers.notes} size="sm" className="text-ink-muted" />
              <p className="mt-0.5 text-sm text-ink">{customer.notes}</p>
            </div>
          )}
        </div>
      )}

      <BilingualText text={dictionary.customers.repairHistory} as="div" size="lg" className="mb-md" />
      <div className="flex flex-1 rounded-lg border border-border/60 bg-surface shadow-card">
        <EmptyState
          title={dictionary.customers.noRepairsYet}
          body={dictionary.customers.noRepairsYetBody}
          icon={RepairsIcon}
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={dictionary.customers.deleteConfirmTitle}
        body={dictionary.customers.deleteConfirmBody}
        confirmLabel={dictionary.customers.delete}
        cancelLabel={dictionary.customers.cancel}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
