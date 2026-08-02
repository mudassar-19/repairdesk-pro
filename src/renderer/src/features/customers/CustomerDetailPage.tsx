import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { EmptyState } from '@shared/components/EmptyState'
import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import { StatusBadge } from '@shared/components/StatusBadge'
import { RepairsIcon } from '@shared/components/icons'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import type { Customer } from '../../../../main/db/repositories/customerRepository'
import type { Repair } from '../../../../main/db/repositories/repairRepository'

export function CustomerDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    window.api.customers.getById(id).then(async (result) => {
      setCustomer(result)
      if (result) {
        const customerRepairs = await window.api.repairs.list({ customerId: result.id })
        setRepairs([...customerRepairs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      }
      setLoading(false)
    })
  }, [id])

  const totalSpent = repairs.reduce((sum, repair) => sum + (repair.repairPrice - repair.remainingBalance), 0)
  const lastVisit = repairs[0] ? new Date(repairs[0].createdAt).toLocaleDateString() : '—'

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

      <div className="mb-xl grid grid-cols-3 gap-lg">
        <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
          <BilingualText text={dictionary.customers.totalRepairs} size="sm" className="text-ink-muted" />
          <p className="mt-1 text-2xl font-medium text-ink">{repairs.length}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
          <BilingualText text={dictionary.customers.totalSpent} size="sm" className="text-ink-muted" />
          <p className="mt-1 text-2xl font-medium text-ink">{totalSpent.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
          <BilingualText text={dictionary.customers.lastVisit} size="sm" className="text-ink-muted" />
          <p className="mt-1 text-2xl font-medium text-ink">{lastVisit}</p>
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
      {repairs.length === 0 ? (
        <div className="flex flex-1 rounded-lg border border-border/60 bg-surface shadow-card">
          <EmptyState
            title={dictionary.customers.noRepairsYet}
            body={dictionary.customers.noRepairsYetBody}
            icon={RepairsIcon}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-surface shadow-card">
          <table className="w-full text-left">
            <thead className="border-b border-border bg-surface-raised">
              <tr>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.repairs.deviceModel} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.repairs.status} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.customers.lastVisit} size="sm" className="text-ink-muted" />
                </th>
                <th className="px-lg py-sm">
                  <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="text-ink-muted" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {repairs.map((repair) => (
                <tr
                  key={repair.id}
                  onClick={() => navigate(`/repairs/${repair.id}`)}
                  className="cursor-pointer transition-colors hover:bg-surface-raised"
                >
                  <td className="px-lg py-md text-sm font-medium text-ink">
                    {repair.deviceBrand} {repair.deviceModel}
                  </td>
                  <td className="px-lg py-md">
                    <StatusBadge status={repair.status} />
                  </td>
                  <td className="px-lg py-md text-sm text-ink-muted">
                    {new Date(repair.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-lg py-md text-sm font-medium text-ink">{repair.remainingBalance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
