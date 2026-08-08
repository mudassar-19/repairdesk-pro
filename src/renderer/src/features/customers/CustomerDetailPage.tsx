import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { Card } from '@shared/components/Card'
import { EmptyState } from '@shared/components/EmptyState'
import { ConfirmDialog } from '@shared/components/ConfirmDialog'
import { StatusBadge } from '@shared/components/StatusBadge'
import { SummaryCard } from '@shared/components/SummaryCard'
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
  const [paymentsTotal, setPaymentsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    window.api.customers.getById(id).then(async (result) => {
      setCustomer(result)
      if (result) {
        const [customerRepairs, sumOfPayments] = await Promise.all([
          window.api.repairs.list({ customerId: result.id }),
          window.api.payments.sumByCustomer(result.id)
        ])
        setRepairs([...customerRepairs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        setPaymentsTotal(sumOfPayments)
      }
      setLoading(false)
    })
  }, [id])

  // Actual money received = the sum of this customer's Payment rows. Under the
  // "every rupee is a Payment" model the booking advance is itself an `advance`
  // Payment (see repairService.createRepair), so it is already inside
  // paymentsTotal — adding repair.advanceAmount on top would double-count it.
  const totalSpent = paymentsTotal
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
        <BilingualText text={dictionary.customers.notFound} as="div" size="lg" align="center" />
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <BilingualText text={dictionary.customers.backToList} size="sm" align="center" />
        </Button>
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
          <Button variant="secondary" size="sm" onClick={() => navigate(`/customers/${customer.id}/edit`)}>
            <BilingualText text={dictionary.customers.edit} size="xs" align="center" />
          </Button>
          <Button variant="danger-ghost" size="sm" onClick={() => setConfirmOpen(true)}>
            <BilingualText text={dictionary.customers.delete} size="xs" align="center" />
          </Button>
        </div>
      </div>

      <div className="mb-xl grid grid-cols-3 gap-lg">
        <SummaryCard label={dictionary.customers.totalRepairs} value={String(repairs.length)} />
        <SummaryCard label={dictionary.customers.totalSpent} value={totalSpent.toFixed(2)} tone="primary" />
        <SummaryCard label={dictionary.customers.lastVisit} value={lastVisit} />
      </div>

      {(customer.address || customer.notes) && (
        <Card className="mb-xl flex flex-col gap-sm">
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
        </Card>
      )}

      <BilingualText text={dictionary.customers.repairHistory} as="div" size="lg" className="mb-md" />
      {repairs.length === 0 ? (
        <Card padding="none" className="flex flex-1">
          <EmptyState
            title={dictionary.customers.noRepairsYet}
            body={dictionary.customers.noRepairsYetBody}
            icon={RepairsIcon}
          />
        </Card>
      ) : (
        <Card padding="none" className="max-h-[26rem] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised">
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
                <th className="px-lg py-sm text-right">
                  <BilingualText text={dictionary.repairs.remainingBalance} size="sm" className="items-end text-ink-muted" />
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
                  <td className="px-lg py-md text-right text-sm font-medium tabular-nums text-ink">
                    {repair.remainingBalance.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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
