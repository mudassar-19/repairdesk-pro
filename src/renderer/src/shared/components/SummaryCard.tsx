import { BilingualText } from './BilingualText'
import type { BilingualString } from '@shared/i18n'

export type SummaryCardTone = 'neutral' | 'warning' | 'success' | 'primary' | 'danger'

const toneClass: Record<SummaryCardTone, string> = {
  neutral: 'text-ink',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
  danger: 'text-danger'
}

export function SummaryCard({
  label,
  value,
  tone = 'neutral'
}: {
  label: BilingualString
  value: string
  tone?: SummaryCardTone
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface p-lg shadow-card">
      <BilingualText text={label} size="sm" className="text-ink-muted" />
      <p className={`mt-1 text-2xl font-medium ${toneClass[tone]}`}>{value}</p>
    </div>
  )
}
