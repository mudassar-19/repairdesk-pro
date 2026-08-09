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
  /**
   * The date being extended (the entry's current due/delivery date), if any.
   * The new date must be strictly AFTER this — extending a date to an earlier
   * or equal value isn't an extension. Combined with the never-in-the-past rule
   * below, this blocks the reported "set a past due date" bug. Omit when there
   * is no current date (then the only rule is "today or later").
   */
  minDate?: string | null
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
export function ExtendDateControl({ today, initialDate, dateLabel, confirmLabel, minDate, onConfirm }: ExtendDateControlProps) {
  const [draft, setDraft] = useState(initialDate)

  // The new date can never be in the past, and — when there's a current date —
  // must be strictly after it (an actual extension). 'YYYY-MM-DD' strings
  // compare correctly with < / >.
  const error: BilingualString | null =
    draft < today
      ? dictionary.dashboard.extendDatePast
      : minDate && draft <= minDate
        ? dictionary.dashboard.extendDateNotLater
        : null
  const valid = error === null

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
        {/* min also lets the native picker grey out earlier days, but the JS
            guard above is the real gate (the field is still free-typeable). */}
        <input
          type="date"
          min={today}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className={dateInputClass}
        />
      </label>

      <Button variant="primary" size="sm" disabled={!valid} onClick={() => valid && onConfirm(draft)}>
        <BilingualText text={confirmLabel} size="xs" align="center" />
      </Button>

      {error && (
        <p role="alert" data-testid="extend-date-error" className="w-full text-xs text-danger">
          {error.en}
        </p>
      )}
    </div>
  )
}
