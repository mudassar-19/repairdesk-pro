import { useState } from 'react'
import { BilingualText } from './BilingualText'
import { Button } from './Button'
import { dictionary } from '@shared/i18n'
import type { BilingualString } from '@shared/i18n'
import { addDays } from '@shared/lib/overdueReminders'

const dateInputClass =
  'rounded-md border border-border bg-surface px-sm py-sm text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

export interface ExtendDateControlProps {
  today: string
  initialDate: string
  /** Field label — differs per feature ("New delivery date" vs "New due date"), so it's a prop rather than baked in. */
  dateLabel: BilingualString
  /** Confirm button label — differs per feature ("Update Date" vs "Set Due Date"). */
  confirmLabel: BilingualString
  onConfirm: (newDate: string) => void
}

/**
 * The inline "+1 day / +3 days / +1 week + a date picker + confirm" control
 * shared by the Overdue Delivery Reminder and Overdue Udhaar Reminder
 * banners (and any future "extend a date" row action) — extracted from
 * OverdueDeliveryBanner so both features stay in lock-step instead of two
 * hand-maintained copies of the same interaction. Only the labels differ
 * per caller; the +1/+3/+7 quick-pick wording is generic enough to reuse
 * verbatim regardless of what kind of date is being extended.
 */
export function ExtendDateControl({ today, initialDate, dateLabel, confirmLabel, onConfirm }: ExtendDateControlProps) {
  const [draft, setDraft] = useState(initialDate)

  return (
    <div className="flex flex-wrap items-end gap-sm border-t border-border bg-surface-raised px-lg py-md">
      <div className="flex gap-sm">
        {[1, 3, 7].map((days) => (
          <Button key={days} variant="ghost" size="sm" onClick={() => setDraft(addDays(today, days))}>
            <BilingualText
              text={
                days === 1
                  ? dictionary.dashboard.extendBy1Day
                  : days === 3
                    ? dictionary.dashboard.extendBy3Days
                    : dictionary.dashboard.extendBy1Week
              }
              size="xs"
              align="center"
            />
          </Button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <BilingualText text={dateLabel} size="xs" className="text-ink-muted" />
        <input type="date" value={draft} onChange={(event) => setDraft(event.target.value)} className={dateInputClass} />
      </label>

      <Button variant="primary" size="sm" onClick={() => onConfirm(draft)}>
        <BilingualText text={confirmLabel} size="xs" align="center" />
      </Button>
    </div>
  )
}
