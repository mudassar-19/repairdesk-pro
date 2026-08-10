import { useEffect, useState } from 'react'
import { BilingualText } from '@shared/components/BilingualText'
import { Button } from '@shared/components/Button'
import { ExtendDateControl } from '@shared/components/ExtendDateControl'
import { dictionary } from '@shared/i18n'
import { logActivity } from '@shared/lib/activityLog'
import { addDays, daysOverdue, daysOverdueLabel, diffDays, overdueDismissKey } from '@shared/lib/overdueReminders'
import { udhaarStatusLabel, udhaarStatusBadgeClass, udhaarDirectionLabel, udhaarDirectionBadgeClass } from '@shared/lib/udhaar'
import { formatCurrency } from '@shared/lib/currency'
import { formatLocalDate } from '@shared/lib/dateRangePresets'
import { useBrandingSettings } from '@shared/hooks/useBrandingSettings'
import { useDismissedBannersStore } from '@shared/hooks/useDismissedBannersStore'
import { RecordSettlementModal } from '@features/udhaar/RecordSettlementModal'
import type { Udhaar } from '../../../../main/db/repositories/udhaarRepository'

const today = (): string => formatLocalDate(new Date())

export interface OverdueUdhaarBannerProps {
  /** Fired whenever an entry is resolved from here, so DashboardPage can refresh its Total Receivables/Payables cards. */
  onChanged: () => void
}

/**
 * Dashboard reminder for Udhaar entries whose dueDate has already passed
 * while still not fully settled — the same pattern as
 * OverdueDeliveryBanner (fetch on mount, composite id+date dismissal key,
 * shared ExtendDateControl), applied to a different entity. Kept as its own
 * component rather than a generic shared shell since its row content
 * (person/direction/amount) differs enough from a repair row to make a
 * forced-generic banner more abstraction than two call sites are worth.
 */
export function OverdueUdhaarBanner({ onChanged }: OverdueUdhaarBannerProps) {
  const { branding } = useBrandingSettings()
  const currency = branding?.currency ?? 'PKR'

  const [overdueEntries, setOverdueEntries] = useState<Udhaar[] | null>(null)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [settlingEntry, setSettlingEntry] = useState<Udhaar | null>(null)
  const dismissed = useDismissedBannersStore((state) => state.dismissed)
  const dismiss = useDismissedBannersStore((state) => state.dismiss)

  useEffect(() => {
    window.api.udhaar.getOverdue().then(setOverdueEntries)
  }, [])

  const removeFromList = (id: string) => {
    setOverdueEntries((current) => current?.filter((entry) => entry.id !== id) ?? current)
  }

  const handleApplyExtension = async (entry: Udhaar, newDate: string) => {
    if (!newDate) return
    const previousDate = entry.dueDate
    const updated = await window.api.udhaar.update(entry.id, { dueDate: newDate })
    if (!updated) return
    removeFromList(entry.id)
    setExtendingId(null)
    onChanged()
    const extendedByDays = previousDate ? diffDays(previousDate, newDate) : null
    logActivity({
      actionType: 'udhaar_due_date_extended',
      entityType: 'udhaar',
      entityId: updated.id,
      description:
        extendedByDays !== null
          ? `Udhaar due date extended from ${previousDate} to ${newDate} (${extendedByDays} day${extendedByDays === 1 ? '' : 's'})`
          : `Udhaar due date set to ${newDate}`,
      metadata: { fromDate: previousDate, toDate: newDate, extendedByDays }
    })
  }

  const handleDismissAll = () => {
    visibleOverdue.forEach((entry) => dismiss(overdueDismissKey('udhaar', entry.id, entry.dueDate!)))
  }

  if (overdueEntries === null) return null

  const visibleOverdue = overdueEntries.filter((entry) => !dismissed.has(overdueDismissKey('udhaar', entry.id, entry.dueDate!)))

  if (visibleOverdue.length === 0) return null

  return (
    <div data-testid="overdue-udhaar-banner" className="mb-xl rounded-lg border border-danger/30 bg-danger/5">
      <div className="flex items-center justify-between gap-md px-lg py-md">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-danger" />
          <BilingualText text={dictionary.udhaar.overdueTitle} as="div" size="lg" />
          <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">{visibleOverdue.length}</span>
        </div>
        <button
          type="button"
          onClick={handleDismissAll}
          aria-label="Dismiss"
          className="rounded-md p-1 text-ink-muted transition-colors hover:bg-danger/10 hover:text-ink"
        >
          ×
        </button>
      </div>

      <BilingualText text={dictionary.udhaar.overdueBody} size="sm" className="px-lg pb-md text-ink-muted" />

      <div className="divide-y divide-danger/20 border-t border-danger/20 bg-surface">
        {visibleOverdue.map((entry) => (
          <div key={entry.id}>
            <div className="flex flex-wrap items-center justify-between gap-md px-lg py-md">
              <div className="min-w-0">
                <div className="flex items-center gap-sm">
                  <p className="truncate text-sm font-medium text-ink">
                    {entry.personName} — {formatCurrency(entry.remainingBalance, currency)}
                  </p>
                  <span
                    className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 ${udhaarDirectionBadgeClass[entry.direction]}`}
                  >
                    <BilingualText text={udhaarDirectionLabel[entry.direction]} size="xs" align="center" />
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-medium text-danger">
                  {daysOverdueLabel(daysOverdue(entry.dueDate!, today())).en}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-sm">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${udhaarStatusBadgeClass[entry.status]}`}>
                  {udhaarStatusLabel[entry.status].en}
                </span>
                <Button variant="primary" size="sm" onClick={() => setSettlingEntry(entry)}>
                  <BilingualText text={dictionary.udhaar.recordSettlement} size="xs" align="center" />
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setExtendingId((current) => (current === entry.id ? null : entry.id))}>
                  <BilingualText text={dictionary.udhaar.extendDueDate} size="xs" align="center" />
                </Button>
              </div>
            </div>

            {extendingId === entry.id && (
              <ExtendDateControl
                today={today()}
                initialDate={addDays(today(), 1)}
                dateLabel={dictionary.udhaar.newDueDate}
                confirmLabel={dictionary.dashboard.updateDate}
                minDate={entry.dueDate}
                onConfirm={(newDate) => handleApplyExtension(entry, newDate)}
              />
            )}
          </div>
        ))}
      </div>

      <RecordSettlementModal
        entry={settlingEntry}
        open={settlingEntry !== null}
        onClose={() => setSettlingEntry(null)}
        onRecorded={() => {
          if (settlingEntry) removeFromList(settlingEntry.id)
          setSettlingEntry(null)
          onChanged()
        }}
      />
    </div>
  )
}
